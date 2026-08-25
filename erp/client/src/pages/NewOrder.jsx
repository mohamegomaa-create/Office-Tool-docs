import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtMoney } from '../utils.js';

export default function NewOrder() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [taxName, setTaxName] = useState('VAT');
  const [taxRate, setTaxRate] = useState(14);
  const [dueDate, setDueDate] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api('/customers'), api('/products'), api('/settings/currencies'), api('/settings')])
      .then(([c, p, curr, settings]) => {
        setCustomers(c); setProducts(p); setCurrencies(curr);
        if (settings.default_currency) {
          setCurrency(settings.default_currency);
          const found = curr.find((x) => x.code === settings.default_currency);
          if (found) setExchangeRate(found.rate);
        }
        if (settings.default_tax_name) setTaxName(settings.default_tax_name);
        if (settings.default_tax_rate) setTaxRate(Number(settings.default_tax_rate));
      })
      .catch((e) => setError(e.message));
  }, []);

  function onCurrencyChange(code) {
    setCurrency(code);
    const c = currencies.find((x) => x.code === code);
    if (c) setExchangeRate(c.rate);
  }

  function updateItem(idx, patch) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      if (patch.product_id !== undefined) {
        const prod = products.find((p) => String(p.id) === String(patch.product_id));
        if (prod) next[idx].unit_price = prod.sale_price;
      }
      next[idx].total = +(Number(next[idx].quantity) * Number(next[idx].unit_price)).toFixed(2);
      return next;
    });
  }
  function addItem() {
    setItems((prev) => [...prev, { product_id: '', quantity: 1, unit_price: 0, total: 0 }]);
  }
  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((sum, it) => sum + Number(it.total) || 0, 0);
  const taxAmount = +(subtotal * Number(taxRate) / 100).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!customerId) return setError('Please select a customer.');
    const validItems = items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) return setError('Add at least one product with a positive quantity.');

    if (status === 'completed') {
      for (const it of validItems) {
        const p = products.find((x) => String(x.id) === String(it.product_id));
        if (p && Number(it.quantity) > p.stock) {
          return setError(`Not enough stock for "${p.name}" (available: ${p.stock}).`);
        }
      }
    }

    setSaving(true);
    try {
      const created = await api('/orders', {
        method: 'POST',
        body: {
          customer_id: Number(customerId),
          currency, exchange_rate: Number(exchangeRate),
          tax_name: taxName, tax_rate: Number(taxRate),
          due_date: dueDate || null,
          shipping_address: shippingAddress || null,
          notes, status,
          items: validItems,
        },
      });
      navigate(`/orders/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>New Sales Order</h2>
            <div className="sub">Create a draft or complete the sale immediately. Completed orders generate an invoice and deduct stock.</div>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <form onSubmit={submit}>
            <div className="form-row-3">
              <div className="form-group">
                <label>Customer *</label>
                <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.company ? `— ${c.company}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed (invoice + deduct stock)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
            </div>

            {currency !== 'USD' && (
              <div className="alert alert-info">
                Exchange rate: 1 {currency} = <strong>{exchangeRate}</strong> USD. The order total is recorded in {currency} and converted to your base currency for the general ledger.
                <div style={{ marginTop: 8 }}>
                  <input type="number" step="0.0001" min="0" value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)} style={{ maxWidth: 160 }} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Line Items</label>
              <div className="line-items">
                <div className="line-item-row header">
                  <div>Product</div><div>Qty</div><div>Unit Price</div><div>Total</div><div></div>
                </div>
                {items.map((it, idx) => (
                  <div className="line-item-row" key={idx}>
                    <select value={it.product_id} onChange={(e) => updateItem(idx, { product_id: e.target.value })}>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku}) — stock: {p.stock}</option>
                      ))}
                    </select>
                    <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                    <input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} />
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{fmtMoney(it.total, currency)}</div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-sm mt-16" onClick={addItem}>+ Add line</button>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label>{taxName || 'Tax'} Rate (%)</label>
                <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tax Label</label>
                <input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="VAT" />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label>Shipping Address</label>
              <input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Optional shipping address…" />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes shown on the invoice…" />
            </div>

            <div className="totals-box">
              <div className="row"><span>Subtotal</span><span>{fmtMoney(subtotal, currency)}</span></div>
              <div className="row"><span>{taxName} ({taxRate}%)</span><span>{fmtMoney(taxAmount, currency)}</span></div>
              <div className="row grand"><span>Total</span><span>{fmtMoney(total, currency)}</span></div>
            </div>

            <div className="flex gap-12 mt-24">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/orders')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
