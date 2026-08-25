import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtMoney, fmtDate, accountTypeBadge } from '../utils.js';
import Modal from '../components/Modal.jsx';

const accTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

export default function Accounting() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '', reference: '', amount: '',
    debit_account_id: '', credit_account_id: '',
  });

  function load() {
    setLoading(true);
    Promise.all([api('/accounting/accounts'), api('/accounting/transactions')])
      .then(([a, t]) => { setAccounts(a); setTransactions(t); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const totalAssets = accounts.filter((a) => a.type === 'asset').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter((a) => a.type === 'liability').reduce((s, a) => s + a.balance, 0);
  const totalEquity = accounts.filter((a) => a.type === 'equity').reduce((s, a) => s + a.balance, 0);
  const totalRevenue = accounts.filter((a) => a.type === 'revenue').reduce((s, a) => s - a.balance, 0);
  const totalExpense = accounts.filter((a) => a.type === 'expense').reduce((s, a) => s + a.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  async function postTxn(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api('/accounting/transactions', {
        method: 'POST',
        body: {
          ...form,
          amount: Number(form.amount),
          debit_account_id: Number(form.debit_account_id),
          credit_account_id: Number(form.credit_account_id),
        },
      });
      setModalOpen(false);
      setForm({ date: new Date().toISOString().slice(0, 10), description: '', reference: '', amount: '', debit_account_id: '', credit_account_id: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon-box green">💵</div>
          <div className="label">Total Assets</div>
          <div className="value">{fmtMoney(totalAssets)}</div>
        </div>
        <div className="stat-card">
          <div className="icon-box amber">📋</div>
          <div className="label">Liabilities</div>
          <div className="value">{fmtMoney(totalLiabilities)}</div>
        </div>
        <div className="stat-card">
          <div className="icon-box violet">🏛️</div>
          <div className="label">Equity</div>
          <div className="value">{fmtMoney(totalEquity)}</div>
        </div>
        <div className="stat-card">
          <div className="icon-box indigo">📈</div>
          <div className="label">Net Income</div>
          <div className="value">{fmtMoney(netIncome)}</div>
          <div className="delta up">Rev {fmtMoney(totalRevenue)} · Exp {fmtMoney(totalExpense)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Chart of Accounts</h2>
            <div className="sub">Balances update automatically from completed orders and journal entries.</div>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setError(''); setModalOpen(true); }}>
              + Journal Entry
            </button>
          )}
        </div>
        <div className="card-body flush">
          {loading ? (
            <div className="page-loading"><span className="spinner" />Loading…</div>
          ) : (
            <table>
              <thead>
                <tr><th>Code</th><th>Account</th><th>Type</th><th className="right">Balance</th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const [cls, label] = accountTypeBadge(a.type);
                  // Revenue balances are stored negative (credit-normal); display positive
                  const display = a.type === 'revenue' ? -a.balance : a.balance;
                  return (
                    <tr key={a.id}>
                      <td className="mono">{a.code}</td>
                      <td><div className="strong">{a.name}</div></td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td className="right"><strong>{fmtMoney(display)}</strong></td>
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
          <h2>General Ledger — Recent Transactions</h2>
        </div>
        <div className="card-body flush">
          {transactions.length === 0 ? (
            <div className="empty"><div className="icon">📒</div><p>No transactions yet.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Txn #</th><th>Description</th>
                  <th>Debit</th><th>Credit</th><th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="muted-text">{fmtDate(t.date)}</td>
                    <td className="mono">{t.txn_no}</td>
                    <td>
                      <div className="strong">{t.description}</div>
                      {t.reference && <div className="muted">Ref: {t.reference}</div>}
                    </td>
                    <td>{t.debit_code} — {t.debit_name}</td>
                    <td>{t.credit_code} — {t.credit_name}</td>
                    <td className="right"><strong>{fmtMoney(t.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        title="New Journal Entry"
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="txn-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Post Entry'}
            </button>
          </>
        }
      >
        <form id="txn-form" onSubmit={postTxn}>
          {error && <div className="alert alert-danger">⚠ {error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Debit Account *</label>
              <select required value={form.debit_account_id} onChange={(e) => setForm({ ...form, debit_account_id: e.target.value })}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Credit Account *</label>
              <select required value={form.credit_account_id} onChange={(e) => setForm({ ...form, credit_account_id: e.target.value })}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Amount *</label>
            <input type="number" step="0.01" min="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
