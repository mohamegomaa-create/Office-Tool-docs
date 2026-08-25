import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmtMoney, fmtDate, statusBadge } from '../utils.js';

const statuses = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Purchases() {
  const [pos, setPos] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api(`/purchases?${params.toString()}`)
      .then(setPos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, q]);

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Search by PO number…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Link to="/purchases/new" className="btn btn-primary">+ New Purchase Order</Link>
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading purchase orders…</div>
          ) : pos.length === 0 ? (
            <div className="empty">
              <div className="icon">🚚</div>
              <h3>No purchase orders</h3>
              <p>Create a purchase order to restock inventory from a supplier.</p>
              <div className="mt-16">
                <Link to="/purchases/new" className="btn btn-primary">+ New Purchase Order</Link>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PO #</th><th>Supplier</th><th>Date</th><th>Status</th>
                    <th>Currency</th><th className="right">Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => {
                    const [cls, label] = statusBadge(po.status);
                    return (
                      <tr key={po.id}>
                        <td>
                          <Link to={`/purchases/${po.id}`} className="strong mono" style={{ color: '#4f46e5', textDecoration: 'none' }}>
                            {po.po_no}
                          </Link>
                          <div className="muted">by {po.user_name}</div>
                        </td>
                        <td>{po.supplier_name || '—'}</td>
                        <td className="muted-text">{fmtDate(po.created_at)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td className="mono">{po.currency}</td>
                        <td className="right"><strong>{fmtMoney(po.total, po.currency)}</strong></td>
                        <td className="right">
                          <Link to={`/purchases/${po.id}`} className="btn btn-ghost btn-sm">View →</Link>
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
    </div>
  );
}
