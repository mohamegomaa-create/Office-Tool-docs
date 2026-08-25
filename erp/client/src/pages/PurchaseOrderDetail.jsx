import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtMoney, fmtDate, fmtDateTime, statusBadge } from '../utils.js';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  function load() {
    api(`/purchases/${id}`).then(setPo).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function changeStatus(status) {
    if (status === 'cancelled' && !confirm('Cancel this purchase order?')) return;
    if (status === 'received' && !confirm('Mark as received? This adds stock to inventory and posts an accounts-payable entry.')) return;
    setUpdating(true);
    try {
      await api(`/purchases/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this purchase order? This cannot be undone.')) return;
    try { await api(`/purchases/${id}`, { method: 'DELETE' }); navigate('/purchases'); }
    catch (err) { alert(err.message); }
  }

  if (error) return <div className="alert alert-danger">⚠ {error}</div>;
  if (!po) return <div className="page-loading"><span className="spinner" />Loading purchase order…</div>;

  const [badgeCls, badgeLabel] = statusBadge(po.status);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/purchases" className="btn btn-ghost btn-sm">← Back to purchase orders</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: 22 }}>
              <span className="mono">{po.po_no}</span>
              <span className={`badge ${badgeCls}`} style={{ marginLeft: 12, verticalAlign: 'middle' }}>{badgeLabel}</span>
            </h2>
            <div className="sub">Created {fmtDateTime(po.created_at)} by {po.user_name}{po.received_at ? ` · Received ${fmtDateTime(po.received_at)}` : ''}</div>
          </div>
          <div className="flex gap-8">
            {po.status === 'draft' && (
              <button className="btn btn-secondary" disabled={updating} onClick={() => changeStatus('submitted')}>Submit</button>
            )}
            {(po.status === 'draft' || po.status === 'submitted') && (
              <button className="btn btn-primary" disabled={updating} onClick={() => changeStatus('received')}>
                {updating ? <span className="spinner" /> : 'Receive Stock'}
              </button>
            )}
            {po.status !== 'cancelled' && po.status !== 'received' && (
              <button className="btn btn-secondary" disabled={updating} onClick={() => changeStatus('cancelled')}>Cancel</button>
            )}
            {isAdmin && po.status !== 'received' && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={remove}>Delete</button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div>
              <div className="muted-text" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>SUPPLIER</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{po.supplier_name}</div>
              {po.supplier_email && <div className="muted-text">{po.supplier_email}</div>}
              {po.supplier_phone && <div className="muted-text">{po.supplier_phone}</div>}
              {po.supplier_address && <div className="muted-text">{po.supplier_address}</div>}
              {po.supplier_tax_id && <div className="muted-text mono">Tax ID: {po.supplier_tax_id}</div>}
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>PURCHASE DETAILS</div>
              <div>Date: <strong>{fmtDate(po.created_at)}</strong></div>
              <div>Currency: <strong>{po.currency}</strong> {po.currency !== 'USD' && `(rate: ${po.exchange_rate})`}</div>
              <div>Tax: <strong>{po.tax_name} {po.tax_rate}%</strong></div>
            </div>
          </div>
          {po.notes && (
            <div className="alert alert-info" style={{ marginTop: 20 }}>📝 {po.notes}</div>
          )}
        </div>

        <div className="card-body flush">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th className="right">Qty</th>
                <th className="right">Unit Cost</th><th className="right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it) => (
                <tr key={it.id}>
                  <td><div className="strong">{it.product_name || it.description}</div></td>
                  <td className="mono muted-text">{it.product_sku}</td>
                  <td className="right">{it.quantity}</td>
                  <td className="right">{fmtMoney(it.unit_cost, po.currency)}</td>
                  <td className="right"><strong>{fmtMoney(it.total, po.currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-body">
          <div className="totals-box">
            <div className="row"><span>Subtotal</span><span>{fmtMoney(po.subtotal, po.currency)}</span></div>
            <div className="row"><span>{po.tax_name} ({po.tax_rate}%)</span><span>{fmtMoney(po.tax_amount, po.currency)}</span></div>
            <div className="row grand"><span>Total</span><span>{fmtMoney(po.total, po.currency)}</span></div>
            {po.currency !== 'USD' && (
              <div className="muted-text" style={{ fontSize: 12, marginTop: 8, textAlign: 'right' }}>
                ≈ {fmtMoney(po.total * po.exchange_rate, 'USD')} in base currency
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
