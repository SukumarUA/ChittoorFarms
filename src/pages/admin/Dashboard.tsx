import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart2, CalendarDays, Clock, IndianRupee, Package, TrendingUp, UserCheck } from 'lucide-react';
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
  const totalBars = data.length;
  // ViewBox: 500 wide, height + 26 for labels
  const W = 500;
  const H = height;
  const PAD = 4;
  const slotW = (W - PAD * 2) / totalBars;
  const barW = Math.max(slotW * 0.6, 6);

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 26}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="Bar chart"
    >
      {/* grid lines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={PAD} y1={H - pct * H}
          x2={W - PAD} y2={H - pct * H}
          stroke="var(--border)" strokeWidth={0.5}
        />
      ))}
      {data.map((d, i) => {
        const barH = (d.value / max) * H;
        const x = PAD + i * slotW + (slotW - barW) / 2;
        const y = H - barH;
        const pct = d.value / max;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.82} />
            {/* value label inside bar if tall enough */}
            {pct > 0.18 && (
              <text
                x={x + barW / 2} y={y + 13}
                textAnchor="middle" fontSize={9} fontWeight={700}
                fill="#fff" style={{ fontFamily: 'inherit' }}
              >
                {formatValue(d.value)}
              </text>
            )}
            {/* day/hour label below bar */}
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle" fontSize={9}
              fill="var(--text-muted)" style={{ fontFamily: 'inherit' }}
            >
              {d.label}
            </text>
            {/* sub label (e.g. order count) below day label */}
            {d.sub && (
              <text
                x={x + barW / 2} y={H + 25}
                textAnchor="middle" fontSize={8}
                fill="var(--text-muted)" style={{ fontFamily: 'inherit' }}
              >
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

// Returns age label + colors for an order placed at createdAt
const ageBadge = (createdAt: string): { label: string; color: string; bg: string } => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
  if (h >= 6) return { label, color: '#dc2626', bg: '#fee2e2' };
  if (h >= 2) return { label, color: '#92400e', bg: '#fef3c7' };
  return { label, color: '#166534', bg: '#dcfce7' };
};

interface Stats {
  pendingOrders: number;
  todayOrders: number;
  monthRevenue: number;
  allTimeRevenue: number;
  fulfilledCount: number;
  failedCount: number;
  agingOrders: number;
  newVisits: number;
  pendingApps: number;
  lowStockProducts: number;
}

interface DayRevenue { label: string; dayKey: string; revenue: number; orders: number; }

interface RecentOrder {
  id: string;
  order_number: string | null;
  customer_name: string;
  phone: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0, todayOrders: 0, monthRevenue: 0, allTimeRevenue: 0,
    fulfilledCount: 0, failedCount: 0, agingOrders: 0,
    newVisits: 0, pendingApps: 0, lowStockProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [todayItems, setTodayItems] = useState<Array<Array<{ name: string; quantity: number }>>>([]);
  const [weekRevenue, setWeekRevenue] = useState<DayRevenue[]>([]);
  const [hourBuckets, setHourBuckets] = useState<number[]>(new Array(24).fill(0));
  const [loading, setLoading] = useState(true);

  // Tick every 60s so age badges refresh without a page reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const loadStatsAndOrders = useCallback(async () => {
    try {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const todayISO    = midnight.toISOString();
      const monthStart  = new Date(midnight.getFullYear(), midnight.getMonth(), 1).toISOString();
      const sixHoursAgo = new Date(Date.now() - 6 * 3_600_000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const [
        pendingRes, todayCountRes, monthRevRes, allRevRes,
        fulfilledRes, failedRes, agingRes,
        visitsRes, appsRes, lowStockRes,
        recentRes, todayOrdersRes,
        weekFulfilledRes, weekAllRes,
      ] = await Promise.all([
        // Pending count
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        // Today's order count (non-cancelled)
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).neq('status', 'cancelled'),
        // This month's fulfilled revenue
        supabase.from('orders').select('total').eq('status', 'fulfilled').gte('created_at', monthStart),
        // All-time fulfilled revenue
        supabase.from('orders').select('total').eq('status', 'fulfilled'),
        // Fulfilled count (for rate)
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled'),
        // Failed count (for rate)
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        // Pending orders older than 6h
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('created_at', sixHoursAgo),
        // Visit bookings
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        // Farmer applications
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        // Low-stock products
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true).lte('stock', 5),
        // 10 oldest pending orders (most urgent first)
        supabase.from('orders')
          .select('id, order_number, customer_name, phone, total, items, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10),
        // Today's orders items (for top-products)
        supabase.from('orders').select('items').gte('created_at', todayISO).neq('status', 'cancelled'),
        // Last 7 days fulfilled orders (revenue chart)
        supabase.from('orders').select('total, created_at').eq('status', 'fulfilled').gte('created_at', sevenDaysAgo),
        // Last 7 days all orders (hour distribution)
        supabase.from('orders').select('created_at').neq('status', 'cancelled').gte('created_at', sevenDaysAgo),
      ]);

      setStats({
        pendingOrders:    pendingRes.count   ?? 0,
        todayOrders:      todayCountRes.count ?? 0,
        monthRevenue:     monthRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
        allTimeRevenue:   allRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
        fulfilledCount:   fulfilledRes.count  ?? 0,
        failedCount:      failedRes.count     ?? 0,
        agingOrders:      agingRes.count      ?? 0,
        newVisits:        visitsRes.count     ?? 0,
        pendingApps:      appsRes.count       ?? 0,
        lowStockProducts: lowStockRes.count   ?? 0,
      });

      setRecentOrders((recentRes.data as RecentOrder[]) ?? []);

      setTodayItems(
        (todayOrdersRes.data ?? []).map((o) => {
          const raw = (o as { items: unknown }).items;
          return Array.isArray(raw) ? (raw as Array<{ name: string; quantity: number }>) : [];
        }),
      );

      // Build 7-day revenue chart data (last 7 calendar days, oldest → newest)
      const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const revByDay = new Map<string, { revenue: number; orders: number }>();
      const days: DayRevenue[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
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

      // Build 24-hour order-volume buckets
      const buckets = new Array(24).fill(0) as number[];
      for (const row of (weekAllRes.data ?? [])) {
        const h = new Date((row as { created_at: string }).created_at).getHours();
        buckets[h] = (buckets[h] ?? 0) + 1;
      }
      setHourBuckets([...buckets]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadStatsAndOrders);
    const sub = supabase
      .channel('dashboard-db-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, loadStatsAndOrders)
      .subscribe();
    return () => { void sub.unsubscribe(); };
  }, [loadStatsAndOrders]);

  const fulfillmentRate = useMemo(() => {
    const total = stats.fulfilledCount + stats.failedCount;
    return total > 0 ? Math.round((stats.fulfilledCount / total) * 100) : null;
  }, [stats.fulfilledCount, stats.failedCount]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const items of todayItems) {
      for (const item of items) {
        map.set(item.name, (map.get(item.name) ?? 0) + item.quantity);
      }
    }
    return [...map.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [todayItems]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div>
      {/* ── Row 1: Critical operations ── */}
      <section className="admin-stats-grid">
        <div
          className="stat-card"
          onClick={() => navigate('/admin/orders')}
          style={{ cursor: 'pointer', ...(stats.pendingOrders > 0 ? { borderColor: 'var(--secondary)' } : {}) }}
        >
          <div className="stat-header">
            <span className="stat-label">Pending Orders</span>
            <Package size={20} className="stat-icon" />
          </div>
          <div className="stat-value">{stats.pendingOrders}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Awaiting fulfillment</div>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate('/admin/orders')}
          style={{
            cursor: 'pointer',
            ...(stats.agingOrders > 0
              ? { borderColor: '#dc2626', background: 'rgba(220,38,38,0.04)' }
              : {}),
          }}
        >
          <div className="stat-header">
            <span className="stat-label">Orders &gt;6h Old</span>
            <Clock size={20} className="stat-icon" style={{ color: stats.agingOrders > 0 ? '#dc2626' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: stats.agingOrders > 0 ? '#dc2626' : undefined }}>
            {stats.agingOrders}
          </div>
          <div style={{
            fontSize: '0.78rem', marginTop: '0.25rem',
            color: stats.agingOrders > 0 ? '#dc2626' : 'var(--text-muted)',
          }}>
            {stats.agingOrders > 0 ? '⚠ Needs immediate attention' : 'All fresh'}
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Today's Orders</span>
            <Package size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="stat-value">{stats.todayOrders}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Since midnight</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/payments')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">This Month's Revenue</span>
            <IndianRupee size={20} className="stat-icon" style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value">{fmt(stats.monthRevenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            All-time: {fmt(stats.allTimeRevenue)}
          </div>
        </div>
      </section>

      {/* ── Row 2: Secondary metrics ── */}
      <section className="admin-stats-grid" style={{ marginTop: '0.75rem' }}>
        <div className="stat-card" onClick={() => navigate('/admin/visits')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">New Visit Bookings</span>
            <CalendarDays size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="stat-value">{stats.newVisits}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/applications')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Pending Farmer Apps</span>
            <UserCheck size={20} className="stat-icon" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="stat-value">{stats.pendingApps}</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/products')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Low-Stock Items</span>
            <AlertTriangle size={20} className="stat-icon" style={{ color: 'var(--danger)' }} />
          </div>
          <div className="stat-value">{stats.lowStockProducts}</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Fulfillment Rate</span>
            <TrendingUp
              size={20}
              className="stat-icon"
              style={{ color: fulfillmentRate !== null && fulfillmentRate < 90 ? 'var(--danger)' : 'var(--success)' }}
            />
          </div>
          <div
            className="stat-value"
            style={{ color: fulfillmentRate !== null && fulfillmentRate < 90 ? 'var(--danger)' : 'var(--success)' }}
          >
            {fulfillmentRate !== null ? `${fulfillmentRate}%` : '—'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats.fulfilledCount} fulfilled · {stats.failedCount} failed
          </div>
        </div>
      </section>

      {/* ── Main panels ── */}
      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', marginTop: '1.5rem', flexWrap: 'wrap' }}>

        {/* Recent pending orders (oldest first = most urgent) */}
        <div className="dashboard-panel" style={{ flex: '1 1 0', minWidth: 0 }}>
          <h2>
            Pending Orders
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              oldest first — most urgent at top
            </span>
          </h2>

          {loading ? (
            <div className="admin-empty-state">Loading recent orders...</div>
          ) : recentOrders.length === 0 ? (
            <div className="admin-empty-state">No pending orders 🎉</div>
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
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const age = ageBadge(order.created_at);
                    return (
                      <tr
                        key={order.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate('/admin/orders')}
                      >
                        <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                          {order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td>
                          <strong>{order.customer_name}</strong>
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                            <a
                              href={`tel:${order.phone}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {order.phone}
                            </a>
                          </small>
                        </td>
                        <td>
                          <div className="order-items-list">
                            {order.items?.map((item, i) => (
                              <div key={i}>{item.name} × {item.quantity}</div>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>₹{order.total}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: `1px solid ${age.color}`,
                            color: age.color,
                            background: age.bg,
                            whiteSpace: 'nowrap',
                          }}>
                            {age.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Today's top products sidebar */}
        {topProducts.length > 0 && (
          <div className="dashboard-panel" style={{ width: '260px', flexShrink: 0 }}>
            <h2>Today's Top Products</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              {topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--secondary)' : 'var(--text-muted)',
                    color: '#fff', fontWeight: 700, fontSize: '0.72rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>#{i + 1}</span>
                  <span style={{
                    flex: 1, fontSize: '0.88rem', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.name}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {p.qty} units
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>

        {/* 7-day revenue bar chart */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} style={{ color: 'var(--secondary)' }} />
            7-Day Revenue
            <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              fulfilled orders only
            </span>
          </h2>
          {weekRevenue.length === 0 ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>Loading chart…</div>
          ) : weekRevenue.every((d) => d.revenue === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No fulfilled orders in the last 7 days.</div>
          ) : (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <MiniBarChart
                  data={weekRevenue.map((d) => ({
                    label: d.label,
                    value: d.revenue,
                    sub: d.orders > 0 ? `${d.orders}` : '',
                  }))}
                  color="var(--secondary)"
                  formatValue={(n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))}
                  height={110}
                />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Total: <strong style={{ color: 'var(--text-main)' }}>{fmt(weekRevenue.reduce((s, d) => s + d.revenue, 0))}</strong></span>
                <span>Orders: <strong style={{ color: 'var(--text-main)' }}>{weekRevenue.reduce((s, d) => s + d.orders, 0)}</strong></span>
                <span>Best: <strong style={{ color: 'var(--secondary)' }}>
                  {weekRevenue.reduce((best, d) => d.revenue > best.revenue ? d : best, weekRevenue[0]).label}
                </strong></span>
              </div>
            </>
          )}
        </div>

        {/* Order volume by hour */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            Orders by Hour
            <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              last 7 days
            </span>
          </h2>
          {hourBuckets.every((v) => v === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No order data yet.</div>
          ) : (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <MiniBarChart
                  data={hourBuckets.map((count, h) => ({
                    label: h % 3 === 0 ? `${h}h` : '',
                    value: count,
                  }))}
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
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', gap: '1.5rem' }}>
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
