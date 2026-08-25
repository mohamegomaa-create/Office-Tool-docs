# Nexus ERP

A self-hosted, full-stack Enterprise Resource Planning application built with **Node.js**, **Express**, **SQLite**, and **React (Vite)**. It covers the core operational and financial workflows of a small-to-mid-sized business in a single, easy-to-deploy package.

## Features

### Sales & CRM
- **🧾 Sales Orders** — Multi-line orders with VAT/tax, due dates, shipping addresses, and a draft → confirmed → completed / cancelled workflow.
- **📄 PDF Invoices** — Completed orders automatically get sequential invoice numbers (e.g. `INV-2026-00001`). Download a branded, itemized PDF invoice for any order — generated server-side with PDFKit.
- **📥 CSV Export** — Export sales orders and the product catalog to CSV for spreadsheets/accounting.
- **👥 Customers** — CRM-lite records with contact info, tax IDs, and order history.

### Procurement & Inventory
- **🚚 Purchase Orders** — Order stock from suppliers with the same line-item editor; mark as submitted or **received** to automatically increase inventory and post an accounts-payable journal entry.
- **🏭 Suppliers** — Supplier directory with contacts, tax IDs, and payment terms (Prepaid / Net 15–60).
- **📦 Products & Inventory** — SKUs, categories, supplier assignment, cost/sale prices, stock on hand, reorder levels, and low-stock filtering with one-click restock links.

### Finance
- **💰 Double-Entry Accounting** — A seeded chart of accounts. Sales and purchase transactions post automatic, balanced journal entries (A/R ↔ Revenue, COGS ↔ Inventory, Inventory ↔ A/P).
- **📒 General Ledger** — Admins can post manual journal entries between any two accounts.
- **💱 Multi-Currency** — Transact in USD, EUR, EGP, GBP, SAR, or AED. Each order/PO carries its own currency and exchange rate; foreign amounts are converted to your base currency for ledger postings.

### Platform
- **🔐 Authentication & RBAC** — JWT login with `admin` and `staff` roles.
- **⚙️ Company Settings** — Configure company identity, base/default currency, default VAT rate & label, invoice prefix, and footer text (admin only).
- **📊 Dashboard** — KPI tiles (sales, purchases, inventory value, cash position), a 7-day sales chart, top products, recent sales & purchase orders, and low-stock alerts.

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19, React Router 7, Vite, plain CSS design system |
| Backend    | Node.js, Express 5 |
| Database   | SQLite via `better-sqlite3` (WAL mode, file in `./data`) |
| PDF        | PDFKit |
| Auth       | JWT + bcrypt password hashing |

## Quick Start

```bash
# 1. Install dependencies
cd erp/server && npm install
cd ../client && npm install

# 2. Build the React frontend
cd erp/client && npm run build

# 3. Start the server (serves both API and built UI on port 4000)
cd erp/server && npm start
```

Then open **http://localhost:4000** in your browser.

For frontend development with hot reload, run the Vite dev server separately (it proxies `/api` to the backend):

```bash
# terminal 1
cd erp/server && npm start          # API on :4000
# terminal 2
cd erp/client && npm run dev        # UI  on :5173
```

## Demo Credentials

The database is seeded automatically on first run.

| Role  | Email             | Password   |
|-------|-------------------|------------|
| Admin | `admin@erp.com`   | `admin123` |
| Staff | `staff@erp.com`   | `staff123` |

Seeded data includes 10 products, 4 customers, 4 suppliers (with products assigned), and a standard chart of accounts.

## Project Structure

```
erp/
├── server/
│   ├── index.js            # Express app, static serving, SPA fallback
│   ├── db.js               # SQLite schema, idempotent migrations, seed data
│   ├── auth.js             # JWT helpers + role middleware
│   └── routes/
│       ├── auth.js         # Login, /me, user CRUD (admin)
│       ├── settings.js     # Company settings + supported currencies
│       ├── products.js     # Products + categories CRUD
│       ├── customers.js    # Customers CRUD
│       ├── suppliers.js    # Suppliers CRUD
│       ├── orders.js       # Sales orders, stock deduction, invoice numbering
│       ├── purchases.js    # Purchase orders, stock receiving, A/P postings
│       ├── accounting.js   # Chart of accounts + manual journal entries
│       ├── dashboard.js    # Aggregated KPIs and charts
│       └── documents.js    # PDF invoice (PDFKit) + CSV exports
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx, App.jsx
│       ├── api.js, utils.js, styles.css
│       ├── context/AuthContext.jsx
│       ├── components/     # Layout, Modal
│       └── pages/          # Dashboard, Products, Customers, Suppliers,
│                           # Orders, OrderDetail, NewOrder, Purchases,
│                           # NewPurchaseOrder, PurchaseOrderDetail,
│                           # Accounting, Users, Settings
└── data/                   # SQLite database file (auto-created, git-ignored)
```

## API Overview

All `/api/*` routes (except `/api/auth/login`) require a `Authorization: Bearer <token>` header.

| Method | Endpoint                       | Access | Description |
|--------|--------------------------------|--------|-------------|
| POST   | `/api/auth/login`              | public | Obtain a JWT |
| GET/PUT| `/api/settings`                | auth / admin writes | Company configuration |
| GET    | `/api/settings/currencies`     | auth   | Supported currencies & rates |
| CRUD   | `/api/products`                | auth / admin writes | Product catalog |
| CRUD   | `/api/customers`               | auth   | Customer records |
| CRUD   | `/api/suppliers`               | auth / admin writes | Supplier records |
| GET/POST | `/api/orders`                | auth   | List / create sales orders |
| GET    | `/api/orders/:id`              | auth   | Order with line items |
| PATCH  | `/api/orders/:id/status`       | auth   | Complete/cancel (triggers stock & GL) |
| GET/POST | `/api/purchases`             | auth   | List / create purchase orders |
| PATCH  | `/api/purchases/:id/status`    | auth   | Receive/cancel (adds stock, posts A/P) |
| GET    | `/api/accounting/accounts`     | auth   | Chart of accounts |
| GET/POST | `/api/accounting/transactions` | auth / admin writes | General ledger |
| GET    | `/api/dashboard/stats`         | auth   | KPIs, charts, recent activity |
| GET    | `/api/documents/invoice/:id.pdf` | auth | Download a PDF invoice |
| GET    | `/api/documents/orders.csv`    | auth   | Export sales orders as CSV |
| GET    | `/api/documents/products.csv`  | auth   | Export products as CSV |

## Configuration

| Environment variable | Default                  | Purpose |
|----------------------|--------------------------|---------|
| `PORT`               | `4000`                   | HTTP port for the combined server |
| `JWT_SECRET`         | `erp-dev-secret-change-me` | Signing secret for JWTs — **change this in production** |

## Deployment (get the site online)

The repo already includes everything needed to deploy. The server serves the
built React UI and the API on one port, so it runs anywhere Node is available.

### Option A — Render (easiest, free tier)

1. Push the code to GitHub.
2. Go to **https://dashboard.render.com/blueprints** → **New Blueprint Instance**.
3. Select your repository. `render.yaml` configures the service automatically
   (builds the client, starts the server, health-checks `/api/health`).
4. Set the `JWT_SECRET` env var (Render can auto-generate it) and click **Apply**.

### Option B — Railway / Fly.io / any Node host

- Build command: `bash render-build.sh`
- Start command: `node server/index.js`
- Set the environment variable `JWT_SECRET` to a long random string.
- The root directory is `erp/`.

### Option C — Docker

```bash
cd erp
docker build -t nexus-erp .
docker run -p 4000:4000 -v nexus-erp-data:/app/data nexus-erp
```

Open http://localhost:4000. Mount a volume to `/app/data` to keep the SQLite
database across container restarts.

### Option D — Your own VPS

```bash
git clone https://github.com/mohamegomaa-create/Office-Tool-docs.git
cd Office-Tool-docs/erp
cd server && npm install --omit=dev && cd ..
cd client && npm install && npm run build && cd ..
JWT_SECRET=$(openssl rand -hex 32) PORT=4000 node server/index.js
```

> ⚠️ **Note:** GitHub Pages cannot host this app because it is a Node server
> (Pages serves only static files). Use one of the options above.
> On the free tier, Render/Railway may sleep and reset its disk — for production,
> attach persistent storage or migrate to Postgres later.

## Notes & Next Steps

- The database file lives at `erp/data/erp.db`. Delete it to re-seed from scratch.
- Exchange rates are static demo values. In production, integrate a live FX provider and add rate audit trails.
- Natural next extensions: tax-inclusive pricing & tax registration reporting, multi-warehouse inventory, payments/reconciliation, email delivery of invoices, and recurring purchase orders.
