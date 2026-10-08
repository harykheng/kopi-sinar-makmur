import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Tanggal dalam rentang yang tidak bisa dipesan, sebagai Map dari kunci
// 'YYYY-MM-DD' ke alasannya: 'closed' (toko libur) atau 'full' (tanggalnya
// sudah penuh pesanan).
//
// Map, bukan Set, karena dua sebab itu artinya beda jauh buat customer dan
// kalendernya menuliskannya berbeda. "Penuh" padahal toko libur bikin orang
// mengira kehabisan dan menunggu tanggal itu dibuka lagi.
//
// Dihitung di Postgres (get_full_dates(), supabase-setup.sql §7), bukan di
// sini, karena jawabannya butuh semua produk dikali semua tanggal: langkah 1
// belum mengambil daftar produk dan tidak perlu mengambilnya cuma buat ini.
//
// Gagal fetch tidak memblokir apa pun: Map balik kosong dan semua tanggal tetap
// bisa dipilih. Yang menolak beneran tetap place_order() di server, jadi
// kegagalan di sini bikin customer baru tahu belakangan, bukan bikin oversell.
export function useFullDates(fromKey, toKey) {
  const [fullDates, setFullDates] = useState(() => new Map());
  const [loading, setLoading] = useState(Boolean(fromKey && toKey));

  const refetch = useCallback(async () => {
    if (!fromKey || !toKey) {
      setFullDates(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_full_dates', { p_from: fromKey, p_to: toKey });
      if (error) throw error;
      const next = new Map();
      (data || []).forEach((row) => {
        next.set(String(row.full_date).slice(0, 10), row.reason === 'closed' ? 'closed' : 'full');
      });
      setFullDates(next);
    } catch (err) {
      console.error('get_full_dates error:', err);
      setFullDates(new Map());
    } finally {
      setLoading(false);
    }
  }, [fromKey, toKey]);

  useEffect(() => { refetch(); }, [refetch]);

  return { fullDates, loading, refetch };
}
