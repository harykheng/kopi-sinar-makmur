import { createPortal } from 'react-dom';
import { formatPrice } from '../../shared/lib/format.js';
import { config } from '../../shared/lib/config.js';

// Rendered via portal into #printLabel, a direct <body> child declared in
// admin/index.html, @media print in admin.css hides every other body child
// and only shows #printLabel, so this must NOT be nested inside #root.
// `orders` selalu array. Satu label dan sekumpulan label memakai jalur yang
// sama supaya tata letak cetaknya tidak bisa menyimpang antara keduanya.
export default function PrintLabel({ orders }) {
  const target = document.getElementById('printLabel');
  const list = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (!target || list.length === 0) return null;

  return createPortal(
    <>{list.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      return (
        <div className="print-label-inner" key={order.id || order.order_number}>
          <div className="print-label-brand">{config.storeName}</div>
          <div className="print-label-order">{order.order_number}</div>
          <div className="print-label-section">
            <strong>Untuk:</strong> {order.customer_name}<br />
            <strong>WA:</strong> {order.customer_wa}<br />
            <strong>Tipe:</strong> {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'}<br />
            <strong>Tanggal:</strong> {order.order_date_label || order.order_date}
            {order.delivery_address && <><br /><strong>Alamat:</strong> {order.delivery_address}</>}
            {order.note && <><br /><strong>Catatan:</strong> {order.note}</>}
          </div>
          <div className="print-label-items">
            {items.map((it, i) => (
              <div key={i}>{it.nm}{it.vl?.length ? ` (${it.vl.join(', ')})` : ''} ×{it.qty}</div>
            ))}
          </div>
          <div className="print-label-total"><strong>Total: {formatPrice(order.total)}</strong></div>
        </div>
      );
    })}</>,
    target
  );
}
