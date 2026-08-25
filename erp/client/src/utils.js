export const CURRENCY_MAP = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound' },
  GBP: { symbol: '£', name: 'British Pound' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
};

export function fmtMoney(n, currency = 'USD') {
  const c = CURRENCY_MAP[currency] || CURRENCY_MAP.USD;
  const value = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  return `${c.symbol}${value}`;
}

export const fmtNum = (n) =>
  new Intl.NumberFormat('en-US').format(Number(n) || 0);

export const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtDateTime = (s) => {
  if (!s) return '';
  return new Date(s).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export const statusBadge = (status) => {
  const map = {
    draft: ['badge-neutral', 'Draft'],
    confirmed: ['badge-info', 'Confirmed'],
    completed: ['badge-success', 'Completed'],
    cancelled: ['badge-danger', 'Cancelled'],
    submitted: ['badge-warning', 'Submitted'],
    received: ['badge-success', 'Received'],
    partial: ['badge-warning', 'Partial'],
  };
  return map[status] || ['badge-neutral', status];
};

export const accountTypeBadge = (type) => {
  const map = {
    asset: ['badge-info', 'Asset'],
    liability: ['badge-warning', 'Liability'],
    equity: ['badge-purple', 'Equity'],
    revenue: ['badge-success', 'Revenue'],
    expense: ['badge-danger', 'Expense'],
  };
  return map[type] || ['badge-neutral', type];
};
