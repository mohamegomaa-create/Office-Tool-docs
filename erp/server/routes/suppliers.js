const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM suppliers';
  const params = [];
  if (q) {
    sql += ' WHERE name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR phone LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', authRequired, (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Supplier not found' });
  s.products = db
    .prepare('SELECT id, sku, name, stock, cost_price, sale_price FROM products WHERE supplier_id = ? ORDER BY name')
    .all(req.params.id);
  s.purchase_orders = db
    .prepare('SELECT id, po_no, status, total, created_at FROM purchase_orders WHERE supplier_id = ? ORDER BY id DESC LIMIT 20')
    .all(req.params.id);
  res.json(s);
});

router.post('/', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Supplier name is required' });
  const info = db
    .prepare(
      `INSERT INTO suppliers (name, contact_name, email, phone, address, tax_id, payment_terms)
       VALUES (@name, @contact_name, @email, @phone, @address, @tax_id, @payment_terms)`
    )
    .run({
      name: b.name,
      contact_name: b.contact_name || null,
      email: b.email || null,
      phone: b.phone || null,
      address: b.address || null,
      tax_id: b.tax_id || null,
      payment_terms: b.payment_terms || null,
    });
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Supplier not found' });
  db.prepare(
    `UPDATE suppliers SET
      name = COALESCE(?, name),
      contact_name = COALESCE(?, contact_name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      tax_id = COALESCE(?, tax_id),
      payment_terms = COALESCE(?, payment_terms)
     WHERE id = ?`
  ).run(
    b.name ?? null,
    b.contact_name ?? null,
    b.email ?? null,
    b.phone ?? null,
    b.address ?? null,
    b.tax_id ?? null,
    b.payment_terms ?? null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authRequired, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Cannot delete a supplier linked to existing records.' });
  }
});

module.exports = router;
