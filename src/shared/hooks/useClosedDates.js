import { useCallback, useEffect, useState } from 'react';
import { fetchClosedDates } from '../lib/closedDates.js';

export function useClosedDates() {
  const [closedDates, setClosedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClosedDates(await fetchClosedDates());
    } catch (err) {
      console.error('fetchClosedDates error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { closedDates, loading, error, refetch };
}
