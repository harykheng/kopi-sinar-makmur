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
  // Grouped per courier (Grab, Paxel, ...) in the order Biteship returned them.
  // Each entry keeps its index into shippingOptions, SELECT_SHIPPING_OPTION
  // still selects by that original index.
  const groups = [];
  shippingOptions.forEach((o, i) => {
    let group = groups.find((g) => g.name === o.courierName);
    if (!group) {
      group = { name: o.courierName, items: [] };
      groups.push(group);
    }
    group.items.push({ ...o, index: i });
  });

  return (
    <div style={{ marginTop: 10 }}>
      <div className="ongkir-options-title">Pilih opsi pengiriman</div>
      {groups.map((g) => (
        <div className="ongkir-group" key={g.name} role="group" aria-label={g.name}>
          <div className="ongkir-group-label">{g.name}</div>
          <div className="ongkir-options-list">
            {g.items.map((o) => {
              const isSelected = selectedShipping?.label === `${o.courierName} - ${o.serviceName}`;
              return (
                <button
                  type="button"
                  key={`${o.courierCode}-${o.serviceName}`}
                  className={`ongkir-option-item${isSelected ? ' selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => dispatch({ type: 'SELECT_SHIPPING_OPTION', index: o.index })}
                >
                  <div className="ongkir-left">
                    <div className="ongkir-courier">{o.serviceName}</div>
                    <div className="ongkir-eta">{o.duration || ''}</div>
                  </div>
                  <div className="ongkir-price">{formatPrice(o.price)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
