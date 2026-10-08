import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { config } from '../../shared/lib/config.js';
import { useSettings } from '../../shared/hooks/useSettings.js';
import { useFavicon } from '../../shared/hooks/useFavicon.js';

export default function LoginScreen() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  useFavicon(settings?.favicon_url);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch {
      setError('Email atau password salah. Coba lagi!');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          {settings?.logo_url
            ? <img className="login-logo-img" src={settings.logo_url} alt="" />
            : <span className="logo-icon">{settings?.brand_icon || '🏪'}</span>}
          <div className="logo-text">{config.storeName}</div>
        </div>
        <p className="login-subtitle">Masuk ke Dashboard Admin</p>

        {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="loginEmail">Email</label>
            <input
              type="email" id="loginEmail" placeholder="admin@email.com" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="loginPassword">Password</label>
            <input
              type="password" id="loginPassword" placeholder="••••••••" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={submitting}>
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
