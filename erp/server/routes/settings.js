const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

// Supported currencies (in a real app, fetch rates from a provider)
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 1.09 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', rate: 0.0203 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 1.27 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 0.266 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 0.272 },
];

router.get('/currencies', authRequired, (_req, res) => {
  res.json(CURRENCIES);
});

router.get('/', authRequired, (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  res.json(obj);
});

router.put('/', authRequired, adminOnly, (req, res) => {
  const body = req.body || {};
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const trx = db.transaction((entries) => entries.forEach(([k, v]) => upsert.run(k, String(v))));
  trx(Object.entries(body));
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  res.json(obj);
});

module.exports = router;
module.exports.CURRENCIES = CURRENCIES;
