const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'erp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Idempotent column adder (for upgrading existing DBs) -------------------
function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}
function addColumn(table, name, def) {
  if (!columns(table).includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  }
}

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      supplier_id INTEGER,
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      company TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      tax_id TEXT,
      payment_terms TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      invoice_no TEXT,
      customer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'USD',
      exchange_rate REAL NOT NULL DEFAULT 1,
      tax_name TEXT NOT NULL DEFAULT 'VAT',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      shipping_address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'USD',
      exchange_rate REAL NOT NULL DEFAULT 1,
      tax_name TEXT NOT NULL DEFAULT 'VAT',
      subtotal REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      received_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      amount REAL NOT NULL,
      debit_account_id INTEGER,
      credit_account_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (debit_account_id) REFERENCES accounts(id),
      FOREIGN KEY (credit_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // --- Migrations for older databases --------------------------------------
  addColumn('products', 'supplier_id', 'INTEGER');
  addColumn('customers', 'tax_id', 'TEXT');
  addColumn('orders', 'currency', `TEXT NOT NULL DEFAULT 'USD'`);
  addColumn('orders', 'exchange_rate', 'REAL NOT NULL DEFAULT 1');
  addColumn('orders', 'tax_name', `TEXT NOT NULL DEFAULT 'VAT'`);
  addColumn('orders', 'due_date', 'TEXT');
  addColumn('orders', 'shipping_address', 'TEXT');
  addColumn('orders', 'invoice_no', 'TEXT');

  // --- Seed users ----------------------------------------------------------
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`
    ).run('Administrator', 'admin@erp.com', hash, 'admin');
    const staffHash = bcrypt.hashSync('staff123', 10);
    db.prepare(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`
    ).run('Sales Staff', 'staff@erp.com', staffHash, 'staff');
  }

  // --- Seed categories -----------------------------------------------------
  const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (catCount === 0) {
    ['Electronics', 'Office Supplies', 'Furniture', 'Software'].forEach((c) =>
      db.prepare('INSERT INTO categories (name) VALUES (?)').run(c)
    );
  }

  // --- Seed suppliers ------------------------------------------------------
  const supCount = db.prepare('SELECT COUNT(*) AS c FROM suppliers').get().c;
  let supplierIds = [];
  if (supCount === 0) {
    const insertSup = db.prepare(
      `INSERT INTO suppliers (name, contact_name, email, phone, address, tax_id, payment_terms)
       VALUES (@name, @contact_name, @email, @phone, @address, @tax_id, @payment_terms)`
    );
    const suppliers = [
      { name: 'TechSource Distributors', contact_name: 'Ali Mansour', email: 'sales@techsource.com', phone: '+20 2 2222 3000', address: 'Cairo, Egypt', tax_id: 'EG-4451-22', payment_terms: 'Net 30' },
      { name: 'OfficePro Wholesale', contact_name: 'Hala Fawzy', email: 'orders@officepro.com', phone: '+20 2 3333 4100', address: 'Giza, Egypt', tax_id: 'EG-7720-11', payment_terms: 'Net 15' },
      { name: 'FurnitureHub Ltd.', contact_name: 'Tarek Nabil', email: 'b2b@furniturehub.com', phone: '+20 3 5555 6200', address: 'Alexandria, Egypt', tax_id: 'EG-9910-04', payment_terms: 'Net 45' },
      { name: 'SoftDistrib Inc.', contact_name: 'Mona Adel', email: 'partner@softdistrib.com', phone: '+1 415 555 0144', address: 'Wilmington, DE, USA', tax_id: 'US-88-2049113', payment_terms: 'Prepaid' },
    ];
    const trx = db.transaction((rows) => rows.forEach((r) => insertSup.run(r)));
    trx(suppliers);
  }
  supplierIds = db.prepare('SELECT id FROM suppliers ORDER BY id').all().map((r) => r.id);

  // --- Seed products -------------------------------------------------------
  const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (prodCount === 0) {
    const insert = db.prepare(
      `INSERT INTO products (sku, name, description, category_id, supplier_id, unit, cost_price, sale_price, stock, reorder_level)
       VALUES (@sku, @name, @description, @category_id, @supplier_id, @unit, @cost_price, @sale_price, @stock, @reorder_level)`
    );
    const s = supplierIds;
    const sample = [
      ['EL-001', 'Wireless Mouse', 'Ergonomic 2.4GHz wireless mouse', 1, s[0], 'pcs', 8.5, 19.99, 120, 20],
      ['EL-002', 'Mechanical Keyboard', 'RGB backlit mechanical keyboard', 1, s[0], 'pcs', 32, 79.99, 45, 10],
      ['EL-003', '27" Monitor', '4K UHD IPS monitor', 1, s[0], 'pcs', 180, 329.0, 18, 5],
      ['EL-004', 'USB-C Hub', '7-in-1 USB-C multiport adapter', 1, s[0], 'pcs', 14, 34.5, 60, 15],
      ['OS-001', 'A4 Paper (Ream)', '500 sheets, 80gsm', 2, s[1], 'ream', 3.2, 6.5, 200, 50],
      ['OS-002', 'Ballpoint Pens (Box)', '12-pack blue pens', 2, s[1], 'box', 2.1, 5.0, 90, 20],
      ['OS-003', 'Sticky Notes', 'Assorted colors, 3x3', 2, s[1], 'pack', 1.4, 3.5, 150, 30],
      ['FN-001', 'Office Chair', 'Adjustable ergonomic chair', 3, s[2], 'pcs', 95, 249.0, 12, 3],
      ['FN-002', 'Standing Desk', 'Electric height-adjustable desk', 3, s[2], 'pcs', 220, 499.0, 6, 2],
      ['SW-001', 'Antivirus 1-Year', 'Single device license', 4, s[3], 'license', 12, 39.99, 80, 10],
    ];
    sample.forEach((r) =>
      insert.run({
        sku: r[0], name: r[1], description: r[2], category_id: r[3],
        supplier_id: r[4], unit: r[5], cost_price: r[6], sale_price: r[7],
        stock: r[8], reorder_level: r[9],
      })
    );
  }

  // --- Seed customers ------------------------------------------------------
  const custCount = db.prepare('SELECT COUNT(*) AS c FROM customers').get().c;
  if (custCount === 0) {
    const insert = db.prepare(
      `INSERT INTO customers (name, email, phone, address, tax_id, company)
       VALUES (@name, @email, @phone, @address, @tax_id, @company)`
    );
    [
      { name: 'Sara Ahmed', email: 'sara@globex.com', phone: '+20 100 111 2233', address: 'Cairo, Egypt', tax_id: 'EG-100-22', company: 'Globex Trading' },
      { name: 'Mohamed Hassan', email: 'm.hassan@initech.io', phone: '+20 122 444 5566', address: 'Alexandria, Egypt', tax_id: 'EG-200-33', company: 'Initech LLC' },
      { name: 'Lina Khaled', email: 'lina@umbrella.co', phone: '+20 111 777 8899', address: 'Giza, Egypt', tax_id: 'EG-300-44', company: 'Umbrella Group' },
      { name: 'Omar Said', email: 'omar@hooli.com', phone: '+20 109 333 2211', address: 'Mansoura, Egypt', tax_id: 'EG-400-55', company: 'Hooli ME' },
    ].forEach((c) => insert.run(c));
  }

  // --- Seed chart of accounts ---------------------------------------------
  const accCount = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
  if (accCount === 0) {
    const insert = db.prepare(
      `INSERT INTO accounts (code, name, type, balance) VALUES (?, ?, ?, ?)`
    );
    [
      ['1000', 'Cash', 'asset', 5000],
      ['1010', 'Bank Account', 'asset', 42000],
      ['1200', 'Accounts Receivable', 'asset', 8500],
      ['1300', 'Inventory', 'asset', 31000],
      ['2000', 'Accounts Payable', 'liability', 6200],
      ['3000', 'Owner Equity', 'equity', 80300],
      ['4000', 'Sales Revenue', 'revenue', 0],
      ['5000', 'Cost of Goods Sold', 'expense', 0],
      ['5100', 'Purchase Expense', 'expense', 0],
      ['6000', 'Rent Expense', 'expense', 0],
      ['6100', 'Salaries Expense', 'expense', 0],
      ['6200', 'Utilities Expense', 'expense', 0],
    ].forEach((a) => insert.run(...a));
  }

  // --- Seed settings -------------------------------------------------------
  const settingCount = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (settingCount === 0) {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const defaults = {
      company_name: 'Nexus ERP Demo Co.',
      company_address: '123 Innovation Drive, Cairo, Egypt',
      company_email: 'billing@nexus-erp.example',
      company_phone: '+20 2 2222 8800',
      company_tax_id: 'EG-000-99',
      base_currency: 'USD',
      default_currency: 'USD',
      default_tax_rate: '14',
      default_tax_name: 'VAT',
      invoice_prefix: 'INV',
      invoice_footer: 'Thank you for your business! Payment due within 30 days.',
    };
    Object.entries(defaults).forEach(([k, v]) => upsert.run(k, v));
  }
}

init();

module.exports = db;
