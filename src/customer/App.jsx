import { useEffect, useRef, useState } from 'react';
import { CartProvider, useCart } from './CartContext.jsx';
import { useSettings } from '../shared/hooks/useSettings.js';
import { useFavicon } from '../shared/hooks/useFavicon.js';
import { useToast } from '../shared/components/Toast.jsx';
import { config } from '../shared/lib/config.js';
import { trackVisit } from '../shared/lib/visits.js';
import { cartTotal, getDiscountAmount, cartFinalTotal, cartSnapshot, cartStockItems } from '../shared/lib/cart.js';
import { useCapacity } from '../shared/hooks/useCapacity.js';
import { findCapacityBlocker } from '../shared/lib/capacity.js';
import { qrisToDynamic } from '../shared/lib/qris.js';
import OrderTypeStep from './components/OrderTypeStep.jsx';
import CatalogStep from './components/CatalogStep.jsx';
import CheckoutStep from './components/CheckoutStep.jsx';
import VariantSheet from './components/VariantSheet.jsx';
import ProfileModal from './components/ProfileModal.jsx';
import QrisModal from './components/QrisModal.jsx';
import OrderSummaryModal from './components/OrderSummaryModal.jsx';

function AppShell() {
  const { state } = useCart();
  const { settings } = useSettings();
  const showToast = useToast();
  useFavicon(settings?.favicon_url);

  const [variantProduct, setVariantProduct] = useState(null);

  // Satu fetch buat tanggal yang dipilih, dipakai bareng katalog dan sheet
  // varian: dua-duanya harus membatasi dari angka yang sama, kalau dipanggil
  // sendiri-sendiri keduanya bisa melihat sisa slot yang berbeda.
  const { usage: capacityUsage, refetch: refetchCapacity } = useCapacity(state.selectedDate);
  const submittingRef = useRef(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Once per tab session, not once per render/refresh, a sessionStorage
  // flag survives React StrictMode's double-invoke in dev and keeps a
  // customer flipping between steps or refreshing from inflating the count.
  useEffect(() => {
    if (sessionStorage.getItem('ordi_visit_tracked_v1')) return;
    sessionStorage.setItem('ordi_visit_tracked_v1', '1');
    trackVisit();
  }, []);

  // Async karena kuota dicek ULANG ke server tepat sebelum QR dibuka, bukan
  // memakai angka yang sudah ada di layar. Bedanya mahal: di alur ini customer
  // memindai dan membayar DULU, order baru di-insert setelah dia menekan
  // konfirmasi. Kalau slotnya keburu diambil orang lain di sela itu,
  // place_order() menolak dengan KUOTA_HABIS setelah uangnya terlanjur
  // ditransfer. Satu round trip di sini jauh lebih murah daripada itu.
  //
  // Ini pemanggil ketiga yang boleh ada tanpa melanggar pola "jangan reaktif":
  // pemicunya tekan tombol bayar, sekali jalan, bukan useEffect yang mengawasi
  // keranjang.
  async function handleSubmitQris() {
    if (submittingRef.current) return;
    if (!state.isProfileFilled) {
      showToast('Isi detail pemesan dulu ya!', 'error');
      setProfileOpen(true);
      return;
    }
    if (state.orderType === 'delivery' && !state.profile.address) {
      showToast('Masukkan alamat pengiriman dulu ya!', 'error');
      setProfileOpen(true);
      return;
    }
    if (state.orderType === 'delivery' && state.shippingStatus === 'unavailable') {
      showToast('Alamat kamu di luar jangkauan delivery. Ongkir tidak tersedia.', 'error');
      return;
    }
    if (state.orderType === 'delivery' && !state.selectedShipping) {
      showToast('Pilih opsi ongkir dulu ya!', 'error');
      return;
    }

    submittingRef.current = true;
    try {
      const freshUsage = await refetchCapacity();
      const blocker = findCapacityBlocker(state.cart, freshUsage);
      if (blocker) {
        showToast(
          blocker.remaining > 0
            ? `${blocker.name} tinggal ${blocker.remaining} lagi untuk tanggal ini. Kurangi jumlahnya dulu ya!`
            : `${blocker.name} sudah penuh untuk tanggal ini. Ganti tanggal atau hapus dari keranjang ya!`,
          'error',
        );
        return;
      }
    } finally {
      submittingRef.current = false;
    }

    const rawTotal = cartTotal(state.cart);
    const discount = getDiscountAmount(state.cart, state.activePromo);
    const shippingCost = state.selectedShipping?.price || 0;
    const finalTotal = cartFinalTotal(state.cart, state.activePromo, state.selectedShipping);
    const orderNum = `${config.orderPrefix}-${Date.now().toString(36).toUpperCase().slice(-5)}`;

    let qrisString;
    try {
      qrisString = qrisToDynamic(config.qrisStatic, finalTotal);
    } catch (e) {
      console.error('QRIS generate error:', e);
      showToast('Gagal generate QR code', 'error');
      return;
    }

    setPendingOrder({
      orderNum,
      name: state.profile.name,
      wa: state.profile.wa,
      note: state.note,
      address: state.profile.address,
      addressNote: state.profile.addressNote,
      orderType: state.orderType,
      selectedDate: state.selectedDate,
      orderDateLabel: state.selectedDateLabel,
      rawTotal,
      discount,
      shippingCost,
      shippingLabel: state.selectedShipping?.label || null,
      finalTotal,
      promoCode: state.activePromo?.code || null,
      qrisString,
      cartSnapshot: cartSnapshot(state.cart),
      stockItems: cartStockItems(state.cart),
    });
  }

  function handleConfirmed(confirmed) {
    setPendingOrder(null);
    setConfirmedOrder(confirmed);
  }

  return (
    <>
      {state.step === 1 && <OrderTypeStep settings={settings} />}
      {state.step === 2 && <CatalogStep settings={settings} capacityUsage={capacityUsage} onPickVariant={setVariantProduct} />}
      {state.step === 3 && (
        <CheckoutStep
          settings={settings}
          onOpenProfile={() => setProfileOpen(true)}
          onSubmitQris={handleSubmitQris}
        />
      )}

      <VariantSheet product={variantProduct} capacityUsage={capacityUsage} onClose={() => setVariantProduct(null)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setProfileOpen(false)} />
      <QrisModal
        pendingOrder={pendingOrder}
        settings={settings}
        onClose={() => setPendingOrder(null)}
        onConfirmed={handleConfirmed}
      />
      <OrderSummaryModal
        order={confirmedOrder}
        settings={settings}
        onClose={() => setConfirmedOrder(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppShell />
    </CartProvider>
  );
}
