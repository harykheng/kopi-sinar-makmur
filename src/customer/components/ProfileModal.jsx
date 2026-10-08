import { useEffect, useRef, useState } from 'react';
import { useCart } from '../CartContext.jsx';
import { useShipping } from '../hooks/useShipping.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { cartCount, cartTotal } from '../../shared/lib/cart.js';
import { config } from '../../shared/lib/config.js';
import { onKeyActivate, useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';
import AddressPickerModal from './AddressPickerModal.jsx';
import ShippingLoadingOverlay from './ShippingLoadingOverlay.jsx';

export default function ProfileModal({ isOpen, onClose }) {
  const { state, dispatch } = useCart();
  const { calculate } = useShipping();
  const showToast = useToast();
  useBodyScrollLock(isOpen);

  const [name, setName] = useState(state.profile.name);
  const [wa, setWa] = useState(state.profile.wa);
  const [address, setAddress] = useState(state.profile.address);
  const [addressNote, setAddressNote] = useState(state.profile.addressNote);
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLng, setDeliveryLng] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isAddressPickerOpen, setAddressPickerOpen] = useState(false);
  const sheetRef = useRef(null);
  useDialogKeyboard({ active: isOpen && !isAddressPickerOpen, onClose, containerRef: sheetRef });

  // Re-sync local form state whenever the modal opens (so re-opening after save
  // shows the previously saved values, and reset after order completion clears it).
  useEffect(() => {
    if (isOpen) {
      setName(state.profile.name);
      setWa(state.profile.wa);
      setAddress(state.profile.address);
      setAddressNote(state.profile.addressNote);
      setDeliveryLat(state.profile.lat ?? null);
      setDeliveryLng(state.profile.lng ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleAddressConfirmed(label, lat, lng, note) {
    setAddress(label);
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    setAddressNote(note);
    setAddressPickerOpen(false);
  }

  function handleRemoveAddress() {
    setAddress('');
    setDeliveryLat(null);
    setDeliveryLng(null);
    setAddressNote('');
    dispatch({ type: 'CLEAR_SHIPPING' });
  }

  async function handleSave() {
    if (!name.trim()) { showToast('Nama wajib diisi!', 'error'); return; }
    if (!wa.trim())   { showToast('Nomor WhatsApp wajib diisi!', 'error'); return; }
    if (state.orderType === 'delivery' && !address.trim()) {
      showToast('Alamat pengiriman wajib diisi!', 'error');
      return;
    }

    // Address/coords always get set together by AddressPickerModal, so
    // there's no "resolve coords at save time" fallback needed anymore ,
    // if address is filled, deliveryLat/deliveryLng are already there too.
    if (state.orderType === 'delivery' && deliveryLat && deliveryLng) {
      setSaving(true);
      const weightGrams = cartCount(state.cart) * config.defaultItemWeightG;
      await calculate(deliveryLat, deliveryLng, weightGrams, cartTotal(state.cart));
      setSaving(false);
    }

    dispatch({
      type: 'SET_PROFILE',
      profile: {
        name: name.trim(), wa: wa.trim(), address: address.trim(), addressNote: addressNote.trim(),
        lat: state.orderType === 'delivery' ? deliveryLat : null,
        lng: state.orderType === 'delivery' ? deliveryLng : null,
      },
    });
    onClose();
  }

  return (
    <div className="profile-overlay" role="dialog" aria-modal="true" aria-label="Detail Pemesan" style={{ display: isOpen ? 'flex' : 'none' }} onClick={onClose}>
      <div className="profile-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <div className="profile-sheet-drag"></div>
        <div className="profile-sheet-inner">
          <div className="profile-sheet-header">
            <span className="profile-sheet-title">Detail Pemesan</span>
            <button className="profile-sheet-close" onClick={onClose} aria-label="Tutup">✕</button>
          </div>

          <div className="form-group">
            <label htmlFor="customerName">Nama *</label>
            <input type="text" id="customerName" placeholder="Nama kamu..." autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="customerWA">Nomor WhatsApp *</label>
            <input type="tel" id="customerWA" placeholder="08xxxxxxxxxx" autoComplete="tel" value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>

          {state.orderType === 'delivery' && (
            <div className="form-group">
              <label>Alamat Pengiriman *</label>
              {address ? (
                <div
                  className="address-summary-card"
                  onClick={() => setAddressPickerOpen(true)}
                  onKeyDown={onKeyActivate(() => setAddressPickerOpen(true))}
                  role="button"
                  tabIndex={0}
                >
                  <div className="address-summary-text">
                    <div>{address}</div>
                    {addressNote && <div className="address-summary-note">{addressNote}</div>}
                  </div>
                  <button
                    type="button"
                    className="address-summary-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAddress(); }}
                    aria-label="Hapus alamat"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button type="button" className="address-summary-empty" onClick={() => setAddressPickerOpen(true)}>
                  Tap untuk pilih alamat
                </button>
              )}
            </div>
          )}

          <button className="btn-profile-save" id="btnSaveProfile" onClick={handleSave} disabled={saving} style={{ marginBottom: 8 }}>
            {saving ? 'Mengecek ongkir…' : 'Simpan'}
          </button>
        </div>
      </div>
      <ShippingLoadingOverlay show={saving} />
      <AddressPickerModal
        isOpen={isAddressPickerOpen}
        onClose={() => setAddressPickerOpen(false)}
        onConfirm={handleAddressConfirmed}
        initialAddress={address}
        initialNote={addressNote}
      />
    </div>
  );
}
