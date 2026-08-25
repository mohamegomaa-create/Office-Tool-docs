import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@erp.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div>
          <div className="logo-mark">N</div>
          <h1>Nexus ERP</h1>
          <p style={{ marginTop: 16 }}>
            A modern, unified platform to run your business — inventory, sales, customers,
            and finance in one place.
          </p>
        </div>
        <ul className="features">
          <li>Real-time inventory & low-stock alerts</li>
          <li>Sales orders with automatic accounting entries</li>
          <li>Customer relationship management</li>
          <li>General ledger & financial reporting</li>
        </ul>
        <div style={{ fontSize: 13, opacity: 0.7 }}>© 2026 Nexus ERP</div>
      </div>

      <div className="login-form-wrap">
        <div className="login-card">
          <h2>Welcome back</h2>
          <p className="sub">Sign in to your account to continue.</p>

          {error && <div className="alert alert-danger">⚠ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <div className="alert alert-info" style={{ marginTop: 24 }}>
            <div>
              <strong>Demo credentials</strong><br />
              Admin: <code>admin@erp.com</code> / <code>admin123</code><br />
              Staff: <code>staff@erp.com</code> / <code>staff123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
