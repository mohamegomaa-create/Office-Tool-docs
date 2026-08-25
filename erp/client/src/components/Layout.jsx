import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../utils.js';

const navItems = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { section: 'Sales' },
  { to: '/orders', label: 'Sales Orders', icon: '🧾' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { section: 'Procurement' },
  { to: '/purchases', label: 'Purchase Orders', icon: '🚚' },
  { to: '/suppliers', label: 'Suppliers', icon: '🏭' },
  { section: 'Inventory & Finance' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/accounting', label: 'Accounting', icon: '💰' },
  { section: 'Administration' },
  { to: '/users', label: 'Users', icon: '🔐', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

const titles = {
  '/': 'Dashboard',
  '/products': 'Products & Inventory',
  '/customers': 'Customers',
  '/orders': 'Sales Orders',
  '/purchases': 'Purchase Orders',
  '/suppliers': 'Suppliers',
  '/accounting': 'Accounting',
  '/users': 'User Management',
  '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;
  let title = titles[path];
  if (path.startsWith('/orders/new')) title = 'New Sales Order';
  else if (path.match(/^\/orders\/\d+$/)) title = 'Sales Order Details';
  else if (path.startsWith('/purchases/new')) title = 'New Purchase Order';
  else if (path.match(/^\/purchases\/\d+$/)) title = 'Purchase Order Details';
  if (!title) title = 'Nexus ERP';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">N</div>
          <div>
            <div className="title">Nexus ERP</div>
            <div className="subtitle">Business Management</div>
          </div>
        </div>
        <nav className="nav">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item, i) =>
              item.section ? (
                <div className="nav-section" key={`s-${i}`}>{item.section}</div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            )}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials(user?.name)}</div>
          <div className="info">
            <div className="name">{user?.name}</div>
            <div className="role">{user?.role}</div>
          </div>
          <button
            className="logout"
            title="Sign out"
            onClick={() => { logout(); navigate('/login'); }}
          >
            ↪
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="actions">
            <button className="btn btn-secondary" onClick={() => navigate('/purchases/new')}>
              + Purchase
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
              + New Order
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
