import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '../api';
import { fmtMoney, fmtDate, statusBadge } from '../utils.js';

const statuses = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api(`/orders?${params.toString()}`)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, q]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    download(`/documents/orders.csv?${params.toString()}`, 'sales-orders.csv')
      .catch((e) => alert(e.message));
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          <input placeholder="Search order or invoice number…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={exportCsv}>⬇ Export CSV</button>
        <Link to="/orders/new" className="btn btn-primary">+ New Order</Link>
      </div>

      {error && <div className="alert alert-danger">⚠ {error}</div>}

      <div className="card">
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="empty">
              <div className="icon">🧾</div>
              <h3>No sales orders</h3>
              <p>Create your first sales order to start recording revenue.</p>
              <div className="mt-16">
                <Link to="/orders/new" className="btn btn-primary">+ New Order</Link>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th><th>Invoice</th><th>Customer</th><th>Date</th>
                    <th>Status</th><th>Currency</th><th className="right">Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const [cls, label] = statusBadge(o.status);
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/orders/${o.id}`} className="strong mono" style={{ color: '#4f46e5', textDecoration: 'none' }}>
                            {o.order_no}
                          </Link>
                          <div className="muted">by {o.user_name}</div>
                        </td>
                        <td>{o.invoice_no ? <span className="badge badge-purple">{o.invoice_no}</span> : <span className="muted-text">—</span>}</td>
                        <td>{o.customer_name || '—'}</td>
                        <td className="muted-text">{fmtDate(o.created_at)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td className="mono">{o.currency}</td>
                        <td className="right"><strong>{fmtMoney(o.total, o.currency)}</strong></td>
                        <td className="right">
                          <Link to={`/orders/${o.id}`} className="btn btn-ghost btn-sm">View →</Link>
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
