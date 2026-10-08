import { useEffect, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import { useToast } from '../../shared/components/Toast.jsx';
import { savePromo } from '../../shared/lib/promos.js';

const EMPTY_FORM = { code: '', discountType: 'percent', discountValue: '', minOrder: '0', expires: '', isActive: true };

export default function PromoFormModal({ isOpen, promo, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    if (promo) {
      setForm({
        code: promo.code,
        discountType: promo.discount_type,
        discountValue: promo.discount_value,
        minOrder: promo.min_order || 0,
        expires: promo.expires_at ? promo.expires_at.split('T')[0] : '',
        isActive: promo.is_active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, promo]);

  const valueHint = form.discountType === 'percent'
    ? 'Masukkan angka persen (contoh: 20 = 20%)'
    : 'Masukkan nominal Rupiah (contoh: 10000 = Rp 10.000)';

  async function handleSubmit(e) {
    e.preventDefault();

    const code = form.code.trim().toUpperCase();
    const discountValue = parseInt(form.discountValue, 10);
    if (!code) { showToast('Kode promo wajib diisi!', 'error'); return; }
    if (!discountValue || discountValue <= 0) { showToast('Nilai diskon wajib diisi!', 'error'); return; }
    if (form.discountType === 'percent' && discountValue > 100) { showToast('Diskon persen maksimal 100%!', 'error'); return; }

    setSaving(true);
    try {
      await savePromo({
        promoId: promo?.id || null,
        code,
        discountType: form.discountType,
        discountValue,
        minOrder: parseInt(form.minOrder, 10) || 0,
        expiresAt: form.expires ? new Date(form.expires + 'T23:59:59+07:00').toISOString() : null,
        isActive: form.isActive,
      });
      showToast(promo ? 'Kode promo berhasil diperbarui!' : 'Kode promo berhasil ditambahkan!', 'success');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save promo error:', err);
      showToast('Gagal menyimpan: ' + (err.message || 'Coba lagi'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={promo ? 'Edit Kode Promo' : 'Tambah Kode Promo'}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="promoCode">Kode Promo *</label>
          <input
            type="text" id="promoCode" placeholder="CONTOH20" required
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
          />
          <p className="form-hint">Huruf kapital, tanpa spasi</p>
        </div>

        <div className="form-group">
          <label>Tipe Diskon *</label>
          <div className="promo-type-group">
            <label className="promo-type-opt">
              <input
                type="radio" name="promoType" value="percent" checked={form.discountType === 'percent'}
                onChange={() => setForm((f) => ({ ...f, discountType: 'percent' }))}
              />
              <span>% Persen</span>
            </label>
            <label className="promo-type-opt">
              <input
                type="radio" name="promoType" value="flat" checked={form.discountType === 'flat'}
                onChange={() => setForm((f) => ({ ...f, discountType: 'flat' }))}
              />
              <span>Rp Nominal</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="promoValue">Nilai Diskon *</label>
          <input
            type="number" id="promoValue" placeholder="20" min="1" required
            value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
          />
          <p className="form-hint">{valueHint}</p>
        </div>

        <div className="form-group">
          <label htmlFor="promoMinOrder">Minimum Order (Rp)</label>
          <input
            type="number" id="promoMinOrder" placeholder="0 = tidak ada minimum" min="0"
            value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label htmlFor="promoExpires">Berlaku Hingga <span style={{ fontWeight: 500, color: 'var(--text-soft)' }}>(opsional)</span></label>
          <input
            type="date" id="promoExpires"
            value={form.expires} onChange={(e) => setForm((f) => ({ ...f, expires: e.target.value }))}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div className="toggle-item">
            <div className="toggle-label">
              <span className="toggle-label-title">Aktif</span>
              <span className="toggle-label-sub">Promo bisa digunakan customer</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Promo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
