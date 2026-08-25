import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, download } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtMoney, fmtDate, fmtDateTime, statusBadge } from '../utils.js';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function load() {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function changeStatus(status) {
    if (status === 'cancelled' && !confirm('Cancel this order?')) return;
    if (status === 'completed' && !confirm('Mark as completed? This deducts stock, generates an invoice, and posts accounting entries.')) return;
    setUpdating(true);
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try { await api(`/orders/${id}`, { method: 'DELETE' }); navigate('/orders'); }
    catch (err) { alert(err.message); }
  }

  function exportPdf() {
    setDownloading(true);
    download(`/documents/invoice/${id}.pdf`, `${order?.invoice_no || order?.order_no || 'invoice'}.pdf`)
      .catch((e) => alert(e.message))
      .finally(() => setDownloading(false));
  }

  if (error) return <div className="alert alert-danger">⚠ {error}</div>;
  if (!order) return <div className="page-loading"><span className="spinner" />Loading order…</div>;

  const [badgeCls, badgeLabel] = statusBadge(order.status);

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/orders" className="btn btn-ghost btn-sm">← Back to orders</Link>
        {order.invoice_no && (
          <button className="btn btn-primary" onClick={exportPdf} disabled={downloading}>
            {downloading ? <span className="spinner" /> : '📄 Download Invoice PDF'}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: 22 }}>
              <span className="mono">{order.order_no}</span>
              <span className={`badge ${badgeCls}`} style={{ marginLeft: 12, verticalAlign: 'middle' }}>{badgeLabel}</span>
              {order.invoice_no && (
                <span className="badge badge-purple" style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                  {order.invoice_no}
                </span>
              )}
            </h2>
            <div className="sub">
              Created {fmtDateTime(order.created_at)} by {order.user_name}
              {order.due_date && ` · Due ${fmtDate(order.due_date)}`}
            </div>
          </div>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            {order.status === 'draft' && (
              <button className="btn btn-secondary" disabled={updating} onClick={() => changeStatus('confirmed')}>Mark Confirmed</button>
            )}
            {(order.status === 'draft' || order.status === 'confirmed') && (
              <button className="btn btn-primary" disabled={updating} onClick={() => changeStatus('completed')}>
                {updating ? <span className="spinner" /> : 'Complete & Invoice'}
              </button>
            )}
            {order.status !== 'cancelled' && order.status !== 'completed' && (
              <button className="btn btn-secondary" disabled={updating} onClick={() => changeStatus('cancelled')}>Cancel</button>
            )}
            {!order.invoice_no && order.status !== 'completed' && (
              <button className="btn btn-secondary" onClick={exportPdf} disabled={downloading}>
                {downloading ? <span className="spinner" /> : '📄 Preview Invoice'}
              </button>
            )}
            {isAdmin && order.status !== 'completed' && (
              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={remove}>Delete</button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div>
              <div className="muted-text" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>CUSTOMER</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{order.customer_company || order.customer_name}</div>
              {order.customer_company && order.customer_name && <div className="muted-text">{order.customer_name}</div>}
              {order.customer_email && <div className="muted-text">{order.customer_email}</div>}
              {order.customer_phone && <div className="muted-text">{order.customer_phone}</div>}
              {order.customer_address && <div className="muted-text">{order.customer_address}</div>}
              {order.customer_tax_id && <div className="muted-text mono">Tax ID: {order.customer_tax_id}</div>}
            </div>
            <div>
              <div className="muted-text" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>ORDER DETAILS</div>
              <div>Date: <strong>{fmtDate(order.created_at)}</strong></div>
              <div>Currency: <strong>{order.currency}</strong> {order.currency !== 'USD' && `(rate: ${order.exchange_rate})`}</div>
              <div>{order.tax_name}: <strong>{order.tax_rate}%</strong></div>
              {order.shipping_address && <div>Ship to: <strong>{order.shipping_address}</strong></div>}
            </div>
          </div>

          {order.notes && (
            <div className="alert alert-info" style={{ marginTop: 20 }}>📝 {order.notes}</div>
          )}
        </div>

        <div className="card-body flush">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th className="right">Qty</th>
                <th className="right">Unit Price</th><th className="right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td><div className="strong">{it.product_name || it.description}</div></td>
                  <td className="mono muted-text">{it.product_sku}</td>
                  <td className="right">{it.quantity}</td>
                  <td className="right">{fmtMoney(it.unit_price, order.currency)}</td>
                  <td className="right"><strong>{fmtMoney(it.total, order.currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card-body">
          <div className="totals-box">
            <div className="row"><span>Subtotal</span><span>{fmtMoney(order.subtotal, order.currency)}</span></div>
            <div className="row"><span>{order.tax_name} ({order.tax_rate}%)</span><span>{fmtMoney(order.tax_amount, order.currency)}</span></div>
            <div className="row grand"><span>Total Due</span><span>{fmtMoney(order.total, order.currency)}</span></div>
            {order.currency !== 'USD' && (
              <div className="muted-text" style={{ fontSize: 12, marginTop: 8, textAlign: 'right' }}>
                ≈ {fmtMoney(order.total * order.exchange_rate, 'USD')} in base currency
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
