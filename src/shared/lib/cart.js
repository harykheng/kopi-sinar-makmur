// Pure cart math, ported from js/catalog.js. cart is keyed by productId
// (plain product) or `productId|Var1|Var2` (variant combo).

export function cartCount(cart) {
  return Object.values(cart).reduce((s, { qty }) => s + qty, 0);
}

export function cartTotal(cart) {
  return Object.values(cart).reduce((s, { product, qty, extraPrice = 0 }) => s + (product.price + extraPrice) * qty, 0);
}

export function getDiscountAmount(cart, activePromo) {
  if (!activePromo) return 0;
  const raw = cartTotal(cart);
  if (activePromo.discount_type === 'percent') {
    return Math.round(raw * activePromo.discount_value / 100);
  }
  return Math.min(activePromo.discount_value, raw);
}

export function cartFinalTotal(cart, activePromo, selectedShipping) {
  return Math.max(0, cartTotal(cart) - getDiscountAmount(cart, activePromo) + (selectedShipping?.price || 0));
}

export function getProductCartQty(cart, productId) {
  return Object.entries(cart)
    .filter(([k]) => k === productId || k.startsWith(productId + '|'))
    .reduce((s, [, v]) => s + v.qty, 0);
}

// Serializes the cart into the shape stored in orders.items / used in WA messages.
//
// `pid` is the product id, carried alongside the display fields so anything that
// aggregates sold items per product (the per-date production recap in the admin
// Orders tab, and the per-date capacity check that will read these rows from
// Postgres) has a key that survives a rename. Matching on `nm` alone silently
// splits a product into two the moment the shop edits its name. Rows written
// before this field existed simply don't have it, so every reader must treat it
// as optional, display grouping still keys on `nm` for that reason.
export function cartSnapshot(cart) {
  return Object.values(cart).map(({ product, qty, variantLabels, extraPrice = 0 }) => ({
    pid: product.id,
    nm: product.name,
    qty,
    vl: variantLabels || [],
    up: product.price + (extraPrice || 0),
    sub: (product.price + (extraPrice || 0)) * qty,
  }));
}

// product_id + qty per cart line, for place_order()'s atomic stock check ,
// separate from cartSnapshot because that's a display-only shape without
// product ids. Different variants of the same product become separate
// entries (same product_id, split qty); place_order() decrements them
// sequentially against the same stock_qty, so the total is still enforced
// correctly even though it's not pre-summed here.
export function cartStockItems(cart) {
  return Object.values(cart).map(({ product, qty }) => ({ product_id: product.id, qty }));
}
