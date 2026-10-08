import { supabase } from './supabaseClient.js';

// Fire-and-forget: analytics never blocks or breaks the catalog page.
// See supabase-setup.sql §12 for why this goes through an RPC (atomic
// upsert counter) instead of a plain insert/update from the browser.
export async function trackVisit() {
  try {
    await supabase.rpc('track_visit');
  } catch (e) {
    console.error('trackVisit error:', e);
  }
}

// Admin-only (daily_visits has no anon SELECT policy). Returns rows sorted
// oldest-first so callers can index straight into a day-by-day chart.
export async function fetchDailyVisits(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_visits')
    .select('*')
    .gte('visit_date', sinceStr)
    .order('visit_date', { ascending: true });
  if (error) throw error;
  return data || [];
}
