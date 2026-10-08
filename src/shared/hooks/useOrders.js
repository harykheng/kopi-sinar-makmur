import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const PENDING_EXPIRE_MS = 24 * 60 * 60 * 1000;

// Admin-only. Hides pending orders older than 24h (never confirmed), same as the
// original loadOrders() behavior, customer never reads this table (RLS insert-only).
export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err);
        return;
      }

      const now = Date.now();
      setOrders((data || []).filter((o) => {
        if (o.status !== 'pending') return true;
        return now - new Date(o.created_at).getTime() < PENDING_EXPIRE_MS;
      }));
    } catch (err) {
      // Network/CORS failures reject instead of resolving with { error }.
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { orders, loading, error, refetch };
}
