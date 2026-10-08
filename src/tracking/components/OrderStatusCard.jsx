import { formatPrice, productInitial } from '../../shared/lib/format.js';
import { ORDER_STATUS_LABELS } from '../../shared/lib/whatsapp.js';

export default function OrderStatusCard({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;

  return (
    <div className="trk-card">
      <div className={`trk-status-badge trk-status-${order.status}`}>{statusLabel}</div>

      <div className="trk-card-header">
        <div className="trk-order-number">#{order.order_number}</div>
        <div className="trk-order-date">{order.order_date_label || order.order_date}</div>
      </div>

      <div className="trk-meta">
        <div className="trk-meta-row">
          <span className="trk-meta-label">Tipe</span>
          <span>{order.order_type === 'pickup' ? '🏠 Pickup' : '🛵 Delivery'}</span>
        </div>
        {order.order_type === 'delivery' && order.delivery_address && (
          <div className="trk-meta-row">
            <span className="trk-meta-label">Alamat</span>
            <span>{order.delivery_address}</span>
          </div>
        )}
        {order.shipping_label && (
          <div className="trk-meta-row">
            <span className="trk-meta-label">Kurir</span>
            <span>{order.shipping_label}</span>
          </div>
        )}
        {order.note && (
          <div className="trk-meta-row">
            <span className="trk-meta-label">Catatan</span>
            <span>{order.note}</span>
          </div>
        )}
      </div>

      <div className="trk-items">
        {items.map((it, i) => (
          <div className="co-item" key={i}>
            <div className="co-item-img co-item-img-ph" aria-hidden="true">{productInitial(it.nm)}</div>
            <div className="co-item-info">
              <div className="co-item-name">{it.nm}</div>
              {it.vl?.length > 0 && <div className="co-item-variants">{it.vl.join(' · ')}</div>}
              <div className="co-item-qty">× {it.qty}</div>
            </div>
            <div className="co-item-price">{formatPrice(it.sub)}</div>
          </div>
        ))}
      </div>

      <div className="trk-totals">
        {(order.discount_amount > 0 || order.shipping_cost > 0) && (
          <div className="trk-total-line"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
        )}
        {order.discount_amount > 0 && (
          <div className="trk-total-line"><span>Diskon{order.promo_code ? ` (${order.promo_code})` : ''}</span><span>−{formatPrice(order.discount_amount)}</span></div>
        )}
        {order.shipping_cost > 0 && (
          <div className="trk-total-line"><span>Ongkir</span><span>{formatPrice(order.shipping_cost)}</span></div>
        )}
        <div className="trk-total-line trk-grand-total"><span>Total</span><span>{formatPrice(order.total)}</span></div>
      </div>
    </div>
  );
}
