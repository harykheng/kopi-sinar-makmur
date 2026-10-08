import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { formatPrice } from '../../shared/lib/format.js';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { insertOrder } from '../../shared/lib/orders.js';
import { buildQrisConfirmMessage, waLink } from '../../shared/lib/whatsapp.js';
import { config } from '../../shared/lib/config.js';

export default function QrisModal({ pendingOrder, settings, onClose, onConfirmed }) {
  const isOpen = Boolean(pendingOrder);
  useBodyScrollLock(isOpen);
  const canvasRef = useRef(null);
  const pageRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  useDialogKeyboard({ active: isOpen, onClose, containerRef: pageRef });
  const showToast = useToast();

  useEffect(() => {
    if (pendingOrder && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, pendingOrder.qrisString, {
        width: 220, margin: 1,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      }).catch(() => showToast('Gagal generate QR code', 'error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder]);

  function saveQrisImage() {
    if (!canvasRef.current) { showToast('QR belum siap', 'error'); return; }
    const link = document.createElement('a');
    link.download = `QRIS-${config.storeName.replace(/\s+/g, '')}-${pendingOrder?.orderNum || 'payment'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  async function confirmPayment() {
    if (!pendingOrder) return;
    setConfirming(true);
    const o = pendingOrder;

    const waMessage = buildQrisConfirmMessage({
      storeName: config.storeName,
      orderNum: o.orderNum, cartSnapshot: o.cartSnapshot,
      rawTotal: o.rawTotal, discount: o.discount, promoCode: o.promoCode,
      shippingCost: o.shippingCost, shippingLabel: o.shippingLabel, finalTotal: o.finalTotal,
      name: o.name, wa: o.wa, orderType: o.orderType, orderDateLabel: o.orderDateLabel,
      address: o.address, addressNote: o.addressNote, note: o.note,
    });

    try {
      await insertOrder({
        order_number: o.orderNum,
        customer_name: o.name,
        customer_wa: o.wa,
        order_type: o.orderType,
        order_date: o.selectedDate,
        order_date_label: o.orderDateLabel,
        delivery_address: o.orderType === 'delivery' ? o.address : null,
        note: o.note || null,
        items: o.cartSnapshot,
        subtotal: o.rawTotal,
        promo_code: o.promoCode,
        discount_amount: o.discount,
        shipping_cost: o.shippingCost || null,
        shipping_label: o.shippingLabel || null,
        total: o.finalTotal,
        qris_string: o.qrisString || null,
        status: 'pending',
      }, o.stockItems);

      onConfirmed({ ...o, waUrl: waLink(config.adminWhatsapp, waMessage) });
    } catch (err) {
      console.error('Confirm QRIS error:', err);
      // Tiga penolakan yang punya pesan sendiri dari place_order(): stok
      // kurang, kuota tanggal penuh, dan toko libur. Ketiganya sudah
      // menjelaskan apa yang salah, jadi diteruskan apa adanya, bukan diganti
      // pesan generik.
      const blockedMatch = /(?:STOK_HABIS|KUOTA_HABIS|TOKO_TUTUP): (.+)/.exec(err.message || '');
      if (blockedMatch) {
        showToast(blockedMatch[1], 'error');
        onClose();
      } else {
        showToast('Gagal menyimpan pesanan. Coba lagi ya!', 'error');
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div id="qrisModal" role="dialog" aria-modal="true" aria-label="Pembayaran QRIS" style={{ display: isOpen ? 'block' : 'none' }}>
      <div className="qp-page" ref={pageRef}>
        <div className="qp-topbar">
          <button className="qp-back" onClick={onClose} aria-label="Kembali">←</button>
          <span className="qp-topbar-title">Pembayaran QRIS</span>
        </div>

        <div className="qp-body">
          <div className="qp-store-badge">{settings?.brand_icon || '🏪'} {settings?.brand_name || config.storeName}</div>

          <div className="qp-qr-card">
            <canvas ref={canvasRef}></canvas>
          </div>

          <div className="qp-total-label">Total Pembayaran</div>
          <div className="qp-total-amount">{formatPrice(pendingOrder?.finalTotal || 0)}</div>

          <p className="qp-hint">Scan dengan aplikasi bank atau e-wallet kamu</p>

          <button className="btn-qp-save" onClick={saveQrisImage}>Simpan QR</button>

          <button className="btn-qp-confirm" onClick={confirmPayment} disabled={confirming}>
            {confirming ? 'Menyimpan...' : 'Konfirmasi Pesanan'}
          </button>
        </div>
      </div>
    </div>
  );
}
