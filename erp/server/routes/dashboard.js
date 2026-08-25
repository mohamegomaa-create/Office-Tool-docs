const express = require('express');
const db = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

router.get('/stats', authRequired, (req, res) => {
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const customerCount = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
  const supplierCount = db.prepare('SELECT COUNT(*) AS c FROM suppliers').get().c;
  const lowStockCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE stock <= reorder_level').get().c;
  const pendingOrders = db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE status IN ('draft','confirmed')")
    .get().c;
  const pendingPOs = db
    .prepare("SELECT COUNT(*) AS c FROM purchase_orders WHERE status IN ('draft','submitted')")
    .get().c;

  const salesResult = db
    .prepare("SELECT COALESCE(SUM(total * exchange_rate),0) AS total FROM orders WHERE status = 'completed'")
    .get();
  const monthSales = db
    .prepare(
      "SELECT COALESCE(SUM(total * exchange_rate),0) AS total FROM orders WHERE status = 'completed' AND created_at >= datetime('now','start of month')"
    )
    .get();
  const purchasesResult = db
    .prepare("SELECT COALESCE(SUM(total * exchange_rate),0) AS total FROM purchase_orders WHERE status = 'received'")
    .get();

  const inventoryValue = db
    .prepare('SELECT COALESCE(SUM(stock * cost_price),0) AS value FROM products')
    .get();

  const cashBank = db
    .prepare("SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE code IN ('1000','1010')")
    .get();
  const receivables = db
    .prepare("SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE code = '1200'")
    .get();
  const payables = db
    .prepare("SELECT COALESCE(SUM(balance),0) AS total FROM accounts WHERE code = '2000'")
    .get();

  const salesTrend = db
    .prepare(
      `SELECT date(created_at) AS date, COALESCE(SUM(total * exchange_rate),0) AS total
       FROM orders
       WHERE status = 'completed' AND created_at >= date('now','-6 days')
       GROUP BY date(created_at) ORDER BY date`
    )
    .all();

  const topProducts = db
    .prepare(
      `SELECT p.name, p.sku, SUM(oi.quantity) AS qty, SUM(oi.total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status = 'completed'
       GROUP BY p.id ORDER BY revenue DESC LIMIT 5`
    )
    .all();

  const recentOrders = db
    .prepare(
      `SELECT o.id, o.order_no, o.invoice_no, o.status, o.total, o.currency, o.created_at, c.name AS customer_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       ORDER BY o.id DESC LIMIT 5`
    )
    .all();

  const recentPOs = db
    .prepare(
      `SELECT po.id, po.po_no, po.status, po.total, po.currency, po.created_at, s.name AS supplier_name
       FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
       ORDER BY po.id DESC LIMIT 5`
    )
    .all();

  const lowStock = db
    .prepare(
      `SELECT id, sku, name, stock, reorder_level FROM products WHERE stock <= reorder_level ORDER BY stock LIMIT 8`
    )
    .all();

  res.json({
    counts: {
      products: productCount,
      customers: customerCount,
      suppliers: supplierCount,
      lowStock: lowStockCount,
      pendingOrders,
      pendingPOs,
    },
    finance: {
      totalSales: salesResult.total,
      monthSales: monthSales.total,
      totalPurchases: purchasesResult.total,
      inventoryValue: inventoryValue.value,
      cashBank: cashBank.total,
      receivables: receivables.total,
      payables: payables.total,
    },
    salesTrend,
    topProducts,
    recentOrders,
    recentPOs,
    lowStock,
  });
});

module.exports = router;
