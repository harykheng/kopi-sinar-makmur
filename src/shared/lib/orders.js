import { supabase } from './supabaseClient.js';

// Goes through place_order() (a Postgres function), not a plain insert ,
// it decrements each item's stock_qty and inserts the order in one atomic
// transaction, so two customers can't both succeed ordering the last unit
// of something. See supabase-setup.sql §6 for the function itself.
// stockItems: [{ product_id, qty }], see cartStockItems() in cart.js.
export async function insertOrder(payload, stockItems) {
  const { error } = await supabase.rpc('place_order', { order_data: payload, stock_items: stockItems });
  if (error) throw error;
}

// Pembatalan lewat cancel_order(), status lain lewat update biasa.
//
// Bukan karena rapi, tapi karena membatalkan pesanan harus MENGEMBALIKAN
// products.stock_qty yang sudah dikurangi place_order(). Update kolom status
// dari browser tidak bisa melakukannya (anon maupun admin tidak pernah
// menyentuh stock_qty langsung), dan sebelum ini stok memang hangus permanen
// tiap ada pembatalan. Function-nya idempoten, jadi klik dua kali tidak
// menambah stok dua kali. Lihat supabase-setup.sql §7.
export async function updateOrderStatus(orderId, newStatus) {
  if (newStatus === 'cancelled') {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

// Used by /tracking/, orders has no anon SELECT policy (see CLAUDE.md), so
// this goes through lookup_order() instead of a plain query: it only ever
// returns a row when BOTH order_number and customer_wa match, closing off
// scanning the table for other customers' orders. See supabase-setup.sql §7.
export async function lookupOrder(orderNumber, customerWa) {
  const { data, error } = await supabase.rpc('lookup_order', {
    p_order_number: orderNumber,
    p_customer_wa: customerWa,
  });
  if (error) throw error;
  return data?.[0] || null;
}
