import Modal from '../../shared/components/Modal.jsx';
import { formatPrice } from '../../shared/lib/format.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { updateOrderStatus } from '../../shared/lib/orders.js';
import { buildAdminOrderSummaryMessage, waLink } from '../../shared/lib/whatsapp.js';
import { config } from '../../shared/lib/config.js';
import PrintLabel from './PrintLabel.jsx';

export default function OrderDetailModal({ isOpen, order, onClose, onStatusChanged }) {
  const showToast = useToast();

  if (!order) return null;

  const isPending = order.status === 'pending';
  const isDone = order.status === 'done';
  const isCancelled = order.status === 'cancelled';

  const items = Array.isArray(order.items) ? order.items : [];
  const customerWaUrl = waLink(order.customer_wa, buildAdminOrderSummaryMessage(order, config.storeName));

  async function changeStatus(newStatus) {
    const labelMap = { confirmed: 'Dikonfirmasi', done: 'Selesai', cancelled: 'Dibatalkan' };
    try {
      await updateOrderStatus(order.id, newStatus);
      showToast(`Pesanan ${labelMap[newStatus] || newStatus}`, 'success');
      onClose();
      await onStatusChanged();
    } catch (err) {
      showToast('Gagal ubah status: ' + err.message, 'error');
    }
  }

  function sendToWA() {
    window.open(customerWaUrl, '_blank');
  }

  function printLabel() {
    window.print();
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Pesanan ${order.order_number}`} boxClassName="order-detail-box">
        <div>
          <div className="order-detail-meta">
            <div className="order-detail-field"><span className="order-field-label">Nomor</span><span>{order.order_number}</span></div>
            <div className="order-detail-field"><span className="order-field-label">Nama</span><span>{order.customer_name}</span></div>
            <div className="order-detail-field"><span className="order-field-label">WhatsApp</span><span>{customerWaUrl ? <a href={customerWaUrl} target="_blank" rel="noreferrer">{order.customer_wa}</a> : order.customer_wa}</span></div>
            <div className="order-detail-field"><span className="order-field-label">Tipe</span><span>{order.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}</span></div>
            <div className="order-detail-field"><span className="order-field-label">Tanggal</span><span>{order.order_date_label || order.order_date}</span></div>
            {order.order_type === 'delivery' && order.delivery_address && (
              <div className="order-detail-field"><span className="order-field-label">Alamat</span><span>{order.delivery_address}</span></div>
            )}
            {order.note && (
              <div className="order-detail-field"><span className="order-field-label">Catatan</span><span>{order.note}</span></div>
            )}
          </div>

          <div className="order-detail-items">
            {items.map((it, i) => (
              <div className="order-detail-item" key={i}>
                <span>{it.nm}{it.vl?.length ? <span className="order-variant"> ({it.vl.join(', ')})</span> : null} ×{it.qty}</span>
                <span>{formatPrice(it.sub)}</span>
              </div>
            ))}
            <div className="order-detail-divider"></div>
            {order.discount_amount > 0 && (
              <div className="order-detail-row order-detail-discount">
                <span>Diskon ({order.promo_code || ''})</span>
                <span>−{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            {order.shipping_cost > 0 && (
              <div className="order-detail-row">
                <span>Ongkir{order.shipping_label ? ` (${order.shipping_label})` : ''}</span>
                <span>{formatPrice(order.shipping_cost)}</span>
              </div>
            )}
            <div className="order-detail-row order-detail-total">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="order-detail-actions">
          <button className="btn btn-secondary" onClick={onClose}>Tutup</button>
          {customerWaUrl && <button className="btn btn-wa" onClick={sendToWA}>WA Customer</button>}
          {!isPending && <button className="btn btn-outline" onClick={printLabel}>Print Label</button>}
          {!isCancelled && !isDone && <button className="btn btn-danger" onClick={() => changeStatus('cancelled')}>Batalkan</button>}
          {!isPending && !isDone && !isCancelled && <button className="btn btn-success" onClick={() => changeStatus('done')}>Selesai</button>}
          {isPending && <button className="btn btn-primary" onClick={() => changeStatus('confirmed')}>Konfirmasi</button>}
        </div>
      </Modal>

      <PrintLabel orders={order ? [order] : []} />
    </>
  );
}
