import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtMoney, CURRENCY_MAP } from '../utils.js';

export default function NewPurchaseOrder() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [taxRate, setTaxRate] = useState(14);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_cost: 0, total: 0 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api('/suppliers'), api('/products'), api('/settings/currencies')])
      .then(([s, p, c]) => {
        setSuppliers(s); setProducts(p); setCurrencies(c);
        // Load defaults from settings
        return api('/settings');
      })
      .then((settings) => {
        if (settings.default_currency) setCurrency(settings.default_currency);
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
        if (prod) next[idx].unit_cost = prod.cost_price;
      }
      next[idx].total = +(Number(next[idx].quantity) * Number(next[idx].unit_cost)).toFixed(2);
      return next;
    });
  }
  function addItem() {
    setItems((prev) => [...prev, { product_id: '', quantity: 1, unit_cost: 0, total: 0 }]);
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
    if (!supplierId) return setError('Please select a supplier.');
    const validItems = items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) return setError('Add at least one product with a positive quantity.');

    setSaving(true);
    try {
      const created = await api('/purchases', {
        method: 'POST',
        body: {
          supplier_id: Number(supplierId),
          currency, exchange_rate: Number(exchangeRate),
          tax_rate: Number(taxRate), notes, status,
          items: validItems,
        },
      });
      navigate(`/purchases/${created.id}`);
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
            <h2>New Purchase Order</h2>
            <div className="sub">Order stock from a supplier. Marking as "received" updates inventory and accounts payable.</div>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <form onSubmit={submit}>
            <div className="form-row-3">
              <div className="form-group">
                <label>Supplier *</label>
                <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Select a supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="received">Received (add to stock & A/P)</option>
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
                Exchange rate: 1 {currency} = <strong>{exchangeRate}</strong> USD. The PO total will be converted to your base currency (USD) for accounting postings.
                <div style={{ marginTop: 8 }}>
                  <input
                    type="number" step="0.0001" min="0"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Line Items</label>
              <div className="line-items">
                <div className="line-item-row header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px' }}>
                  <div>Product</div><div>Qty</div><div>Unit Cost</div><div>Total</div><div></div>
                </div>
                {items.map((it, idx) => (
                  <div className="line-item-row" key={idx} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 40px' }}>
                    <select value={it.product_id} onChange={(e) => updateItem(idx, { product_id: e.target.value })}>
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — stock: {p.stock}
                        </option>
                      ))}
                    </select>
                    <input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                    <input type="number" min="0" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: e.target.value })} />
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{fmtMoney(it.total, currency)}</div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-sm mt-16" onClick={addItem}>+ Add line</button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>VAT / Tax Rate (%)</label>
                <input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
              </div>
            </div>

            <div className="totals-box">
              <div className="row"><span>Subtotal</span><span>{fmtMoney(subtotal, currency)}</span></div>
              <div className="row"><span>VAT ({taxRate}%)</span><span>{fmtMoney(taxAmount, currency)}</span></div>
              <div className="row grand"><span>Total</span><span>{fmtMoney(total, currency)}</span></div>
            </div>

            <div className="flex gap-12 mt-24">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/purchases')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
