const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM customers';
  const params = [];
  if (q) {
    sql += ' WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  c.orders = db
    .prepare('SELECT id, order_no, status, total, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 20')
    .all(req.params.id);
  res.json(c);
});

router.post('/', authRequired, (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Name is required' });
  const info = db
    .prepare(
      `INSERT INTO customers (name, email, phone, address, company)
       VALUES (@name, @email, @phone, @address, @company)`
    )
    .run({
      name: b.name,
      email: b.email || null,
      phone: b.phone || null,
      address: b.address || null,
      company: b.company || null,
    });
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', authRequired, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  db.prepare(
    `UPDATE customers SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      company = COALESCE(?, company)
     WHERE id = ?`
  ).run(
    b.name ?? null,
    b.email ?? null,
    b.phone ?? null,
    b.address ?? null,
    b.company ?? null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authRequired, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Cannot delete a customer with existing orders' });
  }
});

module.exports = router;
