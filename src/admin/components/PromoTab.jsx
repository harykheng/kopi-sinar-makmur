import { useState } from 'react';
import { usePromos } from '../../shared/hooks/usePromos.js';
import { formatPrice, formatExpiryDate } from '../../shared/lib/format.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { useConfirmDialog } from '../../shared/components/ConfirmDialog.jsx';
import { deletePromo } from '../../shared/lib/promos.js';
import PromoFormModal from './PromoFormModal.jsx';
import AdminErrorState from './AdminErrorState.jsx';

export default function PromoTab() {
  const { promos, loading, error, refetch } = usePromos();
  const { confirm, close } = useConfirmDialog();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  function openCreate() {
    setEditingPromo(null);
    setFormOpen(true);
  }

  function openEdit(promo) {
    setEditingPromo(promo);
    setFormOpen(true);
  }

  function handleDelete(promo) {
    confirm(`Yakin mau hapus kode "${promo.code}"? Tindakan ini tidak bisa dibatalkan.`, async () => {
      try {
        await deletePromo(promo.id);
        showToast(`Kode "${promo.code}" berhasil dihapus`, 'success');
        close();
        await refetch();
      } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
        close();
      }
    });
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Kode Promo</h2>
          <p className="admin-page-subtitle">{loading ? 'Memuat...' : error ? 'Data tidak termuat' : `${promos.length} kode promo`}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Tambah Promo</button>
      </div>

      {loading && (
        <div className="loading-state" style={{ display: 'flex' }}>
          <div className="spinner"></div>
          <span>Memuat promo...</span>
        </div>
      )}

      {!loading && error && <AdminErrorState what="kode promo" error={error} onRetry={refetch} />}

      {!loading && !error && promos.length === 0 && (
        <div className="empty-admin-state visible">
          <h3>Belum ada kode promo</h3>
          <p>Buat kode promo pertamamu!</p>
        </div>
      )}

      {!loading && !error && promos.length > 0 && (
        <div className="promos-list">
          {promos.map((promo) => {
            const discLabel = promo.discount_type === 'percent'
              ? `${promo.discount_value}% OFF`
              : `Rp ${promo.discount_value.toLocaleString('id-ID')} OFF`;
            const minLabel = promo.min_order > 0 ? `Min. order ${formatPrice(promo.min_order)}` : 'Tidak ada min. order';
            const expLabel = promo.expires_at ? `Berlaku hingga ${formatExpiryDate(promo.expires_at)}` : 'Tidak ada batas waktu';

            return (
              <div className="promo-card" key={promo.id}>
                <div className="promo-card-left">
                  <div className="promo-code-text">{promo.code}</div>
                  <div className="promo-disc-label">{discLabel}</div>
                  <div className="promo-meta">{minLabel} · {expLabel}</div>
                  <div>
                    {promo.is_active
                      ? <span className="promo-tag promo-tag-active">Aktif</span>
                      : <span className="promo-tag promo-tag-inactive">Nonaktif</span>}
                  </div>
                </div>
                <div className="promo-card-actions">
                  <button className="btn-sm btn-edit" onClick={() => openEdit(promo)}>Edit</button>
                  <button className="btn-sm btn-delete" onClick={() => handleDelete(promo)} aria-label={`Hapus kode ${promo.code}`}>Hapus</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PromoFormModal isOpen={formOpen} promo={editingPromo} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}
