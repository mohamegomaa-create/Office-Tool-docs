import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/settings'), api('/settings/currencies')])
      .then(([s, c]) => { setSettings(s); setCurrencies(c); })
      .catch((e) => setError(e.message));
  }, []);

  function update(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true); setError('');
    try {
      await api('/settings', { method: 'PUT', body: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (!settings) return <div className="page-loading"><span className="spinner" />Loading settings…</div>;

  return (
    <div>
      {!isAdmin && (
        <div className="alert alert-info">You have view-only access. Only administrators can change company settings.</div>
      )}
      {error && <div className="alert alert-danger">⚠ {error}</div>}
      {saved && <div className="alert alert-success">✓ Settings saved successfully.</div>}

      <form onSubmit={save}>
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Company Information</h2>
              <div className="sub">Shown on invoices and PDFs.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Company Name</label>
              <input disabled={!isAdmin} value={settings.company_name || ''} onChange={(e) => update('company_name', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" disabled={!isAdmin} value={settings.company_email || ''} onChange={(e) => update('company_email', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input disabled={!isAdmin} value={settings.company_phone || ''} onChange={(e) => update('company_phone', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Address</label>
                <input disabled={!isAdmin} value={settings.company_address || ''} onChange={(e) => update('company_address', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tax ID</label>
                <input disabled={!isAdmin} value={settings.company_tax_id || ''} onChange={(e) => update('company_tax_id', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Localization & Tax</h2>
              <div className="sub">Default currency and VAT settings used for new orders and purchase orders.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-row-3">
              <div className="form-group">
                <label>Base Currency</label>
                <select disabled value={settings.base_currency || 'USD'} onChange={(e) => update('base_currency', e.target.value)}>
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Default Transaction Currency</label>
                <select disabled={!isAdmin} value={settings.default_currency || 'USD'} onChange={(e) => update('default_currency', e.target.value)}>
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Default VAT Rate (%)</label>
                <input type="number" step="0.01" min="0" disabled={!isAdmin}
                  value={settings.default_tax_rate || 0} onChange={(e) => update('default_tax_rate', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Tax Label</label>
              <input disabled={!isAdmin} value={settings.default_tax_name || 'VAT'}
                onChange={(e) => update('default_tax_name', e.target.value)} placeholder="VAT, GST, Sales Tax…" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Invoicing</h2>
              <div className="sub">Control how invoice numbers are generated.</div>
            </div>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label>Invoice Number Prefix</label>
                <input disabled={!isAdmin} value={settings.invoice_prefix || 'INV'}
                  onChange={(e) => update('invoice_prefix', e.target.value.toUpperCase())} />
              </div>
              <div className="form-group">
                <label>Preview</label>
                <input disabled value={`${settings.invoice_prefix || 'INV'}-${new Date().getFullYear()}-00001`} />
              </div>
            </div>
            <div className="form-group">
              <label>Invoice Footer Note</label>
              <textarea disabled={!isAdmin} value={settings.invoice_footer || ''}
                onChange={(e) => update('invoice_footer', e.target.value)} />
            </div>
          </div>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Settings'}
            </button>
          </div>
        )}
      </form>

      <div className="card mt-24">
        <div className="card-header"><h2>System Information</h2></div>
        <div className="card-body">
          <div className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="muted-text">Application</span><strong>Nexus ERP v1.1</strong>
          </div>
          <div className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="muted-text">Backend</span><strong>Node + Express 5</strong>
          </div>
          <div className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="muted-text">Database</span><strong>SQLite (WAL mode)</strong>
          </div>
          <div className="flex-between" style={{ padding: '10px 0' }}>
            <span className="muted-text">Signed in as</span><strong>{user?.email} ({user?.role})</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
