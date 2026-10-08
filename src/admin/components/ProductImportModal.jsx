import { useRef, useState } from 'react';
import Modal from '../../shared/components/Modal.jsx';
import { useToast } from '../../shared/components/Toast.jsx';
import { downloadCsv, parseCsvObjects } from '../../shared/lib/csv.js';
import { importProducts } from '../../shared/lib/products.js';

const TEMPLATE_HEADERS = ['Nama', 'Deskripsi', 'Harga', 'Stok', 'Kuota per Tanggal', 'Badge New', 'Badge Terlaris', 'Tampil di Katalog'];
const TEMPLATE_EXAMPLE_ROWS = [
  ['Produk Contoh A', 'Deskripsi singkat, boleh dikosongkan', '18000', '', '', 'TRUE', 'FALSE', 'TRUE'],
  ['Produk Contoh B', '', '22000', '10', '20', 'FALSE', 'TRUE', 'TRUE'],
];

function parseBool(str, defaultVal) {
  const s = (str || '').trim().toLowerCase();
  if (s === '') return defaultVal;
  return ['true', 'ya', 'yes', '1'].includes(s);
}

// Validates + maps one parsed CSV row. Returns { ok: true, product } or
// { ok: false, reason }. rowNum is 1-indexed counting the header as row 1,
// matching what a spreadsheet app shows so admin can find the row easily.
function validateRow(raw, rowNum) {
  const name = (raw['Nama'] || '').trim();
  if (!name) return { ok: false, rowNum, reason: 'Nama kosong' };

  const priceStr = (raw['Harga'] || '').trim();
  const price = parseInt(priceStr, 10);
  if (priceStr === '' || Number.isNaN(price) || price < 0) {
    return { ok: false, rowNum, reason: `Harga tidak valid ("${priceStr}")` };
  }

  const stockStr = (raw['Stok'] || '').trim();
  let stockQty = null;
  if (stockStr !== '') {
    stockQty = parseInt(stockStr, 10);
    if (Number.isNaN(stockQty) || stockQty < 0) {
      return { ok: false, rowNum, reason: `Stok tidak valid ("${stockStr}")` };
    }
  }

  const capacityStr = (raw['Kuota per Tanggal'] || '').trim();
  let dailyCapacity = null;
  if (capacityStr !== '') {
    dailyCapacity = parseInt(capacityStr, 10);
    if (Number.isNaN(dailyCapacity) || dailyCapacity < 0) {
      return { ok: false, rowNum, reason: `Kuota per tanggal tidak valid ("${capacityStr}")` };
    }
  }

  return {
    ok: true,
    rowNum,
    product: {
      name,
      description: (raw['Deskripsi'] || '').trim(),
      price,
      stockQty,
      dailyCapacity,
      isNew: parseBool(raw['Badge New'], false),
      isBestseller: parseBool(raw['Badge Terlaris'], false),
      isVisible: parseBool(raw['Tampil di Katalog'], true),
    },
  };
}

export default function ProductImportModal({ isOpen, onClose, onImported }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [valid, setValid] = useState([]);
  const [invalid, setInvalid] = useState([]);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName('');
    setValid([]);
    setInvalid([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate() {
    downloadCsv('template-produk.csv', TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROWS);
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const text = await file.text();
      const rows = parseCsvObjects(text);
      if (rows.length === 0) {
        showToast('File CSV kosong atau formatnya tidak kebaca', 'error');
        reset();
        return;
      }

      const results = rows.map((r, i) => validateRow(r, i + 2)); // +2: header is row 1
      setValid(results.filter((r) => r.ok));
      setInvalid(results.filter((r) => !r.ok));
    } catch (err) {
      console.error('Parse CSV error:', err);
      showToast('Gagal baca file CSV', 'error');
      reset();
    }
  }

  async function handleImport() {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      await importProducts(valid.map((r) => r.product));
      showToast(`${valid.length} produk berhasil di-import`, 'success');
      reset();
      onImported();
      onClose();
    } catch (err) {
      console.error('Import products error:', err);
      showToast('Gagal import: ' + err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Produk dari CSV" boxClassName="product-import-box">
      <div className="import-intro">
        <p>Upload file CSV berisi daftar produk. Kolom yang dibaca: <strong>Nama, Deskripsi, Harga, Stok, Badge New, Badge Terlaris, Tampil di Katalog</strong>.</p>
        <p className="form-hint">Foto &amp; varian tidak bisa lewat CSV. Tambahkan manual lewat Edit setelah produk ke-import.</p>
        <button type="button" className="btn btn-secondary import-template-btn" onClick={downloadTemplate}>Download Template CSV</button>
      </div>

      <div className="form-group">
        <label htmlFor="importFile">File CSV</label>
        <input type="file" id="importFile" ref={fileInputRef} accept=".csv,text/csv" onChange={handleFileSelect} />
        {fileName && <p className="form-hint">File: {fileName}</p>}
      </div>

      {(valid.length > 0 || invalid.length > 0) && (
        <div className="import-preview">
          <div className="import-summary">
            <span className="import-summary-ok">{valid.length} produk siap di-import</span>
            {invalid.length > 0 && <span className="import-summary-err">{invalid.length} baris dilewati</span>}
          </div>

          {invalid.length > 0 && (
            <ul className="import-error-list">
              {invalid.map((r) => (
                <li key={r.rowNum}>Baris {r.rowNum}: {r.reason}</li>
              ))}
            </ul>
          )}

          {valid.length > 0 && (
            <div className="import-valid-list">
              {valid.map((r) => (
                <div className="import-valid-item" key={r.rowNum}>
                  <span>{r.product.name}</span>
                  <span>Rp {r.product.price.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={handleClose}>Batal</button>
        <button type="button" className="btn btn-primary" onClick={handleImport} disabled={valid.length === 0 || importing}>
          {importing ? 'Mengimpor...' : `Import ${valid.length || ''} Produk`}
        </button>
      </div>
    </Modal>
  );
}
