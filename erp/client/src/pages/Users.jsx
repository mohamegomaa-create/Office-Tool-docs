import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate, initials } from '../utils.js';
import Modal from '../components/Modal.jsx';

const empty = { name: '', email: '', password: '', role: 'staff' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api('/auth/users')
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setEditing(null); setForm(empty); setError(''); setModalOpen(true); }
  function openEdit(u) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active });
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role, active: form.active };
        if (form.password) payload.password = form.password;
        await api(`/auth/users/${editing.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/auth/users', { method: 'POST', body: form });
      }
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="toolbar">
        <div style={{ flex: 1 }}>
          <p className="muted-text" style={{ fontSize: 14 }}>
            Manage who can access the ERP. Admins can manage products, orders, and accounting; staff can create customers and orders.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading users…</div>
          ) : (
            <table>
              <thead>
                <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex gap-12" style={{ alignItems: 'center' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#6366f1,#ec4899)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13,
                        }}>{initials(u.name)}</div>
                        <div className="strong">{u.name}</div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-info'}`}>{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                        {u.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="muted-text">{fmtDate(u.created_at)}</td>
                    <td className="right">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit User' : 'Add User'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="user-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save'}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={save}>
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <div className="form-group">
            <label>Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {editing && (
              <div className="form-group">
                <label>Status</label>
                <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                  <option value="1">Active</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" required={!editing} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
