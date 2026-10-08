import { useCart } from '../CartContext.jsx';
import { formatPrice } from '../../shared/lib/format.js';

export default function OngkirOptions() {
  const { state, dispatch } = useCart();
  const { shippingStatus, shippingOptions, shippingStaticKm, selectedShipping } = state;

  if (shippingStatus === 'idle') return <div style={{ marginTop: 10 }}></div>;

  if (shippingStatus === 'loading') {
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ongkir-loading"><span className="spinner-sm"></span> Mengecek ongkir…</div>
      </div>
    );
  }

  if (shippingStatus === 'unavailable') {
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ongkir-unavailable">
          <div>
            <strong>Di luar jangkauan delivery</strong>
            <div>{shippingStaticKm?.toFixed(1)} km dari toko, maksimal 10 km</div>
          </div>
        </div>
      </div>
    );
  }

  if (shippingStatus === 'static') {
    return (
      <div style={{ marginTop: 10 }}>
        <div className="ongkir-static-result">
          <div className="ongkir-left">
            <div className="ongkir-courier">Ongkos Kirim</div>
            <div className="ongkir-eta">{shippingStaticKm?.toFixed(1)} km dari toko</div>
          </div>
          <div className="ongkir-price">{formatPrice(selectedShipping?.price || 0)}</div>
        </div>
      </div>
    );
  }

  // shippingStatus === 'options'
  return (
    <div style={{ marginTop: 10 }}>
      <div className="ongkir-options-list">
        {shippingOptions.map((o, i) => {
          const isSelected = selectedShipping?.label === `${o.courierName} - ${o.serviceName}`;
          return (
            <button
              type="button"
              key={`${o.courierCode}-${o.serviceName}`}
              className={`ongkir-option-item${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => dispatch({ type: 'SELECT_SHIPPING_OPTION', index: i })}
            >
              <div className="ongkir-left">
                <div className="ongkir-courier">{o.courierName} · {o.serviceName}</div>
                <div className="ongkir-eta">{o.duration || ''}</div>
              </div>
              <div className="ongkir-price">{formatPrice(o.price)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
