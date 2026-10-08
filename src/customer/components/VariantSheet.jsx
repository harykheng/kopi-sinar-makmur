import { useEffect, useRef, useState } from 'react';
import { formatPrice, productInitial } from '../../shared/lib/format.js';
import { useCart } from '../CartContext.jsx';
import { useToast } from '../../shared/components/Toast.jsx';
import { getProductCartQty } from '../../shared/lib/cart.js';
import { productLimit } from '../../shared/lib/capacity.js';
import { useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';

export default function VariantSheet({ product, capacityUsage, onClose }) {
  const { state, dispatch } = useCart();
  const showToast = useToast();
  const [selected, setSelected] = useState({}); // { groupName: { label, price } }
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setSelected({});
    setQty(1);
  }, [product]);

  const isOpen = Boolean(product);
  const sheetRef = useRef(null);
  useDialogKeyboard({ active: isOpen, onClose, containerRef: sheetRef });
  const groups = product?.variants || [];
  const extra = Object.values(selected).reduce((s, v) => s + v.price, 0);
  const total = product ? (product.price + extra) * qty : 0;

  // Stock and daily capacity are both tracked per product, not per variant, so
  // cap by whichever is tighter, minus whatever's already sitting in the cart
  // across other variants of this product.
  const alreadyInCart = product ? getProductCartQty(state.cart, product.id) : 0;
  const limit = product ? productLimit(product, capacityUsage) : Infinity;
  const maxQty = limit === Infinity ? 20 : Math.max(0, Math.min(20, limit - alreadyInCart));

  function selectChip(groupName, option) {
    setSelected((prev) => ({ ...prev, [groupName]: { label: option.label, price: option.price || 0 } }));
  }

  function changeQty(delta) {
    setQty((q) => Math.max(1, Math.min(maxQty, q + delta)));
  }

  function confirmAdd() {
    if (maxQty <= 0) {
      showToast('Sisa yang bisa dipesan untuk produk ini sudah masuk semua ke keranjang kamu!', 'error');
      return;
    }
    for (const g of groups) {
      if (!selected[g.name]) {
        showToast(`Pilih ${g.name} dulu ya!`, 'error');
        return;
      }
    }
    const variantLabels = groups.map((g) => selected[g.name].label);
    const cartKey = variantLabels.length ? `${product.id}|${variantLabels.join('|')}` : product.id;
    const extraPrice = Object.values(selected).reduce((s, v) => s + v.price, 0);

    dispatch({ type: 'ADD_TO_CART', key: cartKey, product, qty, variantLabels, extraPrice });
    onClose();
  }

  return (
    <div
      className={`variant-overlay${isOpen ? ' active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pilih Varian"
      onClick={onClose}
    >
      <div className="variant-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="variant-sheet-drag"></div>

        <div className="variant-sheet-header">
          <div className="variant-sheet-product">
            <div className="variant-sheet-img-wrap">
              {product?.image_url ? (
                <img className="variant-sheet-img" src={product.image_url} alt={product.name} />
              ) : (
                <span className="variant-sheet-img-ph" aria-hidden="true">{productInitial(product?.name)}</span>
              )}
            </div>
            <div className="variant-sheet-info">
              <div className="variant-sheet-name">{product?.name}</div>
              <div className="variant-sheet-price">{product ? formatPrice(product.price) : ''}</div>
            </div>
          </div>
          <button className="variant-sheet-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="variant-sheet-body">
          {groups.map((group) => (
            <div className="vs-group" key={group.name}>
              <div className="vs-group-name">{group.name}</div>
              <div className="vs-chips">
                {group.options.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`vs-chip${selected[group.name]?.label === opt.label ? ' selected' : ''}`}
                    onClick={() => selectChip(group.name, opt)}
                  >
                    {opt.label}{opt.price > 0 ? ` +${formatPrice(opt.price)}` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="variant-sheet-footer">
          {product?.stock_qty != null && (
            <div className="vs-stock-hint">
              {maxQty <= 0 ? 'Stok produk ini habis' : `Sisa stok: ${maxQty}`}
            </div>
          )}
          <div className="vs-qty-row">
            <span className="vs-qty-label">Jumlah</span>
            <div className="vs-qty-ctrl">
              <button className="qty-btn minus" onClick={() => changeQty(-1)} aria-label="Kurangi">−</button>
              <span className="qty-display">{qty}</span>
              <button
                className={`qty-btn plus${qty >= maxQty ? ' minus-disabled' : ''}`}
                onClick={() => changeQty(1)}
                aria-label="Tambah"
                disabled={qty >= maxQty}
              >
                +
              </button>
            </div>
          </div>
          <button className="btn btn-primary vs-add-btn" onClick={confirmAdd} disabled={maxQty <= 0}>
            {maxQty <= 0 ? 'Stok Habis' : `Tambah ke Keranjang · ${formatPrice(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
