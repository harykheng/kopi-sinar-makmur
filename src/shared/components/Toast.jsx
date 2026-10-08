import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((msg, type = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, msg, type, leaving: false }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}${t.leaving ? ' toast-out' : ''}`}>
            <span className="toast-icon">{ICONS[t.type] || ICONS.info}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
