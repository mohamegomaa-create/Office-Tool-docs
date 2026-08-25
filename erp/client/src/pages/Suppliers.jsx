import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDate } from '../utils.js';
import Modal from '../components/Modal.jsx';

const empty = { name: '', contact_name: '', email: '', phone: '', address: '', tax_id: '', payment_terms: '' };

export default function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
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
    api(`/suppliers?${params.toString()}`)
      .then(setSuppliers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [q]); // eslint-disable-line

  function openCreate() { setEditing(null); setForm(empty); setError(''); setModalOpen(true); }
  function openEdit(s) { setEditing(s); setForm(s); setError(''); setModalOpen(true); }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api(`/suppliers/${editing.id}`, { method: 'PUT', body: form });
      else await api('/suppliers', { method: 'POST', body: form });
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function remove(s) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try { await api(`/suppliers/${s.id}`, { method: 'DELETE' }); load(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Search suppliers…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Add Supplier</button>}
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading…</div>
          ) : suppliers.length === 0 ? (
            <div className="empty">
              <div className="icon">🏭</div>
              <h3>No suppliers yet</h3>
              <p>Add suppliers to create purchase orders and restock inventory.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th>
                    <th>Payment Terms</th><th>Added</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="strong">{s.name}</div>
                        {s.tax_id && <div className="muted mono">Tax ID: {s.tax_id}</div>}
                      </td>
                      <td>{s.contact_name || <span className="muted-text">—</span>}</td>
                      <td>{s.email || <span className="muted-text">—</span>}</td>
                      <td>{s.phone || <span className="muted-text">—</span>}</td>
                      <td>
                        {s.payment_terms
                          ? <span className="badge badge-info">{s.payment_terms}</span>
                          : <span className="muted-text">—</span>}
                      </td>
                      <td className="muted-text">{fmtDate(s.created_at)}</td>
                      <td className="right">
                        <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
                          {isAdmin && <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => remove(s)}>Delete</button>}
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
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="sup-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save'}
            </button>
          </>
        }
      >
        <form id="sup-form" onSubmit={save}>
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input value={form.contact_name || ''} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
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
            <div className="form-group">
              <label>Payment Terms</label>
              <select value={form.payment_terms || ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                <option value="">—</option>
                <option>Prepaid</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
              </select>
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
