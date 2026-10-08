import { useEffect, useState } from 'react';
import { useSettings } from '../../shared/hooks/useSettings.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { saveSettings } from '../../shared/lib/settings.js';
import { useClosedDates } from '../../shared/hooks/useClosedDates.js';
import { addClosedDate, removeClosedDate } from '../../shared/lib/closedDates.js';
import { formatDateKey, todayKey } from '../../shared/lib/format.js';
import ImageUploadDropzone from './ImageUploadDropzone.jsx';
import AdminErrorState from './AdminErrorState.jsx';

const EMPTY_FORM = {
  brandName: '', brandIcon: '🏪', storeAddress: '', storeHours: '', storeMapsUrl: '',
  bannerTitle: '', bannerSubtitle: '', instagramUrl: '', tiktokUrl: '',
  storeMode: 'sameday', preorderLeadDays: '0', orderHorizonDays: '7',
};

export default function SettingsTab() {
  const { settings, loading, error, refetch } = useSettings();
  const showToast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState(null);
  const [logoTextFile, setLogoTextFile] = useState(null);
  const [existingLogoTextUrl, setExistingLogoTextUrl] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [existingFaviconUrl, setExistingFaviconUrl] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [existingBannerImageUrl, setExistingBannerImageUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  // Tanggal libur disimpan langsung saat ditambah atau dihapus, bukan ikut
  // tombol Simpan di bawah. Tabelnya terpisah dari `settings`, dan menahannya
  // sampai submit bikin admin mengira liburnya sudah aktif padahal belum.
  const { closedDates, loading: closedLoading, error: closedError, refetch: refetchClosed } = useClosedDates();
  const [newClosedDate, setNewClosedDate] = useState('');
  const [newClosedNote, setNewClosedNote] = useState('');
  const [closedBusy, setClosedBusy] = useState(false);

  async function handleAddClosedDate() {
    if (guardDemoWrite()) return;
    if (!newClosedDate) {
      showToast('Pilih tanggalnya dulu ya', 'error');
      return;
    }
    setClosedBusy(true);
    try {
      await addClosedDate(newClosedDate, newClosedNote.trim());
      setNewClosedDate('');
      setNewClosedNote('');
      showToast('Tanggal libur ditambahkan', 'success');
      await refetchClosed();
    } catch (err) {
      console.error('addClosedDate error:', err);
      showToast('Gagal menambah tanggal libur: ' + (err.message || 'Coba lagi'), 'error');
    } finally {
      setClosedBusy(false);
    }
  }

  async function handleRemoveClosedDate(dateKey) {
    if (guardDemoWrite()) return;
    setClosedBusy(true);
    try {
      await removeClosedDate(dateKey);
      showToast('Tanggal libur dihapus', 'success');
      await refetchClosed();
    } catch (err) {
      console.error('removeClosedDate error:', err);
      showToast('Gagal menghapus: ' + (err.message || 'Coba lagi'), 'error');
    } finally {
      setClosedBusy(false);
    }
  }

  useEffect(() => {
    if (!settings) return;
    setForm({
      brandName: settings.brand_name || '',
      brandIcon: settings.brand_icon || '🏪',
      storeAddress: settings.store_address || '',
      storeHours: settings.store_hours || '',
      storeMapsUrl: settings.store_maps_url || '',
      bannerTitle: settings.banner_title || '',
      bannerSubtitle: settings.banner_subtitle || '',
      instagramUrl: settings.instagram_url || '',
      tiktokUrl: settings.tiktok_url || '',
      storeMode: settings.store_mode === 'preorder' ? 'preorder' : 'sameday',
      preorderLeadDays: String(settings.preorder_lead_days ?? 0),
      orderHorizonDays: String(settings.order_horizon_days ?? 7),
    });
    setExistingLogoUrl(settings.logo_url || null);
    setExistingLogoTextUrl(settings.logo_text_url || null);
    setExistingFaviconUrl(settings.favicon_url || null);
    setExistingBannerImageUrl(settings.banner_image_url || null);
  }, [settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings({
        brandName: form.brandName.trim(),
        brandIcon: form.brandIcon.trim(),
        storeAddress: form.storeAddress.trim(),
        storeHours: form.storeHours.trim(),
        storeMapsUrl: form.storeMapsUrl.trim(),
        bannerTitle: form.bannerTitle.trim(),
        bannerSubtitle: form.bannerSubtitle.trim(),
        instagramUrl: form.instagramUrl.trim(),
        tiktokUrl: form.tiktokUrl.trim(),
        storeMode: form.storeMode,
        preorderLeadDays: form.preorderLeadDays,
        orderHorizonDays: form.orderHorizonDays,
        logoFile,
        logoTextFile,
        faviconFile,
        bannerImageFile,
        existingLogoUrl,
        existingLogoTextUrl,
        existingFaviconUrl,
        existingBannerImageUrl,
      });
      setLogoFile(null);
      setLogoTextFile(null);
      setFaviconFile(null);
      setBannerImageFile(null);
      showToast('Pengaturan berhasil disimpan!', 'success');
      await refetch();
    } catch (err) {
      console.error('Save settings error:', err);
      showToast('Gagal menyimpan: ' + (err.message || 'Coba lagi'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-state" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span>Memuat pengaturan...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Pengaturan</h2>
          <p className="admin-page-subtitle">Tampilan website &amp; brand</p>
        </div>
      </div>

      {error && <AdminErrorState what="pengaturan" error={error} onRetry={refetch} />}

      <form onSubmit={handleSubmit} className="settings-form" noValidate>
        <div className="settings-section">
          <div className="settings-section-title">Brand</div>
          <div className="form-group">
            <label htmlFor="settingBrandName">Nama Brand</label>
            <input type="text" id="settingBrandName" placeholder="Nama Toko Kamu" maxLength={40} value={form.brandName} onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="settingBrandIcon">Ikon / Emoji</label>
            <input type="text" id="settingBrandIcon" placeholder="🏪" maxLength={4} style={{ maxWidth: 90 }} value={form.brandIcon} onChange={(e) => setForm((f) => ({ ...f, brandIcon: e.target.value }))} />
            <p className="form-hint">Tampil di header kalau tidak ada logo gambar</p>
          </div>
          <div className="form-group">
            <label>Logo Ikon (gambar, opsional)</label>
            <ImageUploadDropzone
              existingUrl={existingLogoUrl}
              onFileSelect={setLogoFile}
              onRemove={() => { setLogoFile(null); setExistingLogoUrl(null); }}
              maxSizeMB={2}
              hint="PNG, JPG, WEBP, SVG, maks 2 MB"
            />
            <p className="form-hint">Mascot/ikon kecil. Menggantikan emoji di atas pada header katalog, dan jadi satu-satunya ikon yang tampil di header dashboard admin. Kalau kosong, header admin cuma tampil nama toko.</p>
          </div>
          <div className="form-group">
            <label>Logo Teks / Wordmark (gambar, opsional)</label>
            <ImageUploadDropzone
              existingUrl={existingLogoTextUrl}
              onFileSelect={setLogoTextFile}
              onRemove={() => { setLogoTextFile(null); setExistingLogoTextUrl(null); }}
              maxSizeMB={2}
              hint="PNG, JPG, WEBP, SVG, maks 2 MB"
            />
            <p className="form-hint">Ganti tulisan "Nama Brand" di header dengan gambar logo teks kamu sendiri. Kalau kosong, tampil sebagai teks biasa.</p>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Favicon (ikon tab browser, opsional)</label>
            <ImageUploadDropzone
              existingUrl={existingFaviconUrl}
              onFileSelect={setFaviconFile}
              onRemove={() => { setFaviconFile(null); setExistingFaviconUrl(null); }}
              maxSizeMB={1}
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,.ico"
              hint="PNG, ICO, SVG, maks 1 MB"
            />
            <p className="form-hint">Ikon kecil di tab browser, dipakai di halaman katalog, lacak pesanan, dan dashboard ini. Paling rapi kalau gambarnya persegi, minimal 180 x 180 px. Kalau kosong, ikon bawaan yang dipakai.</p>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Informasi Toko</div>
          <div className="form-group">
            <label htmlFor="settingStoreAddress">Alamat Pickup</label>
            <textarea id="settingStoreAddress" rows={3} placeholder="Jl. Contoh No.1, Kota..." value={form.storeAddress} onChange={(e) => setForm((f) => ({ ...f, storeAddress: e.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="settingStoreHours">Jam Operasional</label>
            <input type="text" id="settingStoreHours" placeholder="Senin – Minggu, 08.00 – 21.00 WIB" value={form.storeHours} onChange={(e) => setForm((f) => ({ ...f, storeHours: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="settingStoreMapsUrl">Link Google Maps</label>
            <input type="url" id="settingStoreMapsUrl" placeholder="https://maps.google.com/..." value={form.storeMapsUrl} onChange={(e) => setForm((f) => ({ ...f, storeMapsUrl: e.target.value }))} />
            <p className="form-hint">URL yang terbuka saat pelanggan tap "Lihat di Maps"</p>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Cara Pesan</div>
          <div className="form-group">
            <label htmlFor="settingStoreMode">Mode Toko</label>
            <select
              id="settingStoreMode"
              value={form.storeMode}
              onChange={(e) => setForm((f) => ({ ...f, storeMode: e.target.value }))}
            >
              <option value="sameday">Siap hari itu juga</option>
              <option value="preorder">Pre-order (PO)</option>
            </select>
            <p className="form-hint">
              Yang berubah cuma kalender di halaman pertama dan kalimat di sekitarnya. Menu, keranjang, dan
              pembayaran sama persis di dua mode.
            </p>
          </div>
          {form.storeMode === 'preorder' && (
            <div className="form-group">
              <label htmlFor="settingLeadDays">Tenggang Pesanan (hari)</label>
              <input
                type="number" id="settingLeadDays" min="0" max="60" step="1"
                value={form.preorderLeadDays}
                onChange={(e) => setForm((f) => ({ ...f, preorderLeadDays: e.target.value }))}
              />
              <p className="form-hint">
                Berapa hari kamu butuh sebelum pesanan siap. Isi 2 kalau pesanan hari ini paling cepat
                diambil lusa. Tanggal yang lebih awal tidak akan ditawarkan ke pelanggan.
              </p>
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="settingHorizonDays">Tanggal yang Dibuka (hari)</label>
            <input
              type="number" id="settingHorizonDays" min="1" max="60" step="1"
              value={form.orderHorizonDays}
              onChange={(e) => setForm((f) => ({ ...f, orderHorizonDays: e.target.value }))}
            />
            <p className="form-hint">
              Berapa hari ke depan yang boleh dipilih pelanggan, dihitung dari tanggal paling awal. Default 7.
              Naikkan kalau kamu menerima pesanan jauh hari, misal hampers.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Tanggal Libur</div>
          <p className="form-hint" style={{ marginTop: 0 }}>
            Tanggal yang kamu tutup. Pelanggan tidak bisa memilihnya di halaman pertama, dan pesanan
            untuk tanggal itu ditolak walaupun sudah sempat dipilih sebelum kamu menutupnya.
          </p>

          <div className="closed-date-add">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="closedDateInput">Tanggal</label>
              <input
                type="date" id="closedDateInput" min={todayKey()}
                value={newClosedDate}
                onChange={(e) => setNewClosedDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="closedNoteInput">Alasan <span style={{ fontWeight: 500, color: 'var(--text-soft)' }}>(opsional)</span></label>
              <input
                type="text" id="closedNoteInput" placeholder="Libur Lebaran"
                value={newClosedNote}
                onChange={(e) => setNewClosedNote(e.target.value)}
              />
            </div>
            <button
              type="button" className="btn btn-secondary"
              onClick={handleAddClosedDate} disabled={closedBusy}
            >
              Tambah
            </button>
          </div>

          {closedLoading && <p className="form-hint">Memuat tanggal libur...</p>}
          {!closedLoading && closedError && (
            <p className="form-hint" style={{ color: 'var(--danger)' }}>
              Daftar tanggal libur gagal dimuat. Coba muat ulang halaman.
            </p>
          )}
          {!closedLoading && !closedError && closedDates.length === 0 && (
            <p className="form-hint">Belum ada tanggal libur. Toko buka di semua tanggal.</p>
          )}
          {!closedLoading && !closedError && closedDates.length > 0 && (
            <ul className="closed-date-list">
              {closedDates.map((row) => {
                const key = String(row.closed_date).slice(0, 10);
                return (
                  <li className="closed-date-item" key={key}>
                    <div>
                      <div className="closed-date-label">{formatDateKey(key)}</div>
                      <div className="closed-date-sub">{key}{row.note ? ` · ${row.note}` : ''}</div>
                    </div>
                    <button
                      type="button" className="btn-sm btn-delete"
                      onClick={() => handleRemoveClosedDate(key)} disabled={closedBusy}
                    >
                      Hapus
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Banner Katalog</div>
          <div className="form-group">
            <label>Foto Banner (opsional)</label>
            <ImageUploadDropzone
              existingUrl={existingBannerImageUrl}
              onFileSelect={setBannerImageFile}
              onRemove={() => { setBannerImageFile(null); setExistingBannerImageUrl(null); }}
              maxSizeMB={5}
              hint="PNG, JPG, WEBP, maks 5 MB"
            />
            <p className="form-hint">Tampil sebagai foto background di banner katalog</p>
          </div>
          <div className="form-group">
            <label htmlFor="settingBannerTitle">Judul Banner</label>
            <input type="text" id="settingBannerTitle" placeholder="Ada yang baru nih!" value={form.bannerTitle} onChange={(e) => setForm((f) => ({ ...f, bannerTitle: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="settingBannerSub">Subjudul Banner</label>
            <input type="text" id="settingBannerSub" placeholder="Cek semua menu terbaru" value={form.bannerSubtitle} onChange={(e) => setForm((f) => ({ ...f, bannerSubtitle: e.target.value }))} />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Social Media</div>
          <div className="form-group">
            <label htmlFor="settingInstagramUrl">Instagram</label>
            <input type="url" id="settingInstagramUrl" placeholder="https://instagram.com/tokomu" value={form.instagramUrl} onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="settingTiktokUrl">TikTok</label>
            <input type="url" id="settingTiktokUrl" placeholder="https://tiktok.com/@tokomu" value={form.tiktokUrl} onChange={(e) => setForm((f) => ({ ...f, tiktokUrl: e.target.value }))} />
          </div>
        </div>

        <div className="form-actions settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
}
