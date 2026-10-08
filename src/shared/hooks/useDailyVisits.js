import { useCallback, useEffect, useState } from 'react';
import { fetchDailyVisits } from '../lib/visits.js';

// Admin-only. Fetches the last `days` days of daily_visits (see
// supabase-setup.sql §12) for the "Pengunjung" chart on DashboardTab.
export function useDailyVisits(days = 30) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVisits(await fetchDailyVisits(days));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { refetch(); }, [refetch]);

  return { visits, loading, error, refetch };
}
