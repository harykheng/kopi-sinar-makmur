import { useState } from 'react';
import { formatPrice, productInitial } from '../../shared/lib/format.js';
import { getProductCartQty } from '../../shared/lib/cart.js';
import { productLimit, remainingCapacity } from '../../shared/lib/capacity.js';
import { useCart } from '../CartContext.jsx';

export default function ProductCard({ product, index, capacityUsage, onPickVariant }) {
  const { state, dispatch } = useCart();
  const [imgError, setImgError] = useState(false);
  const hasVariants = product.variants && product.variants.length > 0;
  const qty = hasVariants
    ? getProductCartQty(state.cart, product.id)
    : (state.cart[product.id]?.qty || 0);

  const stockQty = product.stock_qty;
  const slotsLeft = remainingCapacity(product, capacityUsage);

  // Batas efektif: yang paling ketat antara stok (angka global) dan kuota untuk
  // tanggal yang dipilih. `remaining` di bawah itu sisa yang masih boleh
  // ditambahkan, jadi sudah dikurangi isi keranjang sekarang.
  const limit = productLimit(product, capacityUsage);
  const isSoldOut = limit <= 0;
  const remaining = limit - qty;

  // Dua sebab kehabisan, dua kata yang berbeda: "Habis" berarti barangnya tidak
  // ada, "Penuh" berarti tanggal inilah yang sudah penuh dan tanggal lain masih
  // bisa. Menyamakan keduanya bikin customer menyerah padahal cuma perlu geser
  // tanggal.
  const soldOutLabel = stockQty != null && stockQty <= 0 ? 'Habis' : 'Penuh';

  // Sisa slot ditampilkan tiap kali tokonya memang menetapkan kuota, bukan cuma
  // saat tinggal sedikit: angka itu sendiri yang memberi tahu customer bahwa
  // toko ini jalan per tanggal, tanpa perlu paragraf penjelasan. Sisa stok tetap
  // pakai ambang lama, karena stok bukan penanda cara kerja toko.
  //
  // Angkanya ikut turun saat produk masuk keranjang, dan hilang begitu habis.
  // Menampilkan sisa slot toko apa adanya (tanpa dikurangi isi keranjang) lebih
  // akurat secara harfiah, tapi di kartu yang tombol tambahnya sudah mati,
  // "Sisa 3 slot" terbaca sebagai kontradiksi. Yang ditanya customer di sini
  // bukan "toko ini sisa berapa" tapi "saya masih boleh nambah berapa".
  const hint = isSoldOut ? null
    : slotsLeft !== Infinity && slotsLeft <= (stockQty == null ? Infinity : stockQty)
      ? (remaining > 0 ? `Sisa ${remaining} slot` : null)
    : stockQty != null && stockQty <= 5 ? `Sisa ${stockQty}`
    : null;

  function updateQty(delta) {
    const next = Math.max(0, Math.min(qty + delta, limit));
    dispatch({ type: 'SET_CART_QTY', key: product.id, product, qty: next });
  }

  return (
    <div className={`product-card${isSoldOut ? ' product-card-oos' : ''}`}>
      {isSoldOut && <div className="product-badge badge-oos">{soldOutLabel}</div>}
      {!isSoldOut && product.is_bestseller && <div className="product-badge badge-bestseller">Terlaris</div>}
      {!isSoldOut && !product.is_bestseller && product.is_new && <div className="product-badge badge-new">Baru</div>}

      <div className="product-image-wrap">
        {product.image_url && !imgError ? (
          <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <span className="product-image-placeholder" aria-hidden="true">{productInitial(product.name)}</span>
        )}
      </div>

      <div className="product-info">
        <div className="product-name">{product.name}</div>
        {product.description && <div className="product-desc">{product.description}</div>}
        <div className="product-price">{formatPrice(product.price)}</div>
        {hint && <div className="product-stock-hint">{hint}</div>}
      </div>

      {isSoldOut ? (
        <div className="product-controls">
          <button className="btn-pick-variant" disabled>{soldOutLabel}</button>
        </div>
      ) : hasVariants ? (
        <div className="product-controls">
          <button className="btn-pick-variant" onClick={() => onPickVariant(product)} disabled={remaining <= 0}>
            {qty > 0 && <span className="vbadge" style={{ display: 'flex' }}>{qty}</span>}
            {remaining <= 0 ? 'Maks tercapai' : 'Pilih'}
          </button>
        </div>
      ) : (
        <div className="product-controls">
          <button
            className={`qty-btn minus${qty === 0 ? ' minus-disabled' : ''}`}
            onClick={() => updateQty(-1)}
            aria-label="Kurangi"
          >
            −
          </button>
          <span className="qty-display">{qty}</span>
          <button
            className={`qty-btn plus${remaining <= 0 ? ' minus-disabled' : ''}`}
            onClick={() => updateQty(1)}
            aria-label="Tambah"
            disabled={remaining <= 0}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
