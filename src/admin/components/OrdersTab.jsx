import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../shared/hooks/useOrders.js';
import { formatPrice, formatOrderDate, formatDateKey, todayKey } from '../../shared/lib/format.js';
import { buildOrderDateOptions, buildProductionRecap, orderDateKey } from '../../shared/lib/production.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { updateOrderStatus } from '../../shared/lib/orders.js';
import { downloadCsv } from '../../shared/lib/csv.js';
import OrderDetailModal from './OrderDetailModal.jsx';
import PrintLabel from './PrintLabel.jsx';
import AdminErrorState from './AdminErrorState.jsx';

const FILTERS = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'confirmed', label: 'Diproses' },
  { key: 'done', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
  { key: 'all', label: 'Semua' },
];

const STATUS_BADGES = {
  pending: <span className="order-status-badge badge-pending">Menunggu</span>,
  confirmed: <span className="order-status-badge badge-confirmed">Diproses</span>,
  done: <span className="order-status-badge badge-done">Selesai</span>,
  cancelled: <span className="order-status-badge badge-cancelled">Dibatalkan</span>,
};

const STATUS_PLAIN = {
  pending: 'Menunggu Konfirmasi',
  confirmed: 'Diproses',
  done: 'Selesai',
  cancelled: 'Dibatalkan',
};

const CSV_HEADERS = [
  'Nomor Pesanan', 'Tanggal', 'Dibuat', 'Nama', 'WhatsApp', 'Tipe', 'Alamat',
  'Item', 'Subtotal', 'Kode Promo', 'Diskon', 'Ongkir', 'Total', 'Status',
];

function orderToCsvRow(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  return [
    o.order_number,
    o.order_date_label || o.order_date,
    new Date(o.created_at).toLocaleString('id-ID'),
    o.customer_name,
    o.customer_wa,
    o.order_type === 'pickup' ? 'Pickup' : 'Delivery',
    o.delivery_address || '',
    items.map((it) => `${it.nm} x${it.qty}`).join('; '),
    o.subtotal,
    o.promo_code || '',
    o.discount_amount || 0,
    o.shipping_cost || 0,
    o.total,
    STATUS_PLAIN[o.status] || o.status,
  ];
}

export default function OrdersTab({ initialDate }) {
  const { orders, loading, error, refetch } = useOrders();
  const showToast = useToast();
  // Datang dari kartu dashboard berarti admin bertanya "tanggal ini isinya
  // apa", bukan "mana yang perlu dikonfirmasi", jadi statusnya dibuka semua.
  // Kalau tetap 'pending', tanggal yang semua pesanannya sudah dikonfirmasi
  // akan terlihat kosong padahal justru penuh.
  const [filter, setFilter] = useState(initialDate ? 'all' : 'pending');
  // Dipakai sebagai nilai awal saja, bukan disinkronkan lewat efek: tab ini
  // di-unmount tiap kali admin pindah tab (lihat admin/App.jsx), jadi selalu
  // mount ulang dengan tanggal yang baru diklik.
  const [dateFilter, setDateFilter] = useState(initialDate || 'all');
  const [detailOrder, setDetailOrder] = useState(null);
  const [printQueue, setPrintQueue] = useState(null);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  const dateOptions = useMemo(() => buildOrderDateOptions(orders), [orders]);

  // Deliberately independent of the status filter above: this answers "what do I
  // have to make on this date", which does not change because the admin is
  // currently looking at the Selesai tab. The note under the heading says so.
  const recap = useMemo(
    () => (dateFilter === 'all' ? null : buildProductionRecap(orders, dateFilter)),
    [orders, dateFilter],
  );

  const filtered = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (dateFilter !== 'all' && orderDateKey(o) !== dateFilter) return false;
    return true;
  });

  async function quickConfirm(order) {
    try {
      await updateOrderStatus(order.id, 'confirmed');
      showToast('Pesanan dikonfirmasi', 'success');
      await refetch();
    } catch (err) {
      showToast('Gagal ubah status: ' + err.message, 'error');
    }
  }

  // Cetak baru dipanggil SETELAH render, bukan di dalam handler tombol: label
  // dirender lewat portal ke #printLabel, dan window.print() yang dipanggil
  // sebelum React sempat commit akan mencetak halaman yang masih kosong.
  useEffect(() => {
    if (!printQueue) return;
    window.print();
    setPrintQueue(null);
  }, [printQueue]);

  function printLabels() {
    if (filtered.length === 0) {
      showToast('Tidak ada pesanan buat di-print', 'error');
      return;
    }
    setPrintQueue(filtered);
  }

  function exportCsv() {
    if (filtered.length === 0) {
      showToast('Tidak ada pesanan buat di-export', 'error');
      return;
    }
    const filterLabel = filter === 'all' ? 'semua' : filter;
    const dateLabel = dateFilter === 'all' ? todayKey() : dateFilter;
    downloadCsv(`pesanan-${filterLabel}-${dateLabel}.csv`, CSV_HEADERS, filtered.map(orderToCsvRow));
    showToast(`${filtered.length} pesanan berhasil di-export`, 'success');
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Pesanan Masuk</h2>
          <p className="admin-page-subtitle">
            {loading ? 'Memuat...' : error ? 'Data tidak termuat' : orders.length === 0
              ? '0 pesanan'
              : pendingCount > 0
                ? `${orders.length} pesanan · ${pendingCount} menunggu konfirmasi`
                : `${orders.length} pesanan`}
          </p>
        </div>
        <div className="admin-page-header-actions">
          {!loading && !error && filtered.length > 0 && (
            <button className="btn btn-secondary" onClick={printLabels}>
              Print {filtered.length} Label
            </button>
          )}
          <button className="btn btn-secondary" onClick={exportCsv} disabled={loading}>Export CSV</button>
        </div>
      </div>

      <div className="orders-filter-bar" role="group" aria-label="Filter status pesanan">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`order-filter-btn${filter === f.key ? ' active' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loading && !error && dateOptions.length > 0 && (
        <div className="orders-date-bar" role="group" aria-label="Filter tanggal pengambilan">
          <button
            className={`order-date-btn${dateFilter === 'all' ? ' active' : ''}`}
            aria-pressed={dateFilter === 'all'}
            onClick={() => setDateFilter('all')}
          >
            Semua tanggal
          </button>
          {dateOptions.map((opt) => (
            <button
              key={opt.key}
              className={`order-date-btn${dateFilter === opt.key ? ' active' : ''}${opt.isPast ? ' is-past' : ''}`}
              aria-pressed={dateFilter === opt.key}
              onClick={() => setDateFilter(opt.key)}
            >
              <span>{formatDateKey(opt.key)}</span>
              <span className="odb-count" aria-label={`${opt.count} pesanan`}>{opt.count}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && recap && (
        <section className="production-recap">
          <div className="pr-head">
            <h3 className="pr-title">Rekap produksi · {formatDateKey(dateFilter)}</h3>
            <span className="pr-count">{recap.itemCount} item</span>
          </div>
          <p className="pr-note">
            Dari {recap.orderCount} pesanan
            {recap.pendingCount > 0 ? `, ${recap.pendingCount} belum dikonfirmasi` : ''}.
            Pesanan yang dibatalkan tidak dihitung, dan angka ini tidak ikut filter status di atas.
          </p>
          {recap.rows.length === 0 ? (
            <p className="pr-empty">Belum ada item buat tanggal ini.</p>
          ) : (
            <ul className="pr-list">
              {recap.rows.map((row) => (
                <li className="pr-row" key={row.name}>
                  <div className="pr-row-main">
                    <span className="pr-name">{row.name}</span>
                    <span className="pr-qty">{row.qty}</span>
                  </div>
                  {row.variants.length > 0 && (
                    <div className="pr-variants">
                      {row.variants.map((v) => (
                        <span className="pr-variant" key={v.label}>{v.label} {v.qty}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loading && (
        <div className="loading-state" style={{ display: 'flex' }}>
          <div className="spinner"></div>
          <span>Memuat pesanan...</span>
        </div>
      )}

      {!loading && error && <AdminErrorState what="pesanan" error={error} onRetry={refetch} />}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-admin-state visible">
          {dateFilter === 'all' ? (
            <>
              <h3>Belum ada pesanan</h3>
              <p>Pesanan yang dikonfirmasi dari WhatsApp akan muncul di sini</p>
            </>
          ) : (
            <>
              <h3>Tidak ada pesanan di tanggal ini</h3>
              <p>Coba ganti tanggal, atau pilih status lain di atas</p>
            </>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="orders-list">
          {filtered.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsPreview = items.slice(0, 2).map((it) => `${it.nm} ×${it.qty}`).join(', ')
              + (items.length > 2 ? `, +${items.length - 2} lainnya` : '');

            return (
              <div className={`order-card order-card-${order.status}`} key={order.id}>
                <div className="order-card-top">
                  <div>
                    <div className="order-number">{order.order_number}</div>
                    <div className="order-customer">{order.customer_name} · {order.customer_wa}</div>
                    <div className="order-meta">
                      {order.order_type === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'} · {order.order_date_label || order.order_date}
                    </div>
                    <div className="order-items-preview">{itemsPreview}</div>
                  </div>
                  <div className="order-card-right">
                    {STATUS_BADGES[order.status]}
                    <div className="order-total">{formatPrice(order.total)}</div>
                    <div className="order-date">{formatOrderDate(order.created_at)}</div>
                  </div>
                </div>
                <div className="order-card-actions">
                  {order.status === 'pending' && (
                    <button className="btn-sm btn-confirm-quick" onClick={() => quickConfirm(order)}>Konfirmasi</button>
                  )}
                  <button className="btn-sm btn-edit" onClick={() => setDetailOrder(order)}>Detail</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PrintLabel orders={printQueue} />

      <OrderDetailModal
        isOpen={Boolean(detailOrder)}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onStatusChanged={refetch}
      />
    </div>
  );
}
