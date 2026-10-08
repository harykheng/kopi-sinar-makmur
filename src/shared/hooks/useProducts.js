import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// onlyVisible: customer catalog only sees is_visible=true (enforced by RLS too);
// admin sees everything so it can toggle visibility.
export function useProducts({ onlyVisible = false } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (onlyVisible) query = query.eq('is_visible', true);

    try {
      const { data, error: err } = await query;
      if (err) setError(err);
      else setProducts(data || []);
    } catch (err) {
      // Network/CORS failures reject instead of resolving with { error }.
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [onlyVisible]);

  useEffect(() => { refetch(); }, [refetch]);

  return { products, loading, error, refetch };
}
