import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Admin-only listing hook (customer promo lookups use fetchActivePromoByCode directly).
export function usePromos() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) setError(err);
      else setPromos(data || []);
    } catch (err) {
      // Network/CORS failures reject instead of resolving with { error }.
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { promos, loading, error, refetch };
}
