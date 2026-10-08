import { useState } from 'react';
import { useProducts } from '../../shared/hooks/useProducts.js';
import { formatPrice, productInitial } from '../../shared/lib/format.js';
import { useToast } from '../../shared/components/Toast.jsx';
import { useConfirmDialog } from '../../shared/components/ConfirmDialog.jsx';
import { deleteProduct } from '../../shared/lib/products.js';
import ProductFormModal from './ProductFormModal.jsx';
import ProductImportModal from './ProductImportModal.jsx';
import AdminErrorState from './AdminErrorState.jsx';

export default function ProductsTab() {
  const { products, loading, error, refetch } = useProducts();
  const { confirm, close } = useConfirmDialog();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  function openCreate() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleDelete(product) {
    confirm(`Yakin mau hapus "${product.name}"? Tindakan ini tidak bisa dibatalkan.`, async () => {
      try {
        await deleteProduct(product.id);
        showToast(`"${product.name}" berhasil dihapus`, 'success');
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
          <h2 className="admin-page-title">Daftar Produk</h2>
          <p className="admin-page-subtitle">{loading ? 'Memuat...' : error ? 'Data tidak termuat' : `${products.length} produk`}</p>
        </div>
        <div className="admin-page-header-actions">
          <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>Import CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Tambah Produk</button>
        </div>
      </div>

      {loading && (
        <div className="loading-state" style={{ gridColumn: '1/-1', display: 'flex' }}>
          <div className="spinner"></div>
          <span>Memuat produk...</span>
        </div>
      )}

      {!loading && error && <AdminErrorState what="produk" error={error} onRetry={refetch} />}

      {!loading && !error && products.length === 0 && (
        <div className="empty-admin-state visible">
          <h3>Belum ada produk</h3>
          <p>Mulai tambahkan produk pertamamu!</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="products-admin-grid">
          {products.map((p, i) => (
            <div className="admin-product-card" key={p.id}>
              {p.image_url ? (
                <img className="admin-product-img" src={p.image_url} alt={p.name} loading="lazy" />
              ) : (
                <div className="admin-product-img" aria-hidden="true">{productInitial(p.name)}</div>
              )}
              <div className="admin-product-info">
                <div className="admin-product-name">{p.name}</div>
                {p.description && <div className="admin-product-desc">{p.description}</div>}
                <div className="admin-product-price">{formatPrice(p.price)}</div>
                <div className="admin-product-tags">
                  {p.is_new && <span className="admin-tag tag-new">Baru</span>}
                  {p.is_bestseller && <span className="admin-tag tag-bestseller">Terlaris</span>}
                  {p.is_visible
                    ? <span className="admin-tag tag-visible">Tampil</span>
                    : <span className="admin-tag tag-hidden">Disembunyikan</span>}
                  {p.stock_qty == null ? (
                    <span className="admin-tag tag-stock-unlimited">∞ Stok</span>
                  ) : p.stock_qty <= 0 ? (
                    <span className="admin-tag tag-stock-empty">Stok habis</span>
                  ) : (
                    <span className="admin-tag tag-stock">Stok {p.stock_qty}</span>
                  )}
                  {p.daily_capacity != null && (
                    <span className="admin-tag tag-capacity">Kuota {p.daily_capacity}/tanggal</span>
                  )}
                </div>
                <div className="admin-product-actions">
                  <button className="btn-sm btn-edit" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn-sm btn-delete" onClick={() => handleDelete(p)}>Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductFormModal
        isOpen={formOpen}
        product={editingProduct}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      <ProductImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetch}
      />
    </div>
  );
}
