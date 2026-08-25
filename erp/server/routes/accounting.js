const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

// Chart of accounts
router.get('/accounts', authRequired, (req, res) => {
  res.json(db.prepare('SELECT * FROM accounts ORDER BY code').all());
});

router.post('/accounts', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name || !b.type)
    return res.status(400).json({ error: 'Code, name and type are required' });
  try {
    const info = db
      .prepare('INSERT INTO accounts (code, name, type, balance) VALUES (?, ?, ?, ?)')
      .run(b.code, b.name, b.type, Number(b.balance) || 0);
    res.status(201).json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Account code already exists' });
    res.status(500).json({ error: e.message });
  }
});

// Transactions / general ledger
router.get('/transactions', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*,
              da.name AS debit_name, da.code AS debit_code,
              ca.name AS credit_name, ca.code AS credit_code
       FROM transactions t
       LEFT JOIN accounts da ON da.id = t.debit_account_id
       LEFT JOIN accounts ca ON ca.id = t.credit_account_id
       ORDER BY t.date DESC, t.id DESC`
    )
    .all();
  res.json(rows);
});

// Manual journal entry
router.post('/transactions', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!b.date || !b.description || !b.amount || !b.debit_account_id || !b.credit_account_id)
    return res.status(400).json({ error: 'Date, description, amount, debit and credit accounts are required' });
  if (b.debit_account_id === b.credit_account_id)
    return res.status(400).json({ error: 'Debit and credit accounts must differ' });

  const amount = +Number(b.amount).toFixed(2);
  const trx = db.transaction(() => {
    const txnNo = (() => {
      const ymd = b.date.replace(/-/g, '');
      const count = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE txn_no LIKE ?").get(`TXN-${ymd}%`).c + 1;
      return `TXN-${ymd}-${String(count).padStart(4, '0')}`;
    })();
    const info = db
      .prepare(
        `INSERT INTO transactions (txn_no, date, description, reference, amount, debit_account_id, credit_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(txnNo, b.date, b.description, b.reference || null, amount, b.debit_account_id, b.credit_account_id);

    // For asset/expense accounts, debit increases balance; for liability/equity/revenue, credit increases balance
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, b.debit_account_id);
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, b.credit_account_id);

    return info.lastInsertRowid;
  });

  const id = trx();
  res.status(201).json(
    db
      .prepare(
        `SELECT t.*, da.name AS debit_name, ca.name AS credit_name
         FROM transactions t
         LEFT JOIN accounts da ON da.id = t.debit_account_id
         LEFT JOIN accounts ca ON ca.id = t.credit_account_id
         WHERE t.id = ?`
      )
      .get(id)
  );
});

module.exports = router;
