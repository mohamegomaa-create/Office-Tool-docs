import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { fmtMoney, fmtNum, fmtDate, statusBadge } from '../utils.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/stats').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-danger">⚠ {error}</div>;
  if (!data) return <div className="page-loading"><span className="spinner" />Loading dashboard…</div>;

  const maxTrend = Math.max(1, ...data.salesTrend.map((d) => d.total));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = data.salesTrend.find((r) => r.date === key);
    days.push({ date: key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), total: found ? found.total : 0 });
  }

  const c = data.counts;
  const f = data.finance;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon-box indigo">💰</div>
          <div className="label">Total Sales</div>
          <div className="value">{fmtMoney(f.totalSales)}</div>
          <div className="delta up">↑ {fmtMoney(f.monthSales)} this month</div>
        </div>
        <div className="stat-card">
          <div className="icon-box rose">🛒</div>
          <div className="label">Total Purchases</div>
          <div className="value">{fmtMoney(f.totalPurchases)}</div>
          <div className="delta">{c.suppliers} active suppliers</div>
        </div>
        <div className="stat-card">
          <div className="icon-box green">📦</div>
          <div className="label">Inventory Value</div>
          <div className="value">{fmtMoney(f.inventoryValue)}</div>
          <div className="delta">{fmtNum(c.products)} products · {c.lowStock} low stock</div>
        </div>
        <div className="stat-card">
          <div className="icon-box blue">🏦</div>
          <div className="label">Cash & Bank</div>
          <div className="value">{fmtMoney(f.cashBank)}</div>
          <div className="delta">A/R {fmtMoney(f.receivables)} · A/P {fmtMoney(f.payables)}</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 4 }}>Pending Sales Orders</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(c.pendingOrders)}</div>
        </div>
        <div className="stat-card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 4 }}>Pending POs to Receive</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(c.pendingPOs)}</div>
        </div>
        <div className="stat-card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 4 }}>Customers</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(c.customers)}</div>
        </div>
        <div className="stat-card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 4 }}>Suppliers</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNum(c.suppliers)}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Sales — Last 7 Days</h2>
              <div className="sub">Completed order revenue (converted to base currency)</div>
            </div>
          </div>
          <div className="card-body">
            <div className="bar-chart">
              {days.map((d) => (
                <div className="bar-col" key={d.date}>
                  <div className="bar-value">{d.total > 0 ? fmtMoney(d.total).replace(/\.00$/, '') : ''}</div>
                  <div className="bar" style={{ height: `${(d.total / maxTrend) * 100}%` }} title={fmtMoney(d.total)} />
                  <div className="bar-label">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Top Products</h2></div>
          <div className="card-body flush">
            {data.topProducts.length === 0 ? (
              <div className="empty">
                <div className="icon">📈</div>
                <p>Complete an order to see top products.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th className="right">Qty</th><th className="right">Revenue</th></tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p) => (
                      <tr key={p.sku}>
                        <td><div className="strong">{p.name}</div><div className="muted mono">{p.sku}</div></td>
                        <td className="right">{fmtNum(p.qty)}</td>
                        <td className="right"><strong>{fmtMoney(p.revenue)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Recent Sales Orders</h2>
            <Link to="/orders" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="card-body flush">
            {data.recentOrders.length === 0 ? (
              <div className="empty"><div className="icon">🧾</div><p>No orders yet.</p></div>
            ) : (
              <table>
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Status</th><th className="right">Total</th></tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((o) => {
                    const [cls, label] = statusBadge(o.status);
                    return (
                      <tr key={o.id} className="cursor-pointer" onClick={() => (window.location.href = `/orders/${o.id}`)}>
                        <td>
                          <div className="strong mono">{o.order_no}</div>
                          <div className="muted">{fmtDate(o.created_at)} · {o.currency}</div>
                        </td>
                        <td>{o.customer_name || '—'}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td className="right"><strong>{fmtMoney(o.total, o.currency)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Recent Purchase Orders</h2>
            <Link to="/purchases" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="card-body flush">
            {data.recentPOs.length === 0 ? (
              <div className="empty"><div className="icon">🚚</div><p>No purchase orders yet.</p></div>
            ) : (
              <table>
                <thead>
                  <tr><th>PO #</th><th>Supplier</th><th>Status</th><th className="right">Total</th></tr>
                </thead>
                <tbody>
                  {data.recentPOs.map((po) => {
                    const [cls, label] = statusBadge(po.status);
                    return (
                      <tr key={po.id} className="cursor-pointer" onClick={() => (window.location.href = `/purchases/${po.id}`)}>
                        <td>
                          <div className="strong mono">{po.po_no}</div>
                          <div className="muted">{fmtDate(po.created_at)} · {po.currency}</div>
                        </td>
                        <td>{po.supplier_name || '—'}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td className="right"><strong>{fmtMoney(po.total, po.currency)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Low Stock Alerts</h2>
          <Link to="/products" className="btn btn-ghost btn-sm">Inventory →</Link>
        </div>
        <div className="card-body flush">
          {data.lowStock.length === 0 ? (
            <div className="empty"><div className="icon">✅</div><p>All products are well stocked.</p></div>
          ) : (
            <table>
              <thead>
                <tr><th>Product</th><th className="right">Stock</th><th className="right">Reorder Level</th><th></th></tr>
              </thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id}>
                    <td><div className="strong">{p.name}</div><div className="muted mono">{p.sku}</div></td>
                    <td className="right"><span className="badge badge-danger">{p.stock}</span></td>
                    <td className="right muted-text">{p.reorder_level}</td>
                    <td className="right">
                      <Link to="/purchases/new" className="btn btn-secondary btn-sm">+ Restock</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
