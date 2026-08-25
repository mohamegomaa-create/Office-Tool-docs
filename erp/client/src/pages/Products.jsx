import { useEffect, useState } from 'react';
import { api, download } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtMoney, fmtNum } from '../utils.js';
import Modal from '../components/Modal.jsx';

const empty = {
  sku: '', name: '', description: '', category_id: '', supplier_id: '', unit: 'pcs',
  cost_price: 0, sale_price: 0, stock: 0, reorder_level: 0,
};

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
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
    if (catFilter) params.set('category_id', catFilter);
    if (lowOnly) params.set('low', '1');
    Promise.all([
      api(`/products?${params.toString()}`),
      api('/products/categories'),
      api('/suppliers'),
    ])
      .then(([p, c, s]) => { setProducts(p); setCategories(c); setSuppliers(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, catFilter, lowOnly]);

  function openCreate() { setEditing(null); setForm(empty); setError(''); setModalOpen(true); }
  function openEdit(p) {
    setEditing(p);
    setForm({ ...p, category_id: p.category_id || '', supplier_id: p.supplier_id || '' });
    setError('');
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (!payload.category_id) delete payload.category_id;
      if (!payload.supplier_id) delete payload.supplier_id;
      if (editing) await api(`/products/${editing.id}`, { method: 'PUT', body: payload });
      else await api('/products', { method: 'POST', body: payload });
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function remove(p) {
    if (!confirm(`Delete product "${p.name}"? This cannot be undone.`)) return;
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); load(); }
    catch (err) { alert(err.message); }
  }

  function exportCsv() {
    download('/documents/products.csv', 'products.csv').catch((e) => alert(e.message));
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Search by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
          <input type="checkbox" style={{ width: 16, height: 16 }} checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
        <button className="btn btn-secondary" onClick={exportCsv}>⬇ Export CSV</button>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Add Product</button>}
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading products…</div>
          ) : products.length === 0 ? (
            <div className="empty">
              <div className="icon">📦</div>
              <h3>No products found</h3>
              <p>{q || catFilter || lowOnly ? 'Try adjusting your filters.' : 'Add your first product to get started.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th><th>Product</th><th>Category</th><th>Supplier</th>
                    <th className="right">Cost</th><th className="right">Price</th>
                    <th className="right">Stock</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = p.stock <= p.reorder_level;
                    return (
                      <tr key={p.id}>
                        <td className="mono">{p.sku}</td>
                        <td>
                          <div className="strong">{p.name}</div>
                          {p.description && <div className="muted">{p.description}</div>}
                        </td>
                        <td>{p.category_name || <span className="muted-text">—</span>}</td>
                        <td>{p.supplier_name || <span className="muted-text">—</span>}</td>
                        <td className="right muted-text">{fmtMoney(p.cost_price)}</td>
                        <td className="right"><strong>{fmtMoney(p.sale_price)}</strong></td>
                        <td className="right">
                          <span className={`badge ${low ? 'badge-danger' : 'badge-success'}`}>
                            {fmtNum(p.stock)} {p.unit}
                          </span>
                        </td>
                        <td className="right">
                          {isAdmin && (
                            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => remove(p)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="product-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={save}>
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>SKU *</label>
              <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Reorder Level</label>
              <input type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Cost Price</label>
              <input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Sale Price</label>
              <input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Stock on Hand</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
