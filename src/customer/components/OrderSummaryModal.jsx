import { useRef, useState } from 'react';
import { useCart } from '../CartContext.jsx';
import { formatPrice } from '../../shared/lib/format.js';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock.js';
import { useDialogKeyboard } from '../../shared/hooks/useDialogKeyboard.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { config } from '../../shared/lib/config.js';
import QrisViewModal from './QrisViewModal.jsx';

export default function OrderSummaryModal({ order, settings, onClose }) {
  const { dispatch } = useCart();
  const isOpen = Boolean(order);
  useBodyScrollLock(isOpen);
  const showToast = useToast();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const scrollRef = useRef(null);
  useDialogKeyboard({ active: isOpen && !showQr, onClose: handleClose, containerRef: scrollRef });

  if (!order) return null;

  const storeName = settings?.brand_name || config.storeName;
  const storeAddress = settings?.store_address || config.storeAddress;
  const storeMapsUrl = settings?.store_maps_url || config.storeMapsUrl;
  const storeOpenHours = settings?.store_hours || config.storeOpenHours;

  function sendWhatsAppProof() {
    window.open(order.waUrl, '_blank');
    dispatch({ type: 'RESET_ORDER' });
    onClose();
    showToast('Pesanan dikonfirmasi! Kirim bukti bayar via WA ya', 'success');
  }

  function copyOrderCode() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(order.orderNum).then(() => {
        showToast('Kode pesanan disalin!', 'success');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function handleClose() {
    dispatch({ type: 'RESET_ORDER' });
    onClose();
  }

  const deliveryRows = order.orderType === 'delivery' && order.address
    ? [
        ['Dari', <a key="maps" href={storeMapsUrl} target="_blank" rel="noopener" style={{ color: '#a05230', wordBreak: 'break-all' }}>{storeAddress}</a>],
        ['Penerima', order.name],
        ['Telepon', order.wa],
        ['Alamat', order.address],
        ...(order.addressNote ? [['Catatan alamat', order.addressNote]] : []),
        ...(order.shippingLabel ? [['Kurir', order.shippingLabel]] : []),
        ['Tanggal', order.orderDateLabel],
      ]
    : order.orderType === 'pickup'
    ? [
        ['Toko', storeName],
        ['Alamat', <a key="maps" href={storeMapsUrl} target="_blank" rel="noopener" style={{ color: '#a05230', wordBreak: 'break-all' }}>{storeAddress}</a>],
        ['Jam Buka', storeOpenHours],
        ['Tanggal', order.orderDateLabel],
      ]
    : [];

  return (
    <div className="oss-overlay" style={{ display: isOpen ? 'flex' : 'none' }} role="dialog" aria-modal="true" aria-label="Ringkasan Pesanan">
      <div className="oss-scroll" ref={scrollRef}>
        <div className="oss-topbar">
          <button className="oss-close" onClick={handleClose} aria-label="Tutup">✕</button>
        </div>

        <div className="oss-header">
          <h2 className="oss-title">Satu langkah lagi!</h2>
          <p className="oss-subtitle">
            Pesanan <strong>#{order.orderNum}</strong> belum kami proses sampai kamu kirim <strong>foto bukti pembayaran QRIS</strong> via WhatsApp.
          </p>
        </div>

        <div className="oss-warning">
          <span>⚠️</span> Wajib: kirim foto bukti pembayaran, kalau tidak pesanan belum kami proses.
        </div>

        {order.waUrl ? (
          <button className="btn-oss-wa" onClick={sendWhatsAppProof}>
            Kirim Bukti Transfer via WhatsApp
          </button>
        ) : (
          <div className="oss-wa-missing">
            Nomor WhatsApp toko belum diatur, jadi bukti transfer belum bisa dikirim dari sini.
            Hubungi {storeName} langsung dan sebutkan kode pesanan di bawah.
          </div>
        )}

        <button className="btn-oss-qr" onClick={() => setShowQr(true)}>
          Tampilkan QR lagi
        </button>

        <div className="oss-card">
          <div className="oss-card-label">Kode pesanan</div>
          <div className="oss-code-row">
            <div className="oss-code">{order.orderNum}</div>
            <button className="btn-oss-copy" onClick={copyOrderCode}>{copied ? 'Disalin' : 'Salin'}</button>
          </div>
          <a className="oss-track-link" href={`/tracking/?order=${encodeURIComponent(order.orderNum)}`} target="_blank" rel="noopener noreferrer">
            Simpan kode ini buat lacak status pesanan kapan aja
          </a>
        </div>

        {deliveryRows.length > 0 && (
          <div className="oss-section">
            <div className="oss-section-header">
              {order.orderType === 'delivery' ? 'Pengiriman' : 'Lokasi pickup'}
            </div>
            <div>
              {deliveryRows.map(([label, value]) => (
                <div className="oss-row" key={label}>
                  <span className="oss-row-label">{label}</span>
                  <span className="oss-row-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="oss-section">
          <div className="oss-section-header">Pesanan</div>
          <div>
            {order.cartSnapshot.map((it, i) => (
              <div className="oss-item" key={i}>
                <div className="oss-item-left">
                  <div className="oss-item-name">{it.nm}</div>
                  {it.vl?.length > 0
                    ? it.vl.map((v, j) => <div className="oss-item-var" key={j}>· {v}</div>)
                    : <div className="oss-item-meta">× {it.qty}</div>}
                </div>
                <div className="oss-item-price">{formatPrice(it.sub)}</div>
              </div>
            ))}
          </div>
          <div className="oss-totals">
            {(order.discount > 0 || order.shippingCost > 0) && (
              <div className="oss-total-line"><span>Subtotal</span><span>{formatPrice(order.rawTotal)}</span></div>
            )}
            {order.discount > 0 && (
              <div className="oss-total-line"><span>Diskon</span><span>−{formatPrice(order.discount)}</span></div>
            )}
            {order.shippingCost > 0 && (
              <div className="oss-total-line"><span>Ongkir</span><span>{formatPrice(order.shippingCost)}</span></div>
            )}
            <div className="oss-grand-total"><span>Total</span><span>{formatPrice(order.finalTotal)}</span></div>
          </div>
        </div>
      </div>

      {showQr && <QrisViewModal order={order} settings={settings} onClose={() => setShowQr(false)} />}
    </div>
  );
}
