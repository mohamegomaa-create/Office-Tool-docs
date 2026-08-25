const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

function genPoNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) AS c FROM purchase_orders WHERE po_no LIKE ?").get(`PO-${ymd}%`).c + 1;
  return `PO-${ymd}-${String(count).padStart(4, '0')}`;
}

function genTxnNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE txn_no LIKE ?").get(`TXN-${ymd}%`).c + 1;
  return `TXN-${ymd}-${String(count).padStart(4, '0')}`;
}

function accountId(code) {
  const row = db.prepare('SELECT id FROM accounts WHERE code = ?').get(code);
  if (!row) throw new Error(`Account ${code} not found in chart of accounts`);
  return row.id;
}

// List purchase orders
router.get('/', authRequired, (req, res) => {
  const { status, q } = req.query;
  let sql = `SELECT po.*, s.name AS supplier_name, u.name AS user_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON s.id = po.supplier_id
             LEFT JOIN users u ON u.id = po.user_id
             WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND po.status = ?'; params.push(status); }
  if (q) { sql += ' AND po.po_no LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY po.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', authRequired, (req, res) => {
  const po = db
    .prepare(
      `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone,
              s.address AS supplier_address, s.tax_id AS supplier_tax_id,
              u.name AS user_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.user_id
       WHERE po.id = ?`
    )
    .get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  po.items = db
    .prepare(
      `SELECT pi.*, p.name AS product_name, p.sku AS product_sku
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.po_id = ?`
    )
    .all(req.params.id);
  res.json(po);
});

function validateAndBuildItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw new Error('At least one line item is required');
  let subtotal = 0;
  const lines = items.map((it) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
    if (!product) throw new Error(`Product ${it.product_id} not found`);
    const qty = Number(it.quantity);
    if (qty <= 0) throw new Error('Quantity must be positive');
    const unitCost = Number(it.unit_cost) || product.cost_price;
    const total = +(qty * unitCost).toFixed(2);
    subtotal += total;
    return { product_id: product.id, description: product.name, quantity: qty, unit_cost: unitCost, total };
  });
  return { lines, subtotal: +subtotal.toFixed(2) };
}

// Create PO
router.post('/', authRequired, (req, res) => {
  const b = req.body || {};
  if (!b.supplier_id) return res.status(400).json({ error: 'Supplier is required' });
  const status = b.status || 'draft';
  if (!['draft', 'submitted', 'received', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const { lines, subtotal } = validateAndBuildItems(b.items);
    const taxRate = Number(b.tax_rate) || 0;
    const taxAmount = +(subtotal * taxRate / 100).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);
    const currency = b.currency || 'USD';
    const exchangeRate = Number(b.exchange_rate) || 1;

    const trx = db.transaction(() => {
      const poNo = genPoNo();
      const info = db
        .prepare(
          `INSERT INTO purchase_orders
           (po_no, supplier_id, user_id, status, currency, exchange_rate, tax_name,
            subtotal, tax_rate, tax_amount, total, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(poNo, b.supplier_id, req.user.id, status, currency, exchangeRate,
          b.tax_name || 'VAT', subtotal, taxRate, taxAmount, total, b.notes || null);
      const poId = info.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO purchase_items (po_id, product_id, description, quantity, unit_cost, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      lines.forEach((it) => insertItem.run(poId, it.product_id, it.description, it.quantity, it.unit_cost, it.total));

      if (status === 'received') receivePurchaseOrder(poId, lines, total, exchangeRate);
      return poId;
    });

    const poId = trx();
    res.status(201).json({ id: poId, ...getPoFull(poId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function getPoFull(id) {
  return db
    .prepare(
      `SELECT po.*, s.name AS supplier_name, u.name AS user_name
       FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.user_id WHERE po.id = ?`
    )
    .get(id);
}

// On receive: increase stock, optionally update cost, post Inventory -> A/P (in base currency)
function receivePurchaseOrder(poId, lineItems, foreignTotal, exchangeRate) {
  const addStock = db.prepare('UPDATE products SET stock = stock + ?, cost_price = ? WHERE id = ?');
  lineItems.forEach((it) => addStock.run(it.quantity, it.unit_cost, it.product_id));

  db.prepare('UPDATE purchase_orders SET received_at = ?, status = ? WHERE id = ?')
    .run(new Date().toISOString(), 'received', poId);

  const date = new Date().toISOString().slice(0, 10);
  const po = db.prepare('SELECT po_no, currency FROM purchase_orders WHERE id = ?').get(poId);
  const baseTotal = +(foreignTotal * exchangeRate).toFixed(2);

  const invId = accountId('1300');
  const apId = accountId('2000');

  db.prepare(
    `INSERT INTO transactions (txn_no, date, description, reference, amount, debit_account_id, credit_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    genTxnNo(), date, `Stock receipt ${po.po_no}`, po.po_no, baseTotal, invId, apId
  );

  // Asset (inventory) increases on debit; liability (A/P) increases on credit
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(baseTotal, invId);
  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(baseTotal, apId);
}

// Update status (submit / receive / cancel)
router.patch('/:id/status', authRequired, (req, res) => {
  const { status } = req.body || {};
  if (!['draft', 'submitted', 'received', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });

  try {
    const trx = db.transaction(() => {
      if (status === 'received' && po.status !== 'received') {
        const items = db.prepare('SELECT * FROM purchase_items WHERE po_id = ?').all(po.id);
        receivePurchaseOrder(po.id, items, po.total, po.exchange_rate);
      } else {
        db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(status, po.id);
      }
    });
    trx();
    res.json(getPoFull(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', authRequired, adminOnly, (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Purchase order not found' });
  if (po.status === 'received')
    return res.status(400).json({ error: 'Cannot delete a received purchase order' });
  db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
