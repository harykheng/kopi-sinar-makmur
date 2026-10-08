import { createPortal } from 'react-dom';

export default function ShippingLoadingOverlay({ show }) {
  if (!show) return null;

  return createPortal(
    <div className="shipping-loading-overlay">
      <div className="slo-scene">
        <span className="slo-scooter">🛵</span>
        <span className="slo-cup">📦</span>
        <div className="slo-road"></div>
      </div>
      <div className="slo-text">Lagi ngecek ongkir…</div>
      <div className="slo-sub">Nyariin kurir tercepat biar pesananmu cepat sampai!</div>
      <div className="slo-dots">
        <span></span><span></span><span></span>
      </div>
    </div>,
    document.body
  );
}
