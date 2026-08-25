const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authRequired } = require('../auth');
const { CURRENCIES } = require('./settings');

const router = express.Router();

function currencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
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
  // Sequential per calendar year, e.g. INV-2026-00007
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

// Ensure an order has an invoice number (generated when invoice is first requested
// or when the order is completed).
function ensureInvoiceNo(orderId) {
  const order = db.prepare('SELECT invoice_no FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  if (!order.invoice_no) {
    const inv = nextInvoiceNo();
    db.prepare('UPDATE orders SET invoice_no = ? WHERE id = ?').run(inv, orderId);
    return inv;
  }
  return order.invoice_no;
}

// ---- PDF Invoice ----------------------------------------------------------
router.get('/invoice/:id.pdf', authRequired, (req, res) => {
  const order = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email,
              c.phone AS customer_phone, c.address AS customer_address, c.tax_id AS customer_tax_id,
              c.company AS customer_company, u.name AS user_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`
    )
    .get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Assign an invoice number if missing (any status can be previewed, but only
  // completed orders reflect posted revenue).
  if (!order.invoice_no) order.invoice_no = ensureInvoiceNo(order.id);

  const items = db
    .prepare(
      `SELECT oi.*, p.sku AS product_sku FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
    )
    .all(req.params.id);
  const settings = getSettings();
  const cur = currencyMeta(order.currency);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${order.invoice_no}.pdf"`
  );
  doc.pipe(res);

  // ---- Header band
  doc.roundedRect(0, 0, doc.page.width, 90, 0).fill('#4338ca');
  doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text(settings.company_name || 'Nexus ERP', 50, 28);
  doc.fontSize(10).font('Helvetica').fillColor('#e0e7ff');
  doc.text(settings.company_address || '', 50, 58);
  doc.text(
    [settings.company_email, settings.company_phone].filter(Boolean).join('   |   '),
    50, 72
  );

  doc.fillColor('#0f172a');
  doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', 400, 30, { align: 'right' });
  doc.fontSize(11).font('Helvetica').fillColor('#475569')
    .text(order.invoice_no, 400, 64, { align: 'right' })
    .text(new Date(order.created_at).toLocaleDateString('en-GB'), 400, 80, { align: 'right' });

  // ---- Bill to
  let y = 120;
  doc.fontSize(10).fillColor('#94a3b8').font('Helvetica-Bold').text('BILL TO', 50, y);
  doc.fillColor('#0f172a').font('Helvetica').fontSize(12);
  y += 16;
  doc.font('Helvetica-Bold').text(order.customer_company || order.customer_name, 50, y);
  y += 16;
  doc.font('Helvetica');
  if (order.customer_company && order.customer_name) { doc.text(order.customer_name, 50, y); y += 14; }
  if (order.customer_address) { doc.text(order.customer_address, 50, y); y += 14; }
  if (order.customer_email) { doc.text(order.customer_email, 50, y); y += 14; }
  if (order.customer_phone) { doc.text(order.customer_phone, 50, y); y += 14; }
  if (order.customer_tax_id) { doc.text(`Tax ID: ${order.customer_tax_id}`, 50, y); y += 14; }

  // ---- Meta (right column)
  doc.fontSize(10).fillColor('#94a3b8').font('Helvetica-Bold');
  doc.text('ORDER #', 350, 120);
  doc.text('STATUS', 350, 138);
  doc.text('DUE DATE', 350, 156);
  if (settings.company_tax_id) doc.text('TAX ID', 350, 174);

  doc.fillColor('#0f172a').font('Helvetica');
  doc.text(order.order_no, 450, 120);
  doc.text(order.status.toUpperCase(), 450, 138);
  doc.text(order.due_date ? new Date(order.due_date).toLocaleDateString('en-GB') : 'On receipt', 450, 156);
  if (settings.company_tax_id) doc.text(settings.company_tax_id, 450, 174);

  // ---- Line items table
  y = Math.max(y + 20, 220);
  doc.fontSize(9).fillColor('#ffffff');
  doc.roundedRect(50, y, doc.page.width - 100, 22, 3).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold')
    .text('DESCRIPTION', 60, y + 7)
    .text('QTY', 360, y + 7, { width: 40, align: 'right' })
    .text('UNIT PRICE', 410, y + 7, { width: 70, align: 'right' })
    .text('AMOUNT', 490, y + 7, { width: 50, align: 'right' });

  y += 30;
  doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
  items.forEach((it, i) => {
    if (i % 2 === 0) { doc.roundedRect(50, y - 4, doc.page.width - 100, 22, 2).fill('#f8fafc'); }
    doc.fillColor('#0f172a');
    doc.font('Helvetica-Bold').text(it.description, 60, y, { width: 290 });
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(it.product_sku || '', 60, y + 12, { width: 290 });
    doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
    doc.text(String(it.quantity), 360, y, { width: 40, align: 'right' });
    doc.text(`${cur.symbol}${it.unit_price.toFixed(2)}`, 410, y, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').text(`${cur.symbol}${it.total.toFixed(2)}`, 490, y, { width: 50, align: 'right' });
    y += 24;
  });

  // ---- Totals
  y += 10;
  const totalsX = 360;
  const drawTotal = (label, value, opts = {}) => {
    if (opts.fill) { doc.roundedRect(50, y - 4, doc.page.width - 100, 24, 3).fill(opts.fill); }
    doc.fillColor(opts.textColor || '#475569').font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 10);
    doc.text(label, totalsX, y + 2, { width: 120, align: 'left' });
    doc.fillColor(opts.textColor || '#0f172a')
      .text(value, 480, y + 2, { width: 70, align: 'right' });
    y += 22;
  };

  drawTotal('Subtotal', `${cur.symbol}${order.subtotal.toFixed(2)}`);
  drawTotal(`${order.tax_name || 'VAT'} (${order.tax_rate}%)`, `${cur.symbol}${order.tax_amount.toFixed(2)}`);
  drawTotal('Total', `${cur.symbol}${order.total.toFixed(2)}`, { bold: true, fill: '#4338ca', textColor: '#ffffff', size: 12 });
  y += 4;
  if (order.currency !== (settings.base_currency || 'USD')) {
    doc.fontSize(8).fillColor('#94a3b8')
      .text(
        `Paid/recorded in ${order.currency}. Exchange rate applied for accounting: 1 ${order.currency} = ${order.exchange_rate} ${settings.base_currency || 'USD'}.`,
        350, y, { width: 200, align: 'right' }
      );
    y += 20;
  }

  // ---- Notes / footer
  if (order.notes) {
    y = Math.max(y, doc.page.height - 140);
    doc.fontSize(9).fillColor('#94a3b8').font('Helvetica-Bold').text('NOTES', 50, y);
    doc.fillColor('#475569').font('Helvetica').text(order.notes, 50, y + 14, { width: 300 });
  }

  doc.fontSize(9).fillColor('#94a3b8')
    .text(
      settings.invoice_footer || 'Thank you for your business!',
      50, doc.page.height - 60,
      { width: doc.page.width - 100, align: 'center' }
    );

  doc.end();
});

// ---- CSV export of orders -------------------------------------------------
function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

router.get('/orders.csv', authRequired, (req, res) => {
  const { status } = req.query;
  let sql = `SELECT o.order_no, o.invoice_no, o.created_at, o.status, o.currency,
                    o.subtotal, o.tax_name, o.tax_rate, o.tax_amount, o.total,
                    c.name AS customer, u.name AS salesperson
             FROM orders o
             LEFT JOIN customers c ON c.id = o.customer_id
             LEFT JOIN users u ON u.id = o.user_id`;
  const params = [];
  if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.id DESC';
  const rows = db.prepare(sql).all(...params);

  const headers = ['Order No', 'Invoice No', 'Date', 'Status', 'Currency',
    'Customer', 'Salesperson', 'Subtotal', 'Tax Name', 'Tax Rate %', 'Tax Amount', 'Total'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.order_no, r.invoice_no || '', r.created_at, r.status, r.currency,
      r.customer || '', r.salesperson || '',
      r.subtotal, r.tax_name, r.tax_rate, r.tax_amount, r.total,
    ].map(csvCell).join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sales-orders.csv"');
  res.send(lines.join('\n'));
});

// ---- CSV export of products ----------------------------------------------
router.get('/products.csv', authRequired, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.sku, p.name, c.name AS category, s.name AS supplier,
              p.unit, p.cost_price, p.sale_price, p.stock, p.reorder_level
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ORDER BY p.name`
    )
    .all();
  const headers = ['SKU', 'Name', 'Category', 'Supplier', 'Unit', 'Cost Price', 'Sale Price', 'Stock', 'Reorder Level'];
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push([
    r.sku, r.name, r.category || '', r.supplier || '', r.unit,
    r.cost_price, r.sale_price, r.stock, r.reorder_level,
  ].map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
  res.send(lines.join('\n'));
});

module.exports = router;
module.exports.ensureInvoiceNo = ensureInvoiceNo;
