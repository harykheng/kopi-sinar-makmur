import { supabase } from './supabaseClient.js';
import { dateKeyOf, todayKey } from './format.js';

// Fire-and-forget: analytics never blocks or breaks the catalog page.
// See supabase-setup.sql §12 for why this goes through an RPC (atomic
// upsert counter) instead of a plain insert/update from the browser.
// Sends the visitor's local date, see §12 for why the server's CURRENT_DATE
// (UTC) isn't used. A database that hasn't run the new track_visit(p_date)
// yet answers PGRST202 (no such signature), so retry the old no-arg call
// rather than silently losing every visit until the SQL is updated.
export async function trackVisit() {
  try {
    const { error } = await supabase.rpc('track_visit', { p_date: todayKey() });
    if (error?.code === 'PGRST202') await supabase.rpc('track_visit');
  } catch (e) {
    console.error('trackVisit error:', e);
  }
}

// Admin-only (daily_visits has no anon SELECT policy). Returns rows sorted
// oldest-first so callers can index straight into a day-by-day chart.
export async function fetchDailyVisits(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = dateKeyOf(since);

  const { data, error } = await supabase
    .from('daily_visits')
    .select('*')
    .gte('visit_date', sinceStr)
    .order('visit_date', { ascending: true });
  if (error) throw error;
  return data || [];
}
