import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Reads the single `settings` row (id=1). Used by both apps: customer app applies
// it as branding overrides on top of config.js defaults, admin app edits it.
// If the table doesn't exist yet, fails silently (matches original behavior).
export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (err) setError(err);
      else if (data) setSettings(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // The customer app ignores `error` on purpose and falls back to config.js
  // defaults; the admin app surfaces it so a missing table or an RLS problem
  // does not look like empty settings (R-27).
  return { settings, loading, error, refetch };
}
