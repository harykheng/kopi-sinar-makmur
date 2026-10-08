import { useEffect, useState } from 'react';
import { supabase } from '../../shared/lib/supabaseClient.js';
import { useToast } from '../../shared/components/Toast.jsx';

// Short beep via Web Audio API instead of shipping an audio asset, no file to
// source/license, and it degrades silently (try/catch) if autoplay is blocked.
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio unavailable/blocked, notification still shows via toast + badge
  }
}

// Live "new order came in" alert for the admin dashboard, via Supabase Realtime
// (Postgres change feed over the `orders` table, requires the table to be
// added to the `supabase_realtime` publication, see supabase-setup.sql §11).
// This only fires while the dashboard tab is open in a browser; it's not a
// true push notification (that would need a service worker + Web Push infra),
// which is a deliberate scope call for this project's size, see CLAUDE.md's
// "client-side by default, backend hanya kalau benar-benar wajib" stance.
export function useNewOrderAlerts() {
  const showToast = useToast();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel('admin-new-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        showToast(`Pesanan baru masuk! #${payload.new.order_number}`, 'success');
        playBeep();
        setCount((c) => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    setCount(0);
  }

  return { count, clear };
}
