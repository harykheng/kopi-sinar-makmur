// Hitungan sisa slot, pure function seperti cart.js. Yang mengambil datanya ke
// Supabase ada di shared/hooks/useCapacity.js.
//
// products.daily_capacity adalah batas yang ditetapkan toko untuk SATU tanggal
// pengambilan. Berapa yang sudah terpakai tidak disimpan di mana pun, melainkan
// dihitung dari tabel orders (get_capacity_usage(), supabase-setup.sql §7), dan
// itulah yang bikin pesanan batal atau pending kedaluwarsa melepas slotnya
// sendiri.

// Infinity kalau produknya tidak dibatasi, supaya pemanggil bisa langsung
// Math.min() dengan batas stok tanpa cabang khusus.
export function remainingCapacity(product, usage) {
  if (product?.daily_capacity == null) return Infinity;
  const used = usage?.get(product.id) || 0;
  return Math.max(0, product.daily_capacity - used);
}

// Batas efektif berapa banyak produk ini boleh ada di keranjang: yang paling
// ketat antara stok (angka global yang berkurang permanen) dan kuota tanggal
// yang sedang dipilih (yang penuh lagi tiap ganti tanggal).
export function productLimit(product, usage) {
  const stockLimit = product?.stock_qty == null ? Infinity : product.stock_qty;
  return Math.min(stockLimit, remainingCapacity(product, usage));
}

// Produk pertama di keranjang yang sudah tidak muat lagi di kuota tanggal yang
// dipilih, atau null kalau semuanya masih muat.
//
// Dijumlahkan per produk dulu, bukan per baris keranjang: dua varian produk
// yang sama masing-masing 3 buah itu 6 terhadap kuota yang sama, dan memeriksa
// baris per baris akan meloloskan keduanya terhadap sisa 5. Alasannya sama
// persis dengan kenapa place_order() mengagregasi stock_items sebelum
// memeriksa kuota.
export function findCapacityBlocker(cart, usage) {
  const byProduct = new Map();
  Object.values(cart || {}).forEach(({ product, qty }) => {
    if (!product?.id) return;
    const entry = byProduct.get(product.id) || { product, qty: 0 };
    entry.qty += qty;
    byProduct.set(product.id, entry);
  });

  for (const { product, qty } of byProduct.values()) {
    const left = remainingCapacity(product, usage);
    if (qty > left) return { name: product.name, remaining: left, wanted: qty };
  }
  return null;
}
