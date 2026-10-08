import { useEffect, useMemo } from 'react';
import { useCart } from '../CartContext.jsx';
import { config } from '../../shared/lib/config.js';
import { buildDateChips } from '../../shared/lib/format.js';
import { useFullDates } from '../../shared/hooks/useFullDates.js';
import { waLink } from '../../shared/lib/whatsapp.js';

export default function OrderTypeStep({ settings }) {
  const { state, dispatch } = useCart();

  // Mode toko cuma mengubah kalender di layar ini dan kalimat di sekitarnya.
  // Alur, tabel, dan checkout-nya sama persis untuk keduanya: yang bikin
  // customer paham ini toko PO adalah kalendernya yang tidak menawarkan hari
  // ini, bukan paragraf penjelasan yang toh tidak dibaca.
  const isPreorder = settings?.store_mode === 'preorder';
  const leadDays = isPreorder ? (settings?.preorder_lead_days || 0) : 0;
  const horizonDays = settings?.order_horizon_days || 7;

  // Dihitung ulang saat settings datang, bukan sekali di mount: settings
  // di-fetch async, jadi render pertama selalu memakai default.
  const dateChips = useMemo(
    () => buildDateChips({ leadDays, horizonDays }),
    [leadDays, horizonDays],
  );

  const { fullDates } = useFullDates(
    dateChips[0]?.value,
    dateChips[dateChips.length - 1]?.value,
  );

  const selectableChips = dateChips.filter((chip) => !fullDates.has(chip.value));
  const allClosed = dateChips.length > 0
    && dateChips.every((chip) => fullDates.get(chip.value) === 'closed');
  const allFull = dateChips.length > 0 && selectableChips.length === 0;

  const brandName = settings?.brand_name || config.storeName;
  const logoUrl = settings?.logo_url;
  const logoTextUrl = settings?.logo_text_url;
  const brandIcon = settings?.brand_icon || '🏪';
  const instagramUrl = settings?.instagram_url || config.instagramUrl;
  const storeMapsUrl = settings?.store_maps_url || config.storeMapsUrl;
  const tiktokUrl = settings?.tiktok_url || config.tiktokUrl;

  useEffect(() => {
    document.title = brandName;
  }, [brandName]);

  // Settings dan daftar tanggal penuh datang setelah render pertama, jadi
  // tanggal yang sudah terpilih bisa hilang dari daftar di belakang layar
  // (mode berubah jadi preorder, atau tanggal itu keburu penuh). Tanpa ini,
  // pilihan lama tetap tersimpan dan customer bisa lanjut membawa tanggal
  // yang tidak lagi ditawarkan.
  useEffect(() => {
    if (!state.selectedDate) return;
    if (selectableChips.some((chip) => chip.value === state.selectedDate)) return;
    dispatch({ type: 'SET_DATE', value: null, label: null });
  }, [state.selectedDate, selectableChips, dispatch]);

  const waHelpUrl = waLink(config.adminWhatsapp, `Halo ${brandName}, saya butuh bantuan untuk pemesanan!`);

  function selectOrderType(type) {
    dispatch({ type: 'SELECT_ORDER_TYPE', orderType: type });
  }

  function selectDate(chip) {
    dispatch({ type: 'SET_DATE', value: chip.value, label: chip.label });
  }

  function goToStep2() {
    if (!state.orderType || !state.selectedDate) return;
    dispatch({ type: 'SET_STEP', step: 2 });
    window.scrollTo(0, 0);
  }

  const canProceed = Boolean(state.orderType && state.selectedDate);

  return (
    <div className="step active">
      <div className="onboarding">

        <div className="ob-topbar">
          <div className="ob-brand">
            {logoUrl ? (
              <img className="ob-brand-icon brand-icon-logo" src={logoUrl} alt={brandName} />
            ) : (
              <span className="ob-brand-icon">{brandIcon}</span>
            )}
            {logoTextUrl ? (
              <img className="ob-brand-name-logo" src={logoTextUrl} alt={brandName} />
            ) : (
              <span className="ob-brand-name">{brandName}</span>
            )}
          </div>
          {waHelpUrl && (
            <a className="btn-wa-help" href={waHelpUrl} target="_blank" rel="noopener noreferrer">
              Butuh bantuan?
            </a>
          )}
        </div>

        <h1 className="ob-headline">Mau pickup<br />atau delivery?</h1>
        <p className="ob-sub">
          {isPreorder
            ? 'Semua pesanan dibuat per tanggal. Pilih tanggalnya dulu, baru lihat menu.'
            : 'Pilih dulu, baru lihat menu.'}
        </p>

        <div className="order-type-grid">
          <button
            type="button"
            className={`order-type-card${state.orderType === 'pickup' ? ' selected' : ''}`}
            aria-pressed={state.orderType === 'pickup'}
            onClick={() => selectOrderType('pickup')}
          >
            <span className="order-type-icon">🏠</span>
            <span className="order-type-name">Pickup</span>
            <span className="order-type-desc">Ambil sendiri</span>
          </button>
          <button
            type="button"
            className={`order-type-card${state.orderType === 'delivery' ? ' selected' : ''}`}
            aria-pressed={state.orderType === 'delivery'}
            onClick={() => selectOrderType('delivery')}
          >
            <span className="order-type-icon">🛵</span>
            <span className="order-type-name">Delivery</span>
            <span className="order-type-desc">Dikirim ke kamu</span>
          </button>
        </div>

        <div className={`pickup-address-card${state.orderType === 'pickup' ? ' visible' : ''}`}>
          <div>
            <div className="pickup-info-label">Lokasi Pickup</div>
            <div className="pickup-info-name">{brandName}</div>
            <div className="pickup-info-addr">{settings?.store_address || config.storeAddress}</div>
            <div className="pickup-info-hours">{settings?.store_hours || config.storeOpenHours}</div>
            {storeMapsUrl && (
              <a className="pickup-maps-link" href={storeMapsUrl} target="_blank" rel="noopener noreferrer">
                Buka di Google Maps
              </a>
            )}
          </div>
        </div>

        <div className={`date-section${state.orderType ? ' visible' : ''}`}>
          <div className="date-section-label">
            {state.orderType === 'pickup' ? 'Pilih Tanggal Pickup' : 'Pilih Tanggal Delivery'}
          </div>
          {isPreorder && leadDays > 0 && selectableChips.length > 0 && (
            <p className="date-section-hint">
              Pesanan butuh waktu {leadDays} hari, jadi paling cepat {selectableChips[0].label}.
            </p>
          )}
          {allFull ? (
            <p className="date-section-empty">
              {allClosed
                ? 'Toko sedang libur di semua tanggal terdekat.'
                : 'Semua tanggal terdekat sudah penuh.'}
              {waHelpUrl ? ' Chat kami dulu buat cari tanggal lain.' : ''}
            </p>
          ) : (
            <div className="date-chips-wrap">
              {dateChips.map((chip) => {
                const reason = fullDates.get(chip.value);
                const isFull = Boolean(reason);
                // "Libur" dan "Penuh" sengaja beda kata. Libur berarti toko
                // memang tidak menerima pesanan tanggal itu, penuh berarti
                // kuotanya sudah habis diambil orang lain.
                const blockedLabel = reason === 'closed' ? 'Libur' : 'Penuh';
                return (
                  <button
                    type="button"
                    key={chip.value}
                    className={`date-chip${chip.isToday ? ' chip-today' : chip.isTomorrow ? ' chip-tomorrow' : ''}${state.selectedDate === chip.value ? ' selected' : ''}${isFull ? ' chip-full' : ''}`}
                    aria-pressed={state.selectedDate === chip.value}
                    disabled={isFull}
                    onClick={() => selectDate(chip)}
                  >
                    {chip.isToday || chip.isTomorrow ? (
                      <>
                        <span className="dc-label">{chip.isToday ? 'Hari ini' : 'Besok'}</span>
                        <span className="dc-sublabel">{isFull ? blockedLabel : `${chip.date} ${chip.month}`}</span>
                      </>
                    ) : (
                      <>
                        <span className="dc-day">{chip.day}</span>
                        <span className="dc-date">{chip.date}</span>
                        <span className="dc-month">{isFull ? blockedLabel : chip.month}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ob-footer">
          <button className="btn-next" onClick={goToStep2} disabled={!canProceed}>
            Lihat Menu →
          </button>
        </div>

        <footer className="site-footer">
          <a className="footer-track-link" href="/tracking/">Lacak Pesanan</a>
          <div className="footer-socials">
            {instagramUrl && (
            <a className="footer-social-link" href={instagramUrl} target="_blank" rel="noopener noreferrer">
              <svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              Instagram
            </a>
            )}
            {tiktokUrl && (
            <a className="footer-social-link" href={tiktokUrl} target="_blank" rel="noopener noreferrer">
              <svg className="footer-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.08a8.18 8.18 0 0 0 4.79 1.53V7.16a4.85 4.85 0 0 1-1.02-.47z" />
              </svg>
              TikTok
            </a>
            )}
          </div>
          <div className="footer-powered">Powered by <span className="footer-brand">Studio Harel</span></div>
        </footer>

      </div>
    </div>
  );
}
