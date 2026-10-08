// Per-date production recap: "what do I have to make on this date, how much of
// it". The Orders tab answers "which orders need confirming" but never that,
// even though every order already carries the date it is wanted for.
//
// All pure functions over the rows useOrders() has already fetched, there is no
// new query, table or aggregate in Supabase behind any of this.

import { todayKey } from './format.js';

// Orders the kitchen still has to plan for. Deliberately different from
// REVENUE_STATUSES in DashboardTab: there 'pending' is excluded because the
// customer only claims to have paid, here it is included because an unverified
// order is still work that may land. Only 'cancelled' drops out.
const PRODUCTION_STATUSES = ['pending', 'confirmed', 'done'];

export function isProductionOrder(order) {
  return PRODUCTION_STATUSES.includes(order?.status);
}

// orders.order_date is a DATE column, so PostgREST hands it over already
// formatted as 'YYYY-MM-DD'. The slice guards against a full timestamp sneaking
// in from an older row.
export function orderDateKey(order) {
  return String(order?.order_date || '').slice(0, 10);
}

// Distinct dates that have orders, upcoming ones first (ascending, because a
// shop works forward), past ones after that with the most recent first. Without
// that split, a shop with months of history would have to scroll past all of it
// to reach tomorrow.
export function buildOrderDateOptions(orders) {
  const counts = new Map();
  (orders || []).filter(isProductionOrder).forEach((order) => {
    const key = orderDateKey(order);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const today = todayKey();
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, isPast: key < today }))
    .sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      return a.isPast ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
    });
}

// Totals every item ordered for one date, grouped per product and broken down
// per variant combination.
//
// Grouped by `nm`, not by the `pid` that cartSnapshot() now records, because
// this is the list a shop owner reads while working and rows written before
// `pid` existed have no id at all: keying on `pid || nm` would print the same
// product twice, once for the old rows and once for the new. `pid` is there for
// the capacity check, which runs in Postgres over new rows only and needs an id
// a rename cannot break.
export function buildProductionRecap(orders, dateKey) {
  const dayOrders = (orders || []).filter(
    (order) => isProductionOrder(order) && orderDateKey(order) === dateKey,
  );

  const byName = new Map();
  let itemCount = 0;

  dayOrders.forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item) => {
      const name = String(item?.nm || '').trim() || 'Tanpa nama';
      const qty = Number(item?.qty) || 0;
      if (qty <= 0) return;
      itemCount += qty;

      const row = byName.get(name) || { name, qty: 0, variants: new Map() };
      row.qty += qty;

      const variantLabel = Array.isArray(item?.vl) ? item.vl.filter(Boolean).join(', ') : '';
      if (variantLabel) {
        row.variants.set(variantLabel, (row.variants.get(variantLabel) || 0) + qty);
      }
      byName.set(name, row);
    });
  });

  const rows = [...byName.values()]
    .map((row) => ({
      name: row.name,
      qty: row.qty,
      variants: [...row.variants.entries()]
        .map(([label, qty]) => ({ label, qty }))
        .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

  return {
    rows,
    itemCount,
    orderCount: dayOrders.length,
    pendingCount: dayOrders.filter((order) => order.status === 'pending').length,
  };
}
