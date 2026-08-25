const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../auth');

const router = express.Router();

function genOrderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE order_no LIKE ?").get(`SO-${ymd}%`).c + 1;
  return `SO-${ymd}-${String(count).padStart(4, '0')}`;
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

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  return obj;
}

function nextInvoiceNo() {
  const settings = getSettings();
  const prefix = settings.invoice_prefix || 'INV';
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = db
    .prepare("SELECT invoice_no FROM orders WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1")
    .get(like);
  let next = 1;
  if (row && row.invoice_no) {
    const parts = row.invoice_no.split('-');
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}-${year}-${String(next).padStart(5, '0')}`;
}

// List orders
router.get('/', authRequired, (req, res) => {
  const { status, q, customer_id } = req.query;
  let sql = `SELECT o.*, c.name AS customer_name, u.name AS user_name
             FROM orders o
             LEFT JOIN customers c ON c.id = o.customer_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (customer_id) { sql += ' AND o.customer_id = ?'; params.push(customer_id); }
  if (q) { sql += ' AND (o.order_no LIKE ? OR o.invoice_no LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY o.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// Get single order with items
router.get('/:id', authRequired, (req, res) => {
  const order = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.address AS customer_address, c.tax_id AS customer_tax_id, c.company AS customer_company,
              u.name AS user_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`
    )
    .get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = db
    .prepare(
      `SELECT oi.*, p.name AS product_name, p.sku AS product_sku
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`
    )
    .all(req.params.id);
  res.json(order);
});

// Create order
router.post('/', authRequired, (req, res) => {
  const b = req.body || {};
  if (!b.customer_id) return res.status(400).json({ error: 'Customer is required' });
  if (!Array.isArray(b.items) || b.items.length === 0)
    return res.status(400).json({ error: 'At least one line item is required' });

  const status = b.status || 'draft';
  if (!['draft', 'confirmed', 'completed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const settings = getSettings();
  const taxRate = b.tax_rate != null ? Number(b.tax_rate) : Number(settings.default_tax_rate || 0);
  const taxName = b.tax_name || settings.default_tax_name || 'VAT';
  const currency = b.currency || settings.default_currency || 'USD';
  const exchangeRate = Number(b.exchange_rate) || 1;

  try {
    const orderId = db.transaction(() => {
      let subtotal = 0;
      const lineItems = b.items.map((it) => {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
        if (!product) throw new Error(`Product ${it.product_id} not found`);
        const qty = Number(it.quantity);
        if (qty <= 0) throw new Error('Quantity must be positive');
        if (status === 'completed' && qty > product.stock)
          throw new Error(`Insufficient stock for "${product.name}" (available: ${product.stock})`);
        const unitPrice = Number(it.unit_price) || product.sale_price;
        const total = +(qty * unitPrice).toFixed(2);
        subtotal += total;
        return { product_id: product.id, description: product.name, quantity: qty, unit_price: unitPrice, total };
      });
      subtotal = +subtotal.toFixed(2);
      const taxAmount = +(subtotal * taxRate / 100).toFixed(2);
      const total = +(subtotal + taxAmount).toFixed(2);

      const orderNo = genOrderNo();
      const info = db
        .prepare(
          `INSERT INTO orders
           (order_no, customer_id, user_id, status, currency, exchange_rate, tax_name,
            subtotal, tax_rate, tax_amount, total, due_date, shipping_address, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          orderNo, b.customer_id, req.user.id, status, currency, exchangeRate, taxName,
          subtotal, taxRate, taxAmount, total, b.due_date || null, b.shipping_address || null, b.notes || null
        );
      const newId = info.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      lineItems.forEach((it) => insertItem.run(newId, it.product_id, it.description, it.quantity, it.unit_price, it.total));

      if (status === 'completed') {
        const invoiceNo = nextInvoiceNo();
        db.prepare('UPDATE orders SET invoice_no = ? WHERE id = ?').run(invoiceNo, newId);
        fulfillOrder(newId, lineItems, total, exchangeRate);
      }
      return newId;
    })();

    res.status(201).json({ id: orderId, ...getOrderFull(orderId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function fulfillOrder(orderId, lineItems, foreignTotal, exchangeRate) {
  const stockStmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  lineItems.forEach((it) => stockStmt.run(it.quantity, it.product_id));

  const date = new Date().toISOString().slice(0, 10);
  const order = db.prepare('SELECT order_no, currency FROM orders WHERE id = ?').get(orderId);
  const baseTotal = +(foreignTotal * exchangeRate).toFixed(2);

  const arId = accountId('1200');
  const salesId = accountId('4000');
  const invId = accountId('1300');
  const cogsId = accountId('5000');

  db.prepare(
    `INSERT INTO transactions (txn_no, date, description, reference, amount, debit_account_id, credit_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(genTxnNo(), date, `Sale ${order.order_no}`, order.order_no, baseTotal, arId, salesId);

  let cogs = 0;
  lineItems.forEach((it) => {
    const p = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(it.product_id);
    cogs += it.quantity * (p ? p.cost_price : 0);
  });
  cogs = +cogs.toFixed(2);
  if (cogs > 0) {
    db.prepare(
      `INSERT INTO transactions (txn_no, date, description, reference, amount, debit_account_id, credit_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(genTxnNo(), date, `COGS for ${order.order_no}`, order.order_no, cogs, cogsId, invId);
  }

  db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(baseTotal, arId);
  db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(baseTotal, salesId);
  if (cogs > 0) {
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(cogs, cogsId);
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(cogs, invId);
  }
}

function getOrderFull(id) {
  return db
    .prepare(
      `SELECT o.*, c.name AS customer_name, u.name AS user_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?`
    )
    .get(id);
}

// Update order status
router.patch('/:id/status', authRequired, (req, res) => {
  const { status } = req.body || {};
  if (!['draft', 'confirmed', 'completed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    db.transaction(() => {
      if (status === 'completed' && order.status !== 'completed') {
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        // stock validation
        items.forEach((it) => {
          const p = db.prepare('SELECT stock, name FROM products WHERE id = ?').get(it.product_id);
          if (it.quantity > p.stock)
            throw new Error(`Insufficient stock for "${p.name}" (available: ${p.stock})`);
        });
        if (!order.invoice_no) {
          const inv = nextInvoiceNo();
          db.prepare('UPDATE orders SET invoice_no = ? WHERE id = ?').run(inv, order.id);
        }
        fulfillOrder(order.id, items, order.total, order.exchange_rate);
      }
      if (status === 'cancelled' && order.status === 'completed') {
        // Simplified reversal: return stock (accounting reversals omitted for brevity)
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        items.forEach((it) =>
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.quantity, it.product_id)
        );
      }
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    })();
    res.json(getOrderFull(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', authRequired, adminOnly, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'completed')
    return res.status(400).json({ error: 'Cannot delete a completed order' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
