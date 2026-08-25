const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

// Categories
router.get('/categories', authRequired, (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

router.post('/categories', authRequired, adminOnly, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/categories/:id', authRequired, adminOnly, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Products
router.get('/', authRequired, (req, res) => {
  const { q, category_id, supplier_id, low } = req.query;
  let sql = `SELECT p.*, c.name AS category_name, s.name AS supplier_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (supplier_id) {
    sql += ' AND p.supplier_id = ?';
    params.push(supplier_id);
  }
  if (low === '1') sql += ' AND p.stock <= p.reorder_level';
  sql += ' ORDER BY p.name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', authRequired, (req, res) => {
  const p = db
    .prepare(
      `SELECT p.*, c.name AS category_name, s.name AS supplier_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

router.post('/', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  if (!b.sku || !b.name)
    return res.status(400).json({ error: 'SKU and name are required' });
  try {
    const info = db
      .prepare(
        `INSERT INTO products (sku, name, description, category_id, supplier_id, unit, cost_price, sale_price, stock, reorder_level)
         VALUES (@sku, @name, @description, @category_id, @supplier_id, @unit, @cost_price, @sale_price, @stock, @reorder_level)`
      )
      .run({
        sku: b.sku,
        name: b.name,
        description: b.description || null,
        category_id: b.category_id || null,
        supplier_id: b.supplier_id || null,
        unit: b.unit || 'pcs',
        cost_price: Number(b.cost_price) || 0,
        sale_price: Number(b.sale_price) || 0,
        stock: Number(b.stock) || 0,
        reorder_level: Number(b.reorder_level) || 0,
      });
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', authRequired, adminOnly, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare(
    `UPDATE products SET
      sku = COALESCE(?, sku),
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      category_id = COALESCE(?, category_id),
      supplier_id = COALESCE(?, supplier_id),
      unit = COALESCE(?, unit),
      cost_price = COALESCE(?, cost_price),
      sale_price = COALESCE(?, sale_price),
      stock = COALESCE(?, stock),
      reorder_level = COALESCE(?, reorder_level)
     WHERE id = ?`
  ).run(
    b.sku ?? null,
    b.name ?? null,
    b.description ?? null,
    b.category_id ?? null,
    b.supplier_id ?? null,
    b.unit ?? null,
    b.cost_price != null ? Number(b.cost_price) : null,
    b.sale_price != null ? Number(b.sale_price) : null,
    b.stock != null ? Number(b.stock) : null,
    b.reorder_level != null ? Number(b.reorder_level) : null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authRequired, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
