import { useEffect, useRef, useState } from 'react';
import { config } from '../../shared/lib/config.js';
import { haversineDistance } from '../../shared/lib/shipping.js';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';
import AddressMapPreview from './AddressMapPreview.jsx';

// Hasil dikelompokkan per pita jarak selebar ini sebelum diurutkan. Dalam satu
// pita, urutan relevansi dari LocationIQ dipertahankan apa adanya (Array.sort
// stabil), jadi "Mall Taman Anggrek" tetap menang dari "Jalan Anggrek" kecil
// yang kebetulan 500 m lebih dekat. Yang dibuang cuma kasus beda kota.
const DISTANCE_BAND_KM = 10;

function hasStoreCoords() {
  return Number.isFinite(config.storeLat) && Number.isFinite(config.storeLng);
}

// Kotak bias di sekitar toko buat parameter `viewbox` LocationIQ. Sengaja TANPA
// `bounded=1`: bounded memotong keras hasil di luar kotak, jadi alamat yang
// benar tapi sedikit di luar radius bakal hilang sama sekali dan customer buntu
// tanpa jalan keluar. Yang berhak menolak alamat kejauhan itu cek ongkir, bukan
// kotak pencarian.
function storeViewbox() {
  if (!hasStoreCoords()) return null;
  const { storeLat: lat, storeLng: lng, addressSearchRadiusKm: radiusKm } = config;
  const dLat = radiusKm / 111;
  // 1 derajat bujur menyempit mengikuti cos(lintang), floor-nya jaga-jaga
  // supaya tidak meledak jadi tak hingga di dekat kutub.
  const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

// LocationIQ kadang mengembalikan nama tempat huruf besar semua ("TAMAN
// ANGGREK"), karena begitu isinya di OSM. Dirapikan per segmen (dipisah koma),
// dan HANYA kalau segmen itu memang huruf besar semua dan cukup panjang.
// Batas panjangnya penting: singkatan yang wajar di alamat Indonesia ("RW 08",
// "RT 01", "BSD", "PIK") harus lolos apa adanya, jangan sampai jadi "Rw 08".
const MIN_ALLCAPS_LETTERS = 5;

function tidyCase(text) {
  if (!text) return '';
  return text
    .split(',')
    .map((segment) => {
      const letters = segment.replace(/[^\p{L}]/gu, '');
      if (letters.length < MIN_ALLCAPS_LETTERS) return segment;
      // Ada huruf kecilnya, berarti penulisannya sudah normal, jangan disentuh.
      if (letters !== letters.toUpperCase()) return segment;
      return segment.replace(/\p{L}[\p{L}']*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    })
    .join(',');
}

function distanceBand(km) {
  // Hasil tanpa koordinat valid ditaruh paling belakang, bukan bikin
  // comparator balik NaN (itu bikin urutannya acak).
  if (!Number.isFinite(km)) return Number.MAX_SAFE_INTEGER;
  return Math.floor(km / DISTANCE_BAND_KM);
}

// LocationIQ mengurutkan murni pakai relevansi teks, tidak tahu toko ini di
// mana, jadi "Taman Anggrek" bisa mengembalikan yang di Bandung lebih dulu
// daripada yang 2 km dari toko di Jakarta. `viewbox` sudah membenahi kandidat
// yang dikembalikan, urutan akhirnya dibereskan di sini.
function withDistanceSorted(results) {
  if (!hasStoreCoords()) return results.map((r) => ({ ...r, distanceKm: null }));
  return results
    .map((r) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      const distanceKm = Number.isFinite(lat) && Number.isFinite(lng)
        ? haversineDistance(config.storeLat, config.storeLng, lat, lng)
        : null;
      return { ...r, distanceKm };
    })
    .sort((a, b) => distanceBand(a.distanceKm) - distanceBand(b.distanceKm));
}

async function fetchSuggestions(q) {
  try {
    const params = new URLSearchParams({
      key: config.locationIqKey,
      q,
      limit: '8',
      dedupe: '1',
      'accept-language': 'id',
      countrycodes: 'id',
    });
    const viewbox = storeViewbox();
    if (viewbox) params.set('viewbox', viewbox);

    const res = await fetch(`https://api.locationiq.com/v1/autocomplete?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? withDistanceSorted(data) : [];
  } catch {
    return []; // silent, customer can still search again
  }
}

// Full-screen address picker, opened by tapping the address summary card in
// ProfileModal, replaces the old cramped in-sheet dropdown+map. Two internal
// steps: search (full-screen results list) then confirm (bigger map preview +
// the catatan alamat field), landing back on ProfileModal only once "Simpan
// Alamat Ini" is tapped. Nothing here touches CartContext directly, the
// picked address/coords/note are only reported up via onConfirm.
export default function AddressPickerModal({ isOpen, onClose, onConfirm, initialAddress, initialNote }) {
  const [step, setStep] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  useBodyScrollLock(isOpen);
  // Escape steps back to search from confirm, and closes the picker from search.
  useDialogKeyboard({
    active: isOpen,
    onClose: () => (step === 'confirm' ? setStep('search') : onClose()),
    containerRef: overlayRef,
  });

  useEffect(() => {
    if (!isOpen) return;
    setStep('search');
    setQuery(initialAddress || '');
    setResults([]);
    setSelected(null);
    setNote(initialNote || '');
    // Autofocus the search field as the sheet opens, matching how a tap on
    // the address card is meant to jump straight into typing.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleSearchInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    if (q.trim().length < 3) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const data = await fetchSuggestions(q);
      setResults(data);
      setSearching(false);
    }, 350);
  }

  function pickResult(r) {
    const label = tidyCase(r.display_name || r.display_place || '');
    setSelected({ label, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setStep('confirm');
  }

  function handleConfirmSave() {
    if (!selected) return;
    onConfirm(selected.label, selected.lat, selected.lng, note.trim());
  }

  if (!isOpen) return null;

  return (
    // Rendered as a sibling of .profile-sheet inside ProfileModal's
    // .profile-overlay, which closes the whole sheet on any click that
    // bubbles to it, stopPropagation here so interacting with the picker
    // doesn't accidentally close the profile sheet underneath it.
    <div
      className="address-picker-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pilih Alamat"
      onClick={(e) => e.stopPropagation()}
    >
      {step === 'search' ? (
        <>
          <header className="address-picker-header">
            <button className="address-picker-back" onClick={onClose} aria-label="Tutup">←</button>
            <span className="address-picker-title">Pilih Alamat</span>
            <span style={{ width: 36 }}></span>
          </header>
          <div className="address-picker-search-wrap">
            <input
              ref={inputRef}
              type="text"
              className="address-picker-search-input"
              placeholder="Cari alamat, jalan, gedung..."
              value={query}
              onChange={handleSearchInput}
            />
          </div>
          <div className="address-picker-results">
            {searching && <div className="address-picker-status">Mencari...</div>}
            {!searching && query.trim().length >= 3 && results.length === 0 && (
              <div className="address-picker-status">Alamat tidak ditemukan, coba kata kunci lain</div>
            )}
            {!searching && query.trim().length < 3 && (
              <div className="address-picker-status">Ketik minimal 3 huruf untuk mulai cari</div>
            )}
            {results.map((r, i) => {
              const title = tidyCase((r.display_place || r.display_name || '').split(',')[0]);
              return (
                <button type="button" key={i} className="address-picker-result-item" onClick={() => pickResult(r)}>
                  {/* Penanda lokasi, murni dekorasi: tiap baris di daftar ini memang
                      alamat, jadi ikonnya tidak membawa informasi pembeda dan
                      disembunyikan dari screen reader. SVG, bukan emoji 📍, supaya
                      warnanya ikut palet dan bentuknya sama di semua HP. */}
                  <svg className="address-picker-result-pin" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  <div className="address-picker-result-text">
                    <div className="address-picker-result-title">{title}</div>
                    <div className="address-picker-result-sub">{tidyCase(r.display_name)}</div>
                    {Number.isFinite(r.distanceKm) && (
                      <div className="address-picker-result-dist">{r.distanceKm.toFixed(1)} km dari toko</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <header className="address-picker-header">
            <button className="address-picker-back" onClick={() => setStep('search')} aria-label="Kembali">←</button>
            <span className="address-picker-title">Konfirmasi Lokasi</span>
            <span style={{ width: 36 }}></span>
          </header>
          <div className="address-picker-confirm-body">
            <div className="address-picker-selected-card">
              <span>{selected?.label}</span>
            </div>
            <AddressMapPreview lat={selected?.lat} lng={selected?.lng} large />
            <div className="form-group" style={{ marginTop: 16 }}>
              <label htmlFor="addressPickerNote">Catatan Alamat <span className="label-opt">(opsional)</span></label>
              <input
                type="text"
                id="addressPickerNote"
                placeholder="No. unit, lantai, patokan, kode gate..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="address-picker-footer">
            <button className="btn-profile-save" onClick={handleConfirmSave}>Simpan Alamat Ini</button>
          </div>
        </>
      )}
    </div>
  );
}
