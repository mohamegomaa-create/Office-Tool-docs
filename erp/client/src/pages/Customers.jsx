import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDate } from '../utils.js';
import Modal from '../components/Modal.jsx';

const empty = { name: '', email: '', phone: '', address: '', company: '', tax_id: '' };

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    api(`/customers?${params.toString()}`)
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  function openCreate() { setEditing(null); setForm(empty); setError(''); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setForm(c); setError(''); setModalOpen(true); }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api(`/customers/${editing.id}`, { method: 'PUT', body: form });
      else await api('/customers', { method: 'POST', body: form });
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function remove(c) {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try { await api(`/customers/${c.id}`, { method: 'DELETE' }); load(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Customer</button>
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading…</div>
          ) : customers.length === 0 ? (
            <div className="empty">
              <div className="icon">👥</div>
              <h3>No customers yet</h3>
              <p>Add your first customer to start creating orders.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Tax ID</th><th>Added</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td><div className="strong">{c.name}</div></td>
                      <td>{c.company || <span className="muted-text">—</span>}</td>
                      <td>{c.email || <span className="muted-text">—</span>}</td>
                      <td>{c.phone || <span className="muted-text">—</span>}</td>
                      <td className="mono">{c.tax_id || <span className="muted-text">—</span>}</td>
                      <td className="muted-text">{fmtDate(c.created_at)}</td>
                      <td className="right">
                        <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                          {isAdmin && <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => remove(c)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="cust-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save'}
            </button>
          </>
        }
      >
        <form id="cust-form" onSubmit={save}>
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Company</label>
              <input value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tax ID</label>
              <input value={form.tax_id || ''} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>spacer</label>
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
