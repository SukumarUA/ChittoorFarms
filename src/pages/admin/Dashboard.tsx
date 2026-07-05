import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart2, CalendarDays, Check, Clock,
  IndianRupee, Package, TrendingUp, UserCheck, Wallet, X, ShoppingBag,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Inline SVG bar chart ──────────────────────────────────────────────────────
interface BarDatum { label: string; value: number; sub?: string; }

const MiniBarChart: React.FC<{
  data: BarDatum[];
  color: string;
  formatValue?: (n: number) => string;
  height?: number;
}> = ({ data, color, formatValue = String, height = 110 }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 500; const H = height; const PAD = 4;
  const slotW = (W - PAD * 2) / data.length;
  const barW = Math.max(slotW * 0.6, 6);
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Bar chart">
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <line key={pct} x1={PAD} y1={H - pct * H} x2={W - PAD} y2={H - pct * H} stroke="var(--border)" strokeWidth={0.5} />
      ))}
      {data.map((d, i) => {
        const barH = (d.value / max) * H;
        const x = PAD + i * slotW + (slotW - barW) / 2;
        const y = H - barH;
        return (
          <g key={d.label + i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.82} />
            {d.value / max > 0.18 && (
              <text x={x + barW / 2} y={y + 13} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" style={{ fontFamily: 'inherit' }}>
                {formatValue(d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={9} fill="var(--text-muted)" style={{ fontFamily: 'inherit' }}>
              {d.label}
            </text>
            {d.sub && (
              <text x={x + barW / 2} y={H + 25} textAnchor="middle" fontSize={8} fill="var(--text-muted)" style={{ fontFamily: 'inherit' }}>
                {d.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const ageBadge = (createdAt: string): { label: string; color: string; bg: string } => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const d = Math.floor(h / 24);
  const label = d >= 1 ? `${d}d old` : h > 0 ? `${h}h ${m}m old` : `${m}m old`;
  if (h >= 6) return { label, color: '#dc2626', bg: '#fee2e2' };
  if (h >= 2) return { label, color: '#92400e', bg: '#fef3c7' };
  return { label, color: '#166534', bg: '#dcfce7' };
};

// ─────────────────────────────────────────────────────────────────────────────
interface Stats {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  monthRevenue: number;
  monthFulfilledCount: number;
  allTimeRevenue: number;
  fulfilledCount: number;
  failedCount: number;
  agingOrders: number;
  newVisits: number;
  pendingApps: number;
  lowStockProducts: number;
  codUncollected: number;
}

interface DayRevenue { label: string; dayKey: string; revenue: number; orders: number; }

interface PendingOrder {
  id: string;
  order_number: string | null;
  customer_name: string;
  phone: string;
  total: number;
  items: Array<{ name: string; quantity: number; unit: string }>;
  created_at: string;
  payment_mode: string | null;
  special_instructions: string | null;
  preferred_delivery_date: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0, todayOrders: 0, todayRevenue: 0,
    monthRevenue: 0, monthFulfilledCount: 0, allTimeRevenue: 0,
    fulfilledCount: 0, failedCount: 0, agingOrders: 0,
    newVisits: 0, pendingApps: 0, lowStockProducts: 0, codUncollected: 0,
  });
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [todayItems, setTodayItems] = useState<Array<Array<{ name: string; quantity: number }>>>([]);
  const [weekRevenue, setWeekRevenue] = useState<DayRevenue[]>([]);
  const [hourBuckets, setHourBuckets] = useState<number[]>(new Array(24).fill(0));
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Tick every 60s so age badges refresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
      const todayISO     = midnight.toISOString();
      const monthStart   = new Date(midnight.getFullYear(), midnight.getMonth(), 1).toISOString();
      const sixHoursAgo  = new Date(Date.now() - 6 * 3_600_000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const [
        pendingRes, todayCountRes,
        todayRevRes, monthRevRes, monthFulfilledRes,
        allRevRes, fulfilledRes, failedRes,
        agingRes, visitsRes, appsRes, lowStockRes,
        codRes, pendingOrdersRes, todayOrdersRes,
        weekFulfilledRes, weekAllRes,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).neq('status', 'cancelled'),
        // Today's revenue (fulfilled only)
        supabase.from('orders').select('total').eq('status', 'fulfilled').gte('created_at', todayISO),
        // This month's revenue
        supabase.from('orders').select('total').eq('status', 'fulfilled').gte('created_at', monthStart),
        // This month's fulfilled count (for avg order value)
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled').gte('created_at', monthStart),
        // All-time revenue
        supabase.from('orders').select('total').eq('status', 'fulfilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('created_at', sixHoursAgo),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true).lte('stock', 5),
        // COD fulfilled orders where cash hasn't been collected
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .eq('status', 'fulfilled').eq('payment_mode', 'Cash on delivery').is('cash_collected_by', null),
        // All pending orders (oldest first)
        supabase.from('orders')
          .select('id, order_number, customer_name, phone, total, items, created_at, payment_mode, special_instructions, preferred_delivery_date')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(50),
        // Today's items for top products
        supabase.from('orders').select('items').gte('created_at', todayISO).neq('status', 'cancelled'),
        // 7-day fulfilled revenue
        supabase.from('orders').select('total, created_at').eq('status', 'fulfilled').gte('created_at', sevenDaysAgo),
        // 7-day order hour distribution
        supabase.from('orders').select('created_at').neq('status', 'cancelled').gte('created_at', sevenDaysAgo),
      ]);

      const monthRev = monthRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0;

      setStats({
        pendingOrders:       pendingRes.count          ?? 0,
        todayOrders:         todayCountRes.count        ?? 0,
        todayRevenue:        todayRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
        monthRevenue:        monthRev,
        monthFulfilledCount: monthFulfilledRes.count    ?? 0,
        allTimeRevenue:      allRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
        fulfilledCount:      fulfilledRes.count         ?? 0,
        failedCount:         failedRes.count            ?? 0,
        agingOrders:         agingRes.count             ?? 0,
        newVisits:           visitsRes.count            ?? 0,
        pendingApps:         appsRes.count              ?? 0,
        lowStockProducts:    lowStockRes.count          ?? 0,
        codUncollected:      codRes.count               ?? 0,
      });

      setPendingOrders((pendingOrdersRes.data as PendingOrder[]) ?? []);

      setTodayItems(
        (todayOrdersRes.data ?? []).map((o) => {
          const raw = (o as { items: unknown }).items;
          return Array.isArray(raw) ? (raw as Array<{ name: string; quantity: number }>) : [];
        }),
      );

      const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const revByDay = new Map<string, { revenue: number; orders: number }>();
      const days: DayRevenue[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        revByDay.set(key, { revenue: 0, orders: 0 });
        days.push({ label: DAY_LABELS[d.getDay()], dayKey: key, revenue: 0, orders: 0 });
      }
      for (const row of (weekFulfilledRes.data ?? [])) {
        const key = (row as { created_at: string; total: number }).created_at.slice(0, 10);
        const bucket = revByDay.get(key);
        if (bucket) { bucket.revenue += Number((row as { total: number }).total); bucket.orders += 1; }
      }
      setWeekRevenue(days.map((d) => ({ ...d, ...(revByDay.get(d.dayKey) ?? { revenue: 0, orders: 0 }) })));

      const buckets = new Array(24).fill(0) as number[];
      for (const row of (weekAllRes.data ?? [])) {
        const h = new Date((row as { created_at: string }).created_at).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      }
      setHourBuckets([...buckets]);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
    const sub = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, loadDashboard)
      .subscribe();
    return () => { void sub.unsubscribe(); };
  }, [loadDashboard]);

  // Inline reject from dashboard
  const handleReject = async (id: string) => {
    if (!window.confirm('Mark this order as rejected?')) return;
    setRejectingId(id);
    try {
      const { error } = await supabase.from('orders').update({ status: 'failed' }).eq('id', id);
      if (error) throw error;
      setPendingOrders((cur) => cur.filter((o) => o.id !== id));
      setStats((s) => ({ ...s, pendingOrders: Math.max(0, s.pendingOrders - 1), failedCount: s.failedCount + 1 }));
    } catch { /* toast shown by global handler */ }
    finally { setRejectingId(null); }
  };

  const fulfillmentRate = useMemo(() => {
    const total = stats.fulfilledCount + stats.failedCount;
    return total > 0 ? Math.round((stats.fulfilledCount / total) * 100) : null;
  }, [stats.fulfilledCount, stats.failedCount]);

  const avgOrderValue = useMemo(() => {
    return stats.monthFulfilledCount > 0
      ? Math.round(stats.monthRevenue / stats.monthFulfilledCount)
      : null;
  }, [stats.monthRevenue, stats.monthFulfilledCount]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const items of todayItems) {
      for (const item of items) {
        map.set(item.name, (map.get(item.name) ?? 0) + item.quantity);
      }
    }
    return [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 7);
  }, [todayItems]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const alertItems = [
    stats.agingOrders > 0 && {
      label: `${stats.agingOrders} pending order${stats.agingOrders > 1 ? 's' : ''} older than 6h`,
      icon: <Clock size={14} />, color: '#dc2626', bg: '#fee2e2', link: '/admin/orders',
    },
    stats.lowStockProducts > 0 && {
      label: `${stats.lowStockProducts} product${stats.lowStockProducts > 1 ? 's' : ''} low on stock (≤5)`,
      icon: <ShoppingBag size={14} />, color: '#b45309', bg: '#fef3c7', link: '/admin/products',
    },
    stats.codUncollected > 0 && {
      label: `${stats.codUncollected} COD order${stats.codUncollected > 1 ? 's' : ''} with cash not yet collected`,
      icon: <Wallet size={14} />, color: '#7c3aed', bg: '#ede9fe', link: '/admin/payments',
    },
    stats.newVisits > 0 && {
      label: `${stats.newVisits} new visit booking${stats.newVisits > 1 ? 's' : ''} pending`,
      icon: <CalendarDays size={14} />, color: '#0369a1', bg: '#e0f2fe', link: '/admin/visits',
    },
    stats.pendingApps > 0 && {
      label: `${stats.pendingApps} farmer application${stats.pendingApps > 1 ? 's' : ''} to review`,
      icon: <UserCheck size={14} />, color: '#166534', bg: '#dcfce7', link: '/admin/applications',
    },
  ].filter(Boolean) as Array<{ label: string; icon: React.ReactNode; color: string; bg: string; link: string }>;

  return (
    <div>
      {/* ══ ROW 1: Operations KPIs ══════════════════════════════════════════ */}
      <section className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Pending Orders */}
        <div
          className="stat-card"
          onClick={() => navigate('/admin/orders')}
          style={{ cursor: 'pointer', ...(stats.pendingOrders > 0 ? { borderColor: 'var(--secondary)', borderWidth: 2 } : {}) }}
        >
          <div className="stat-header">
            <span className="stat-label">Pending Orders</span>
            <Package size={20} className="stat-icon" style={{ color: stats.pendingOrders > 0 ? 'var(--secondary)' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: stats.pendingOrders > 0 ? 'var(--secondary)' : undefined }}>
            {loading ? '–' : stats.pendingOrders}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.agingOrders > 0
              ? <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {stats.agingOrders} older than 6h</span>
              : 'Awaiting fulfillment'}
          </div>
        </div>

        {/* Today's Orders */}
        <div className="stat-card" onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Today's Orders</span>
            <Package size={20} className="stat-icon" />
          </div>
          <div className="stat-value">{loading ? '–' : stats.todayOrders}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Since midnight</div>
        </div>

        {/* Today's Revenue */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Today's Revenue</span>
            <IndianRupee size={20} className="stat-icon" style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{loading ? '–' : fmt(stats.todayRevenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Fulfilled orders today</div>
        </div>

        {/* Fulfillment Rate */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Fulfillment Rate</span>
            <TrendingUp size={20} className="stat-icon"
              style={{ color: fulfillmentRate !== null && fulfillmentRate < 90 ? 'var(--danger)' : 'var(--success)' }} />
          </div>
          <div className="stat-value"
            style={{ color: fulfillmentRate !== null && fulfillmentRate < 90 ? 'var(--danger)' : 'var(--success)' }}>
            {loading ? '–' : fulfillmentRate !== null ? `${fulfillmentRate}%` : '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.fulfilledCount} fulfilled · {stats.failedCount} rejected
          </div>
        </div>
      </section>

      {/* ══ ROW 2: Revenue KPIs ══════════════════════════════════════════════ */}
      <section className="admin-stats-grid" style={{ marginTop: '0.75rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Month Revenue */}
        <div className="stat-card" onClick={() => navigate('/admin/payments')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Month Revenue</span>
            <IndianRupee size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="stat-value">{loading ? '–' : fmt(stats.monthRevenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.monthFulfilledCount} orders this month
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Avg Order Value</span>
            <BarChart2 size={20} className="stat-icon" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {loading ? '–' : avgOrderValue !== null ? fmt(avgOrderValue) : '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Per fulfilled order · this month</div>
        </div>

        {/* All-time Revenue */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">All-Time Revenue</span>
            <IndianRupee size={20} className="stat-icon" />
          </div>
          <div className="stat-value">{loading ? '–' : fmt(stats.allTimeRevenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.fulfilledCount} orders total
          </div>
        </div>

        {/* COD Uncollected */}
        <div
          className="stat-card"
          onClick={() => navigate('/admin/payments')}
          style={{
            cursor: 'pointer',
            ...(stats.codUncollected > 0 ? { borderColor: '#7c3aed', background: 'rgba(124,58,237,0.03)' } : {}),
          }}
        >
          <div className="stat-header">
            <span className="stat-label">COD Uncollected</span>
            <Wallet size={20} className="stat-icon" style={{ color: stats.codUncollected > 0 ? '#7c3aed' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: stats.codUncollected > 0 ? '#7c3aed' : undefined }}>
            {loading ? '–' : stats.codUncollected}
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: stats.codUncollected > 0 ? '#7c3aed' : 'var(--text-muted)' }}>
            {stats.codUncollected > 0 ? 'Cash not yet collected' : 'All COD collected ✓'}
          </div>
        </div>
      </section>

      {/* ══ ALERT STRIP ══════════════════════════════════════════════════════ */}
      {alertItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          {alertItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.link)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                color: item.color, background: item.bg, border: `1px solid ${item.color}33`,
                cursor: 'pointer',
              }}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      )}

      {/* ══ MAIN PANELS ══════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', marginTop: '1.25rem', flexWrap: 'wrap' }}>

        {/* ── Pending Orders (all, inline, oldest first) ── */}
        <div className="dashboard-panel" style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h2 style={{ margin: 0 }}>Pending Orders</h2>
            {stats.pendingOrders > 0 && (
              <span style={{
                background: 'var(--secondary)', color: '#fff', borderRadius: '999px',
                fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.55rem',
              }}>{stats.pendingOrders}</span>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              oldest first — click row to open
            </span>
          </div>

          {loading ? (
            <div className="admin-empty-state">Loading…</div>
          ) : pendingOrders.length === 0 ? (
            <div className="admin-empty-state" style={{ padding: '2.5rem 0' }}>
              <span style={{ fontSize: '2rem' }}>🎉</span>
              <div style={{ fontWeight: 600, marginTop: '0.5rem' }}>All clear! No pending orders.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Age</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => {
                    const age = ageBadge(order.created_at);
                    return (
                      <tr key={order.id} onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                          {order.order_number || order.id.slice(0, 8).toUpperCase()}
                          {order.payment_mode === 'Cash on delivery' && (
                            <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600, marginTop: '0.1rem' }}>COD</div>
                          )}
                        </td>
                        <td>
                          <strong>{order.customer_name}</strong>
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                            <a href={`tel:${order.phone}`} onClick={(e) => e.stopPropagation()}>{order.phone}</a>
                          </small>
                        </td>
                        <td>
                          <div className="order-items-list">
                            {order.items?.slice(0, 3).map((item, i) => (
                              <div key={i} style={{ fontSize: '0.82rem' }}>{item.name} × {item.quantity}</div>
                            ))}
                            {order.items?.length > 3 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{order.items.length - 3} more</div>
                            )}
                          </div>
                          {order.special_instructions && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              "{order.special_instructions}"
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>₹{order.total}</td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
                            fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap',
                            border: `1px solid ${age.color}`, color: age.color, background: age.bg,
                          }}>
                            {age.label}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'nowrap' }}>
                            <button
                              onClick={() => navigate('/admin/orders')}
                              title="Fulfill this order"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            ><Check size={12} /><span>Fulfill</span></button>
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={rejectingId === order.id}
                              title="Reject this order"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: 'transparent', color: 'var(--danger)', border: '1.5px solid var(--danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap', opacity: rejectingId === order.id ? 0.6 : 1 }}
                            ><X size={12} /><span>Reject</span></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right sidebar: top products + quick numbers ── */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Today's top products */}
          <div className="dashboard-panel">
            <h2>Today's Demand</h2>
            {topProducts.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>No orders today yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginTop: '0.75rem' }}>
                {topProducts.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--secondary)' : i === 2 ? '#6366f1' : 'var(--text-muted)',
                      color: '#fff', fontWeight: 700, fontSize: '0.68rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>#{i + 1}</span>
                    <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.qty} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats panel */}
          <div className="dashboard-panel">
            <h2>Quick Stats</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              {[
                { label: 'Low-stock products', val: stats.lowStockProducts, warn: stats.lowStockProducts > 0, link: '/admin/products' },
                { label: 'Pending visits', val: stats.newVisits, warn: stats.newVisits > 0, link: '/admin/visits' },
                { label: 'Farmer applications', val: stats.pendingApps, warn: stats.pendingApps > 0, link: '/admin/applications' },
                { label: 'Orders >6h old', val: stats.agingOrders, warn: stats.agingOrders > 0, link: '/admin/orders' },
              ].map(({ label, val, warn, link }) => (
                <div
                  key={label}
                  onClick={() => navigate(link)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.3rem 0', borderBottom: '1px solid var(--border-color)' }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: warn ? '#dc2626' : 'var(--text-main)' }}>
                    {loading ? '–' : val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ CHARTS ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>

        {/* 7-day revenue */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} style={{ color: 'var(--secondary)' }} />
            7-Day Revenue
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              fulfilled orders only
            </span>
          </h2>
          {weekRevenue.every((d) => d.revenue === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No fulfilled orders in the last 7 days.</div>
          ) : (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <MiniBarChart
                  data={weekRevenue.map((d) => ({ label: d.label, value: d.revenue, sub: d.orders > 0 ? `${d.orders}` : '' }))}
                  color="var(--secondary)"
                  formatValue={(n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))}
                  height={110}
                />
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>7-day total: <strong style={{ color: 'var(--text-main)' }}>{fmt(weekRevenue.reduce((s, d) => s + d.revenue, 0))}</strong></span>
                <span>Orders: <strong style={{ color: 'var(--text-main)' }}>{weekRevenue.reduce((s, d) => s + d.orders, 0)}</strong></span>
                <span>Best day: <strong style={{ color: 'var(--secondary)' }}>
                  {weekRevenue.reduce((best, d) => d.revenue > best.revenue ? d : best, weekRevenue[0]).label}
                </strong></span>
              </div>
            </>
          )}
        </div>

        {/* Orders by hour */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            Orders by Hour
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              last 7 days
            </span>
          </h2>
          {hourBuckets.every((v) => v === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No order data yet.</div>
          ) : (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <MiniBarChart
                  data={hourBuckets.map((count, h) => ({ label: h % 3 === 0 ? `${h}h` : '', value: count }))}
                  color="var(--primary)"
                  formatValue={String}
                  height={110}
                />
              </div>
              {(() => {
                const peakH = hourBuckets.indexOf(Math.max(...hourBuckets));
                const total = hourBuckets.reduce((s, v) => s + v, 0);
                const busyBand = peakH < 12 ? 'morning' : peakH < 17 ? 'afternoon' : 'evening';
                return (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span>Peak: <strong style={{ color: 'var(--text-main)' }}>{peakH}:00–{peakH + 1}:00</strong></span>
                    <span>Band: <strong style={{ color: 'var(--primary)' }}>{busyBand}</strong></span>
                    <span>Total: <strong style={{ color: 'var(--text-main)' }}>{total} orders</strong></span>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
