import { useMemo } from 'react';
import { useOrders } from '../../shared/hooks/useOrders.js';
import { useDailyVisits } from '../../shared/hooks/useDailyVisits.js';
import { formatPrice } from '../../shared/lib/format.js';
import AdminErrorState from './AdminErrorState.jsx';
import { isProductionOrder, orderDateKey } from '../../shared/lib/production.js';
import { dateKeyOf, todayKey } from '../../shared/lib/format.js';

// Only orders an admin has actually confirmed (checked the payment proof)
// count as revenue, 'pending' is just "QRIS generated, customer claims they
// paid" and hasn't been verified yet, so it doesn't belong in a revenue
// figure. 'cancelled' is excluded too, obviously.
const REVENUE_STATUSES = ['confirmed', 'done'];

function isSameDay(isoString, ref) {
  const d = new Date(isoString);
  return d.toDateString() === ref.toDateString();
}

function isSameMonth(isoString, ref) {
  const d = new Date(isoString);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function sumTotal(list) {
  return list.reduce((s, o) => s + (o.total || 0), 0);
}

function sumItemCount(list) {
  return list.reduce((s, o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    return s + items.reduce((si, it) => si + (it.qty || 0), 0);
  }, 0);
}

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function DashboardTab({ onGoToOrders }) {
  const { orders, loading, error, refetch } = useOrders();
  const { visits, loading: visitsLoading, error: visitsError } = useDailyVisits(7);

  const visitStats = useMemo(() => {
    const now = new Date();
    const countByDate = new Map(visits.map((v) => [v.visit_date, v.count]));

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        isToday: i === 0,
        count: countByDate.get(toDateKey(d)) || 0,
      });
    }
    const maxDayCount = Math.max(1, ...days.map((d) => d.count));

    return {
      todayCount: days[days.length - 1].count,
      weekCount: days.reduce((s, d) => s + d.count, 0),
      days,
      maxDayCount,
    };
  }, [visits]);

  // Sumbu yang berbeda dari kartu pendapatan di bawahnya, dan itu disengaja.
  // Kartu pendapatan memakai `created_at` (kapan pesanan masuk) karena itu
  // pertanyaan uang. Kartu ini memakai `order_date` (kapan pesanan harus siap)
  // karena itu pertanyaan dapur. Untuk toko yang mengerjakan pesanan per
  // tanggal, dua angka itu bisa jauh berbeda dan yang kedua tidak pernah
  // terjawab dari dashboard sebelum ini.
  //
  // Statusnya pakai PRODUCTION_STATUSES lewat isProductionOrder(), bukan
  // REVENUE_STATUSES: pesanan `pending` belum terverifikasi sebagai uang tapi
  // tetap kerjaan yang mungkin mendarat.
  const productionStats = useMemo(() => {
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);

    const forDate = (key) => {
      const rows = orders.filter((o) => isProductionOrder(o) && orderDateKey(o) === key);
      return { key, orderCount: rows.length, itemCount: sumItemCount(rows) };
    };
    return { hariIni: forDate(todayKey()), besok: forDate(dateKeyOf(besok)) };
  }, [orders]);

  const stats = useMemo(() => {
    const now = new Date();
    const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const todayOrders = revenueOrders.filter((o) => isSameDay(o.created_at, now));
    const monthOrders = revenueOrders.filter((o) => isSameMonth(o.created_at, now));

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayOrders = revenueOrders.filter((o) => isSameDay(o.created_at, d));
      days.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        isToday: i === 0,
        revenue: sumTotal(dayOrders),
      });
    }
    const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenue));

    const productMap = new Map();
    monthOrders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it) => {
        const entry = productMap.get(it.nm) || { name: it.nm, qty: 0, revenue: 0 };
        entry.qty += it.qty || 0;
        entry.revenue += it.sub || 0;
        productMap.set(it.nm, entry);
      });
    });
    const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    return {
      todayRevenue: sumTotal(todayOrders),
      todayOrderCount: todayOrders.length,
      todayItemCount: sumItemCount(todayOrders),
      monthRevenue: sumTotal(monthOrders),
      monthOrderCount: monthOrders.length,
      statusCounts,
      pendingCount: statusCounts.pending || 0,
      days,
      maxDayRevenue,
      topProducts,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="loading-state" style={{ display: 'flex' }}>
        <div className="spinner"></div>
        <span>Memuat dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="admin-page-header">
          <div>
            <h2 className="admin-page-title">Dashboard</h2>
            <p className="admin-page-subtitle">Apa yang perlu kamu kerjakan hari ini</p>
          </div>
        </div>
        <AdminErrorState what="data pesanan" error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Dashboard</h2>
          <p className="admin-page-subtitle">Apa yang perlu kamu kerjakan hari ini</p>
        </div>
      </div>

      <div className={`dash-focus${stats.pendingCount > 0 ? ' needs-action' : ''}`}>
        <div>
          <div className="dash-focus-label">Menunggu konfirmasi kamu</div>
          <div className="dash-focus-value">
            {stats.pendingCount > 0
              ? `${stats.pendingCount} pesanan`
              : 'Tidak ada, semua sudah diproses'}
          </div>
          <div className="dash-focus-sub">
            {stats.pendingCount > 0
              ? 'Pelanggan mengaku sudah bayar. Cek bukti transfernya, lalu konfirmasi.'
              : 'Pesanan baru akan muncul di sini begitu masuk.'}
          </div>
        </div>
        {stats.pendingCount > 0 && onGoToOrders && (
          <button type="button" className="btn btn-primary" onClick={onGoToOrders}>
            Buka Pesanan
          </button>
        )}
      </div>

      <div className="dash-stats-grid">
        <button
          type="button"
          className="dash-stat-card dash-stat-card-action"
          onClick={() => onGoToOrders && onGoToOrders(productionStats.hariIni.key)}
        >
          <div className="dash-stat-label">Harus siap hari ini</div>
          <div className="dash-stat-value">{productionStats.hariIni.orderCount}</div>
          <div className="dash-stat-sub">{productionStats.hariIni.itemCount} item, lihat rincian</div>
        </button>
        <button
          type="button"
          className="dash-stat-card dash-stat-card-action"
          onClick={() => onGoToOrders && onGoToOrders(productionStats.besok.key)}
        >
          <div className="dash-stat-label">Harus siap besok</div>
          <div className="dash-stat-value">{productionStats.besok.orderCount}</div>
          <div className="dash-stat-sub">{productionStats.besok.itemCount} item, lihat rincian</div>
        </button>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Pendapatan hari ini</div>
          <div className="dash-stat-value">{formatPrice(stats.todayRevenue)}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Pesanan hari ini</div>
          <div className="dash-stat-value">{stats.todayOrderCount}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Item terjual hari ini</div>
          <div className="dash-stat-value">{stats.todayItemCount}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Omset bulan ini</div>
          <div className="dash-stat-value">{formatPrice(stats.monthRevenue)}</div>
          <div className="dash-stat-sub">{stats.monthOrderCount} pesanan</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-label">Pengunjung hari ini</div>
          <div className="dash-stat-value">{visitsLoading ? '…' : visitsError ? 'n/a' : visitStats.todayCount}</div>
          <div className="dash-stat-sub">
            {visitsError ? 'Data pengunjung gagal dimuat' : `${visitStats.weekCount} dalam 7 hari`}
          </div>
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Berapa orang buka katalog per hari, 7 hari terakhir?</h3>
        <div className="dash-chart">
          {visitStats.days.map((d, i) => (
            <div className="dash-chart-col" key={i}>
              <div className="dash-chart-bar-wrap">
                <div
                  className={`dash-chart-bar${d.isToday ? ' today' : ''}`}
                  style={{ height: `${Math.max(4, (d.count / visitStats.maxDayCount) * 100)}%` }}
                  title={`${d.count} pengunjung`}
                ></div>
              </div>
              <div className="dash-chart-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Pendapatan per hari, 7 hari terakhir (hanya pesanan terkonfirmasi dan selesai)</h3>
        <div className="dash-chart">
          {stats.days.map((d, i) => (
            <div className="dash-chart-col" key={i}>
              <div className="dash-chart-bar-wrap">
                <div
                  className={`dash-chart-bar${d.isToday ? ' today' : ''}`}
                  style={{ height: `${Math.max(4, (d.revenue / stats.maxDayRevenue) * 100)}%` }}
                  title={formatPrice(d.revenue)}
                ></div>
              </div>
              <div className="dash-chart-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Status Pesanan</h3>
        <div className="dash-status-grid">
          <div className="dash-status-pill dash-status-pending">Menunggu <strong>{stats.statusCounts.pending || 0}</strong></div>
          <div className="dash-status-pill dash-status-confirmed">Diproses <strong>{stats.statusCounts.confirmed || 0}</strong></div>
          <div className="dash-status-pill dash-status-done">Selesai <strong>{stats.statusCounts.done || 0}</strong></div>
          <div className="dash-status-pill dash-status-cancelled">Dibatalkan <strong>{stats.statusCounts.cancelled || 0}</strong></div>
        </div>
      </div>

      <div className="dash-section">
        <h3 className="dash-section-title">Produk apa yang paling laku bulan ini?</h3>
        {stats.topProducts.length === 0 ? (
          <p className="dash-empty-note">Belum ada penjualan bulan ini.</p>
        ) : (
          <div className="dash-top-products">
            {stats.topProducts.map((p, i) => (
              <div className="dash-top-product-row" key={p.name}>
                <span className="dash-top-product-rank">#{i + 1}</span>
                <span className="dash-top-product-name">{p.name}</span>
                <span className="dash-top-product-qty">{p.qty} terjual</span>
                <span className="dash-top-product-revenue">{formatPrice(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
