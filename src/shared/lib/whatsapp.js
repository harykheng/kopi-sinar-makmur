import { formatPrice } from './format.js';

export function escapeTextForWA(str) {
  return (str || '').replace(/[*_~`]/g, '\\$&');
}

// Returns null when no number is configured, so callers hide the control
// rather than render a link to wa.me/undefined (R-26).
export function waLink(phone, message) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Message sent to the admin after a customer confirms QRIS payment
// (ported from confirmQrisPayment in the old catalog.js).
export function buildQrisConfirmMessage({
  storeName, orderNum, cartSnapshot, rawTotal, discount, promoCode,
  shippingCost, shippingLabel, finalTotal, name, wa, orderType,
  orderDateLabel, address, addressNote, note,
}) {
  const typeLabel = orderType === 'pickup' ? 'Pickup' : 'Delivery';

  let msg = `Halo *${storeName}*! 😊\n\n`;
  msg += `✅ Saya sudah bayar via QRIS untuk pesanan berikut:\n\n`;
  msg += `*Pesanan #${orderNum}:*\n`;
  cartSnapshot.forEach((it, i) => {
    const v = it.vl?.length ? ` (${it.vl.join(', ')})` : '';
    msg += `${i + 1}. ${it.nm}${v} ×${it.qty}: ${formatPrice(it.sub)}\n`;
  });
  msg += `\nSubtotal: ${formatPrice(rawTotal)}\n`;
  if (discount > 0) {
    msg += `Diskon (${promoCode}): −${formatPrice(discount)}\n`;
  }
  if (shippingCost > 0) {
    msg += `Ongkir (${shippingLabel}): ${formatPrice(shippingCost)}\n`;
  }
  msg += `*Total: ${formatPrice(finalTotal)}*\n\n`;
  msg += `---\n`;
  msg += `Nama: ${name}\n`;
  msg += `WhatsApp: ${wa}\n`;
  msg += `Tipe: ${typeLabel}\n`;
  msg += `Tanggal: ${orderDateLabel}\n`;
  if (orderType === 'delivery') {
    msg += `Alamat: ${address}\n`;
    if (addressNote) msg += `Catatan alamat: ${addressNote}\n`;
    if (shippingLabel) msg += `Kurir: ${shippingLabel}\n`;
  }
  if (note) msg += `Catatan: ${note}\n`;

  return msg;
}

export const ORDER_STATUS_LABELS = {
  pending:   'Menunggu Konfirmasi',
  confirmed: 'Diproses',
  done:      'Selesai',
  cancelled: 'Dibatalkan',
};

// Message the admin sends to a customer summarizing their order
// (ported from sendOrderSummaryToWA in the old admin.js).
export function buildAdminOrderSummaryMessage(order, storeName) {
  const items = Array.isArray(order.items) ? order.items : [];

  let msg = `Halo *${escapeTextForWA(order.customer_name)}*! 👋\n\n`;
  msg += `Berikut ringkasan pesanan kamu di *${storeName}*:\n\n`;
  msg += `📦 *#${order.order_number}*\n`;
  msg += `🗓 ${order.order_date_label || order.order_date}\n`;
  msg += `${order.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}\n\n`;

  msg += `*Pesanan:*\n`;
  items.forEach((it, i) => {
    const v = it.vl?.length ? ` (${it.vl.join(', ')})` : '';
    msg += `${i + 1}. ${it.nm}${v} ×${it.qty}: ${formatPrice(it.sub)}\n`;
  });

  msg += `\n`;
  if (order.discount_amount > 0) {
    const subtotal = order.subtotal || (order.total + order.discount_amount - (order.shipping_cost || 0));
    msg += `Subtotal: ${formatPrice(subtotal)}\n`;
    msg += `Diskon (${order.promo_code}): −${formatPrice(order.discount_amount)}\n`;
  }
  if (order.shipping_cost > 0) {
    msg += `Ongkir${order.shipping_label ? ` (${order.shipping_label})` : ''}: ${formatPrice(order.shipping_cost)}\n`;
  }
  msg += `*Total: ${formatPrice(order.total)}*\n`;

  if (order.order_type === 'delivery' && order.delivery_address) {
    msg += `\nAlamat: ${order.delivery_address}`;
  }
  if (order.note) {
    msg += `\nCatatan: ${order.note}`;
  }

  msg += `\n\nStatus: ${ORDER_STATUS_LABELS[order.status] || order.status}`;
  msg += `\n\nTerima kasih sudah order di ${storeName}!`;

  return msg;
}
