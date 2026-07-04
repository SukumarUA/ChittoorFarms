/**
 * /admin/customers
 * Auto-built customer directory from the orders table.
 * No separate customers table needed — derived from order history.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Download, MessageSquare, Search, Star, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface RawOrder {
  customer_name: string;
  phone: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
  status: string;
  created_at: string;
  address: string;
}

interface CustomerRecord {
  key: string;            // normalized phone
  name: string;
  phone: string;
  address: string;
  orderCount: number;
  totalSpend: number;
  arpu: number;           // average revenue per order
  lastOrderDate: string;
  firstOrderDate: string;
  favoriteProduct: string;
  isRepeat: boolean;
}

type SortField = 'name' | 'orderCount' | 'totalSpend' | 'arpu' | 'lastOrderDate';
type SortDir = 'asc' | 'desc';

const escapeCsv = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

export const Customers: React.FC = () => {
  const { showToast } = useToast();
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalSpend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all non-failed orders (fulfilled + pending) for customer aggregation
      const { data, error } = await supabase
        .from('orders')
        .select('customer_name, phone, total, items, status, created_at, address')
        .neq('status', 'failed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRawOrders((data as RawOrder[]) ?? []);
    } catch (err) {
      console.error('Error fetching customer data:', err);
      showToast('Could not load customer data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchOrders();
    const sub = supabase
      .channel('customers-orders-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { void sub.unsubscribe(); };
  }, [fetchOrders]);

  // Aggregate raw orders into customer records
  const customers = useMemo((): CustomerRecord[] => {
    const map = new Map<string, {
      name: string; phone: string; address: string;
      orders: number; spend: number;
      first: string; last: string;
      products: Map<string, number>;
    }>();

    for (const order of rawOrders) {
      const key = order.phone.replace(/\D/g, '').slice(-10); // last 10 digits = canonical phone
      if (!map.has(key)) {
        map.set(key, {
          name: order.customer_name,
          phone: order.phone,
          address: order.address,
          orders: 0, spend: 0,
          first: order.created_at,
          last: order.created_at,
          products: new Map(),
        });
      }
      const c = map.get(key)!;
      c.orders += 1;
      c.spend += Number(order.total);
      if (order.created_at > c.last) { c.last = order.created_at; c.name = order.customer_name; }
      if (order.created_at < c.first) c.first = order.created_at;
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          c.products.set(item.name, (c.products.get(item.name) ?? 0) + item.quantity);
        }
      }
    }

    return [...map.entries()].map(([key, c]) => {
      const sortedProducts = [...c.products.entries()].sort((a, b) => b[1] - a[1]);
      return {
        key,
        name: c.name,
        phone: c.phone,
        address: c.address,
        orderCount: c.orders,
        totalSpend: c.spend,
        arpu: c.orders > 0 ? c.spend / c.orders : 0,
        lastOrderDate: c.last,
        firstOrderDate: c.first,
        favoriteProduct: sortedProducts[0]?.[0] ?? '—',
        isRepeat: c.orders > 1,
      };
    });
  }, [rawOrders]);

  // Search + sort
  const displayCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? customers.filter((c) =>
          c.name.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          c.address.toLowerCase().includes(term))
      : customers;

    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') diff = a.name.localeCompare(b.name);
      else if (sortField === 'orderCount') diff = a.orderCount - b.orderCount;
      else if (sortField === 'totalSpend') diff = a.totalSpend - b.totalSpend;
      else if (sortField === 'arpu') diff = a.arpu - b.arpu;
      else if (sortField === 'lastOrderDate') diff = a.lastOrderDate.localeCompare(b.lastOrderDate);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [customers, searchTerm, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={13} style={{ opacity: 0.4, marginLeft: '0.3rem' }} />;
    return sortDir === 'asc'
      ? <ArrowUp size={13} style={{ marginLeft: '0.3rem', color: 'var(--primary)' }} />
      : <ArrowDown size={13} style={{ marginLeft: '0.3rem', color: 'var(--primary)' }} />;
  };

  const exportCsv = () => {
    const rows = [
      ['Customer Name', 'Phone', 'Orders', 'Total Spend (₹)', 'Avg Order Value (₹)', 'Last Order', 'Days Since Last Order', 'First Order', 'Favorite Product', 'Repeat Buyer'],
      ...displayCustomers.map((c) => [
        c.name, c.phone, c.orderCount,
        c.totalSpend.toFixed(2),
        c.arpu.toFixed(2),
        fmtDate(c.lastOrderDate),
        daysSince(c.lastOrderDate),
        fmtDate(c.firstOrderDate),
        c.favoriteProduct,
        c.isRepeat ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `chittoor-farms-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stat cards
  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter((c) => c.isRepeat).length;
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
  const topSpender = displayCustomers[0];

  return (
    <div>
      {/* Summary cards */}
      <section className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-header"><span className="stat-label">Total Customers</span><Users size={20} className="stat-icon" /></div>
          <div className="stat-value">{totalCustomers.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Unique phone numbers</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-label">Repeat Buyers</span><Star size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} /></div>
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>{repeatCustomers.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{repeatRate}% repeat rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-label">Avg Orders / Customer</span><Users size={20} className="stat-icon" style={{ color: 'var(--accent)' }} /></div>
          <div className="stat-value">
            {totalCustomers > 0 ? (rawOrders.length / totalCustomers).toFixed(1) : '0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{rawOrders.length} total orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-label">Top Spender</span><Star size={20} className="stat-icon" style={{ color: 'var(--success)' }} /></div>
          {topSpender ? (
            <>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>{topSpender.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                ₹{topSpender.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })} · {topSpender.orderCount} orders
              </div>
            </>
          ) : <div className="stat-value">—</div>}
        </div>
      </section>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0 0.75rem' }}>
        <div className="admin-search-field" style={{ flex: 1 }}>
          <Search size={17} />
          <input
            type="search"
            placeholder="Search by name, phone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={exportCsv} disabled={!displayCustomers.length}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="admin-empty-state">Loading customer data...</div>
      ) : displayCustomers.length === 0 ? (
        <div className="admin-empty-state">
          <Users size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p>No customers found. Orders will appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>Customer <SortIcon field="name" /></span>
                  </th>
                  <th onClick={() => handleSort('orderCount')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Orders <SortIcon field="orderCount" /></span>
                  </th>
                  <th onClick={() => handleSort('totalSpend')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Total Spend <SortIcon field="totalSpend" /></span>
                  </th>
                  <th onClick={() => handleSort('arpu')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Avg Order <SortIcon field="arpu" /></span>
                  </th>
                  <th onClick={() => handleSort('lastOrderDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>Last Order <SortIcon field="lastOrderDate" /></span>
                  </th>
                  <th>Favorite Product</th>
                  <th>Status</th>
                  <th>Quick Contact</th>
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((c) => {
                  const since = daysSince(c.lastOrderDate);
                  const isLapsing = since > 30;
                  const isChurned = since > 90;
                  return (
                    <tr key={c.key}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <a href={`tel:${c.phone}`} style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{c.phone}</a>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.address}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.orderCount}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--secondary)' }}>
                        ₹{c.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        ₹{c.arpu.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{fmtDate(c.lastOrderDate)}</div>
                        <div style={{ fontSize: '0.75rem', color: isChurned ? '#dc2626' : isLapsing ? '#d97706' : 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {since === 0 ? 'Today' : since === 1 ? 'Yesterday' : `${since}d ago`}
                          {isChurned && ' ⚠ Churned'}
                          {!isChurned && isLapsing && ' · At risk'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.favoriteProduct}
                      </td>
                      <td>
                        {c.isRepeat ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>
                            <Star size={11} /> Repeat
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                            One-time
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <a
                            href={`tel:${c.phone}`}
                            className="btn-icon"
                            title="Call customer"
                            style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                          >📞</a>
                          <a
                            href={`https://wa.me/91${c.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${c.name}! 🌿\n\nThis is Chittoor Farms. We'd love to have you order again!\n\nVisit us at chittoorfarms.in\n\nThank you for your support! 🍃`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-icon"
                            title="WhatsApp customer"
                            style={{ color: '#16a34a', display: 'inline-flex' }}
                            aria-label={`WhatsApp ${c.name}`}
                          >
                            <MessageSquare size={15} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Showing {displayCustomers.length.toLocaleString('en-IN')} customer{displayCustomers.length !== 1 ? 's' : ''}
            {searchTerm ? ` matching "${searchTerm}"` : ''} · Derived from order history
          </div>
        </>
      )}
    </div>
  );
};
