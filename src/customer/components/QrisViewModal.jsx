import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { formatPrice } from '../../shared/lib/format.js';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { config } from '../../shared/lib/config.js';

// Read-only QR re-display for an order that's already been confirmed/inserted ,
// stacks as a popup on top of OrderSummaryModal (never touches App.jsx's
// pendingOrder/confirmedOrder state). Deliberately has no "Konfirmasi Pesanan"
// button: that flow already ran once via QrisModal, re-running it here would
// try to insert the same order_number again and error on the unique constraint.
export default function QrisViewModal({ order, settings, onClose }) {
  const isOpen = Boolean(order);
  useBodyScrollLock(isOpen);
  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const showToast = useToast();
  useDialogKeyboard({ active: isOpen, onClose, containerRef: cardRef });

  useEffect(() => {
    if (order && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, order.qrisString, {
        width: 200, margin: 1,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      }).catch(() => showToast('Gagal generate QR code', 'error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  function saveQrisImage() {
    if (!canvasRef.current) { showToast('QR belum siap', 'error'); return; }
    const link = document.createElement('a');
    link.download = `QRIS-${config.storeName.replace(/\s+/g, '')}-${order?.orderNum || 'payment'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  if (!order) return null;

  return (
    <div className="qview-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="QRIS Pembayaran">
      <div className="qview-card" ref={cardRef} onClick={(e) => e.stopPropagation()}>
        <button className="qview-close" onClick={onClose} aria-label="Tutup">✕</button>

        <div className="qp-store-badge">{settings?.brand_icon || '🏪'} {settings?.brand_name || config.storeName}</div>

        <div className="qp-qr-card">
          <canvas ref={canvasRef}></canvas>
        </div>

        <div className="qp-total-label">Total Pembayaran</div>
        <div className="qp-total-amount">{formatPrice(order.finalTotal || 0)}</div>

        <p className="qp-hint">Scan dengan aplikasi bank atau e-wallet kamu</p>

        <button className="btn-qp-save" onClick={saveQrisImage}>Simpan QR</button>
      </div>
    </div>
  );
}
