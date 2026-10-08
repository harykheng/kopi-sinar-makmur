// Error state for admin data views (R-27). Rendered instead of the empty
// state when the fetch itself failed, so RLS drift / expired session / network
// loss never shows up as "Belum ada data". Says what failed and offers a retry.
export default function AdminErrorState({ what = 'data', error, onRetry }) {
  const detail = error?.message || (typeof error === 'string' ? error : '');
  return (
    <div className="admin-error-state" role="alert">
      <h3>Gagal memuat {what}</h3>
      <p>
        Data tidak bisa diambil dari server, jadi yang tampil di bawah bukan berarti kosong.
        {detail ? ` Pesan error: ${detail}` : ''}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>Coba lagi</button>
      )}
    </div>
  );
}
