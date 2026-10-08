import { supabase } from './supabaseClient.js';

// Tanggal toko tutup. Admin-only: `anon` sengaja tidak punya policy SELECT ke
// tabel ini (lihat supabase-setup.sql §6b), customer melihat tanggal liburnya
// lewat get_full_dates() yang sudah melaporkan alasannya.

export async function fetchClosedDates() {
  const { data, error } = await supabase
    .from('closed_dates')
    .select('*')
    .order('closed_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Upsert, bukan insert, supaya menambahkan tanggal yang sudah ada tidak gagal
// dengan error primary key yang tidak berarti apa-apa buat pemilik toko.
export async function addClosedDate(dateKey, note) {
  const { error } = await supabase
    .from('closed_dates')
    .upsert({ closed_date: dateKey, note: note || null }, { onConflict: 'closed_date' });
  if (error) throw error;
}

export async function removeClosedDate(dateKey) {
  const { error } = await supabase.from('closed_dates').delete().eq('closed_date', dateKey);
  if (error) throw error;
}
