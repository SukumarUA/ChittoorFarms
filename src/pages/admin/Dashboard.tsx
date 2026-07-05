import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart2, CalendarDays, Check, Clock,
  IndianRupee, Package, TrendingUp, UserCheck, Wallet, X, ShoppingBag, Filter,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: '7 Days' },
  { key: '30d',   label: '30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  month: 'This Month',
  custom: 'Custom Range',
};

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
  const barW = Math.max(slotW * 0.6, 4);
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
          <g key={i}>
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

// ── Age badge (coloring: ≥24h = red, ≥6h = amber, <6h = green) ──────────────
const ageBadge = (createdAt: string): { label: string; color: string; bg: string } => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const d = Math.floor(h / 24);
  const label = d >= 1 ? `${d}d old` : h > 0 ? `${h}h ${m}m old` : `${m}m old`;
  if (h >= 24) return { label, color: '#dc2626', bg: '#fee2e2' };
  if (h >= 6)  return { label, color: '#92400e', bg: '#fef3c7' };
  return { label, color: '#166534', bg: '#dcfce7' };
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface StaticStats {
  pendingOrders: number;
  agingOrders: number;       // pending and >24h old
  codUncollected: number;
  allTimeRevenue: number;
  allTimeFulfilled: number;
  allTimeFailed: number;
  newVisits: number;
  pendingApps: number;
  lowStockProducts: number;
}

interface RangedStats {
  revenue: number;
  ordersCount: number;
  fulfilledCount: number;
  failedCount: number;
}

interface DayBucket { label: string; dayKey: string; revenue: number; orders: number; }

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

  // ── Date filter state ──
  const [preset, setPreset]       = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  // ── Data state ──
  const [staticStats, setStaticStats] = useState<StaticStats>({
    pendingOrders: 0, agingOrders: 0, codUncollected: 0,
    allTimeRevenue: 0, allTimeFulfilled: 0, allTimeFailed: 0,
    newVisits: 0, pendingApps: 0, lowStockProducts: 0,
  });
  const [rangedStats, setRangedStats] = useState<RangedStats>({
    revenue: 0, ordersCount: 0, fulfilledCount: 0, failedCount: 0,
  });
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [periodItems,   setPeriodItems]   = useState<Array<Array<{ name: string; quantity: number }>>>([]);
  const [dayBuckets,    setDayBuckets]    = useState<DayBucket[]>([]);
  const [hourBuckets,   setHourBuckets]   = useState<number[]>(new Array(24).fill(0));
  const [loading, setLoading]         = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Auto-refresh age badges every 60s
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Compute range from preset ──
  const { rangeFrom, rangeTo } = useMemo(() => {
    const now     = new Date();
    const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
    const to       = now.toISOString();
    switch (preset) {
      case 'today':
        return { rangeFrom: midnight.toISOString(), rangeTo: to };
      case '7d':
        return { rangeFrom: new Date(Date.now() - 7 * 86_400_000).toISOString(), rangeTo: to };
      case '30d':
        return { rangeFrom: new Date(Date.now() - 30 * 86_400_000).toISOString(), rangeTo: to };
      case 'month':
        return { rangeFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), rangeTo: to };
      case 'custom':
        return {
          rangeFrom: customFrom ? new Date(customFrom).toISOString() : midnight.toISOString(),
          rangeTo:   customTo   ? new Date(`${customTo}T23:59:59`).toISOString() : to,
        };
    }
  }, [preset, customFrom, customTo]);

  // ── Load always-current (static) stats ──
  const loadStatic = useCallback(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const [pendingRes, agingRes, codRes, allRevRes, fulRes, failRes, visitsRes, appsRes, lowStockRes] =
      await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending').lte('created_at', twentyFourHoursAgo),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled').eq('payment_mode', 'Cash on delivery').is('cash_collected_by', null),
        supabase.from('orders').select('total').eq('status', 'fulfilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true).lte('stock', 5),
      ]);
    setStaticStats({
      pendingOrders:   pendingRes.count ?? 0,
      agingOrders:     agingRes.count ?? 0,
      codUncollected:  codRes.count ?? 0,
      allTimeRevenue:  allRevRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
      allTimeFulfilled: fulRes.count ?? 0,
      allTimeFailed:   failRes.count ?? 0,
      newVisits:       visitsRes.count ?? 0,
      pendingApps:     appsRes.count ?? 0,
      lowStockProducts: lowStockRes.count ?? 0,
    });

    // Pending orders list (oldest first)
    const { data: poData } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, phone, total, items, created_at, payment_mode, special_instructions, preferred_delivery_date')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50);
    setPendingOrders((poData as PendingOrder[]) ?? []);
  }, []);

  // ── Load date-range-dependent stats ──
  const loadRanged = useCallback(async (from: string, to: string) => {
    const [revRes, countRes, fulRes, failRes, itemsRes, chartRes] = await Promise.all([
      // Period revenue (fulfilled)
      supabase.from('orders').select('total').eq('status', 'fulfilled').gte('created_at', from).lte('created_at', to),
      // Period total orders (non-cancelled)
      supabase.from('orders').select('*', { count: 'exact', head: true }).neq('status', 'cancelled').gte('created_at', from).lte('created_at', to),
      // Period fulfilled count
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'fulfilled').gte('created_at', from).lte('created_at', to),
      // Period failed count
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', from).lte('created_at', to),
      // Period items (for demand sidebar)
      supabase.from('orders').select('items').neq('status', 'cancelled').gte('created_at', from).lte('created_at', to),
      // Period orders for charts (fulfilled revenue + all order hours)
      supabase.from('orders').select('total, created_at, status').gte('created_at', from).lte('created_at', to).neq('status', 'cancelled'),
    ]);

    setRangedStats({
      revenue:       revRes.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
      ordersCount:   countRes.count ?? 0,
      fulfilledCount: fulRes.count ?? 0,
      failedCount:   failRes.count ?? 0,
    });

    setPeriodItems(
      (itemsRes.data ?? []).map((o) => {
        const raw = (o as { items: unknown }).items;
        return Array.isArray(raw) ? (raw as Array<{ name: string; quantity: number }>) : [];
      }),
    );

    // Build day buckets
    const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
    const toDate   = new Date(to);
    const diffMs   = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / 86_400_000));
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    type WeekAgg = { label: string; dayKey: string; revenue: number; orders: number };

    let days: WeekAgg[];
    if (diffDays <= 31) {
      // Day-by-day
      days = [];
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(fromDate); d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const dayLabel = diffDays <= 7 ? DAY_LABELS[d.getDay()] : diffDays <= 14 ? `${d.getDate()}` : i % 3 === 0 ? `${d.getDate()}` : '';
        days.push({ label: dayLabel, dayKey: key, revenue: 0, orders: 0 });
      }
      const dayMap = new Map(days.map((d) => [d.dayKey, d]));
      for (const row of (chartRes.data ?? [])) {
        const key = (row as { created_at: string; total: number; status: string }).created_at.slice(0, 10);
        const bucket = dayMap.get(key);
        if (bucket) {
          const r = row as { total: number; status: string };
          if (r.status === 'fulfilled') bucket.revenue += Number(r.total);
          bucket.orders += 1;
        }
      }
    } else {
      // Weekly aggregation
      const weekCount = Math.ceil(diffDays / 7);
      days = Array.from({ length: weekCount }, (_, wi) => {
        const d = new Date(fromDate); d.setDate(d.getDate() + wi * 7);
        return { label: `W${wi + 1}`, dayKey: d.toISOString().slice(0, 10), revenue: 0, orders: 0 };
      });
      for (const row of (chartRes.data ?? [])) {
        const rowDate = new Date((row as { created_at: string }).created_at);
        const weekIdx = Math.floor((rowDate.getTime() - fromDate.getTime()) / (7 * 86_400_000));
        const bucket  = days[weekIdx];
        if (bucket) {
          const r = row as { total: number; status: string };
          if (r.status === 'fulfilled') bucket.revenue += Number(r.total);
          bucket.orders += 1;
        }
      }
    }
    setDayBuckets([...days]);

    // Hour distribution
    const buckets = new Array(24).fill(0) as number[];
    for (const row of (chartRes.data ?? [])) {
      const h = new Date((row as { created_at: string }).created_at).getHours();
      buckets[h] = (buckets[h] ?? 0) + 1;
    }
    setHourBuckets([...buckets]);
  }, []);

  // ── Combined load ──
  const loadAll = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      await Promise.all([loadStatic(), loadRanged(from, to)]);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [loadStatic, loadRanged]);

  // Re-run when range changes
  useEffect(() => {
    void loadAll(rangeFrom, rangeTo);
    const sub = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => void loadAll(rangeFrom, rangeTo))
      .subscribe();
    return () => { void sub.unsubscribe(); };
  }, [loadAll, rangeFrom, rangeTo]);

  // ── Inline reject ──
  const handleReject = async (id: string) => {
    if (!window.confirm('Mark this order as rejected?')) return;
    setRejectingId(id);
    try {
      const { error } = await supabase.from('orders').update({ status: 'failed' }).eq('id', id);
      if (error) throw error;
      setPendingOrders((cur) => cur.filter((o) => o.id !== id));
      setStaticStats((s) => ({ ...s, pendingOrders: Math.max(0, s.pendingOrders - 1) }));
      setRangedStats((s) => ({ ...s, failedCount: s.failedCount + 1 }));
    } catch { /* global handler */ }
    finally { setRejectingId(null); }
  };

  // ── Derived values ──
  const fulfillmentRate = useMemo(() => {
    const total = rangedStats.fulfilledCount + rangedStats.failedCount;
    return total > 0 ? Math.round((rangedStats.fulfilledCount / total) * 100) : null;
  }, [rangedStats]);

  const avgOrderValue = useMemo(() =>
    rangedStats.fulfilledCount > 0
      ? Math.round(rangedStats.revenue / rangedStats.fulfilledCount)
      : null,
  [rangedStats]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const items of periodItems) {
      for (const item of items) {
        map.set(item.name, (map.get(item.name) ?? 0) + item.quantity);
      }
    }
    return [...map.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 7);
  }, [periodItems]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const periodLabel = PRESET_LABELS[preset];

  const alertItems = [
    staticStats.agingOrders > 0 && {
      label: `${staticStats.agingOrders} pending order${staticStats.agingOrders > 1 ? 's' : ''} older than 24h`,
      icon: <Clock size={14} />, color: '#dc2626', bg: '#fee2e2', link: '/admin/orders',
    },
    staticStats.lowStockProducts > 0 && {
      label: `${staticStats.lowStockProducts} product${staticStats.lowStockProducts > 1 ? 's' : ''} low on stock (≤5)`,
      icon: <ShoppingBag size={14} />, color: '#b45309', bg: '#fef3c7', link: '/admin/products',
    },
    staticStats.codUncollected > 0 && {
      label: `${staticStats.codUncollected} COD order${staticStats.codUncollected > 1 ? 's' : ''} with cash not yet collected`,
      icon: <Wallet size={14} />, color: '#7c3aed', bg: '#ede9fe', link: '/admin/payments',
    },
    staticStats.newVisits > 0 && {
      label: `${staticStats.newVisits} new visit booking${staticStats.newVisits > 1 ? 's' : ''} pending`,
      icon: <CalendarDays size={14} />, color: '#0369a1', bg: '#e0f2fe', link: '/admin/visits',
    },
    staticStats.pendingApps > 0 && {
      label: `${staticStats.pendingApps} farmer application${staticStats.pendingApps > 1 ? 's' : ''} to review`,
      icon: <UserCheck size={14} />, color: '#166534', bg: '#dcfce7', link: '/admin/applications',
    },
  ].filter(Boolean) as Array<{ label: string; icon: React.ReactNode; color: string; bg: string; link: string }>;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ══ DATE FILTER BAR ══════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)', padding: '0.6rem 1rem', marginBottom: '1rem',
      }}>
        <Filter size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem', whiteSpace: 'nowrap' }}>
          Metrics period:
        </span>
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            style={{
              padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', border: '1.5px solid',
              borderColor: preset === key ? 'var(--secondary)' : 'var(--border-color)',
              background:   preset === key ? 'var(--secondary)' : 'transparent',
              color:        preset === key ? '#fff' : 'var(--text-muted)',
              transition: 'var(--transition-fast)',
            }}
          >{label}</button>
        ))}
        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
            />
          </div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
          Row 1 = live state · Row 2 = {periodLabel}
        </span>
      </div>

      {/* ══ ROW 1: Live / Current State KPIs ════════════════════════════════ */}
      <section className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>

        {/* Pending Orders */}
        <div
          className="stat-card"
          onClick={() => navigate('/admin/orders')}
          style={{ cursor: 'pointer', ...(staticStats.pendingOrders > 0 ? { borderColor: 'var(--secondary)', borderWidth: 2 } : {}) }}
        >
          <div className="stat-header">
            <span className="stat-label">Pending Orders</span>
            <Package size={20} className="stat-icon" style={{ color: staticStats.pendingOrders > 0 ? 'var(--secondary)' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: staticStats.pendingOrders > 0 ? 'var(--secondary)' : undefined }}>
            {loading ? '–' : staticStats.pendingOrders}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {staticStats.agingOrders > 0
              ? <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {staticStats.agingOrders} older than 24h</span>
              : 'Awaiting fulfillment'}
          </div>
        </div>

        {/* Aging Orders */}
        <div
          className="stat-card"
          onClick={() => navigate('/admin/orders')}
          style={{ cursor: 'pointer', ...(staticStats.agingOrders > 0 ? { borderColor: '#dc2626' } : {}) }}
        >
          <div className="stat-header">
            <span className="stat-label">Orders &gt;24h Old</span>
            <AlertTriangle size={20} className="stat-icon" style={{ color: staticStats.agingOrders > 0 ? '#dc2626' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: staticStats.agingOrders > 0 ? '#dc2626' : undefined }}>
            {loading ? '–' : staticStats.agingOrders}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {staticStats.agingOrders > 0 ? 'Needs urgent attention' : 'All within 24h ✓'}
          </div>
        </div>

        {/* COD Uncollected */}
        <div
          className="stat-card"
          onClick={() => navigate('/admin/payments')}
          style={{ cursor: 'pointer', ...(staticStats.codUncollected > 0 ? { borderColor: '#7c3aed', background: 'rgba(124,58,237,0.03)' } : {}) }}
        >
          <div className="stat-header">
            <span className="stat-label">COD Uncollected</span>
            <Wallet size={20} className="stat-icon" style={{ color: staticStats.codUncollected > 0 ? '#7c3aed' : undefined }} />
          </div>
          <div className="stat-value" style={{ color: staticStats.codUncollected > 0 ? '#7c3aed' : undefined }}>
            {loading ? '–' : staticStats.codUncollected}
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: staticStats.codUncollected > 0 ? '#7c3aed' : 'var(--text-muted)' }}>
            {staticStats.codUncollected > 0 ? 'Cash not yet collected' : 'All COD collected ✓'}
          </div>
        </div>

        {/* All-Time Revenue */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">All-Time Revenue</span>
            <IndianRupee size={20} className="stat-icon" />
          </div>
          <div className="stat-value">{loading ? '–' : fmt(staticStats.allTimeRevenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {staticStats.allTimeFulfilled} orders fulfilled · {staticStats.allTimeFailed} rejected
          </div>
        </div>
      </section>

      {/* ══ ROW 2: Date-Range KPIs ═══════════════════════════════════════════ */}
      <section className="admin-stats-grid" style={{ marginTop: '0.75rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>

        {/* Period Revenue */}
        <div className="stat-card" onClick={() => navigate('/admin/payments')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Revenue</span>
            <IndianRupee size={20} className="stat-icon" style={{ color: 'var(--success)' }} />
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{loading ? '–' : fmt(rangedStats.revenue)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Fulfilled · <span style={{ fontStyle: 'italic' }}>{periodLabel}</span>
          </div>
        </div>

        {/* Period Orders */}
        <div className="stat-card" onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
          <div className="stat-header">
            <span className="stat-label">Orders Placed</span>
            <Package size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} />
          </div>
          <div className="stat-value">{loading ? '–' : rangedStats.ordersCount}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {rangedStats.fulfilledCount} fulfilled · <span style={{ fontStyle: 'italic' }}>{periodLabel}</span>
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
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Per fulfilled order · <span style={{ fontStyle: 'italic' }}>{periodLabel}</span>
          </div>
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
            {rangedStats.fulfilledCount} fulfilled · {rangedStats.failedCount} rejected · <span style={{ fontStyle: 'italic' }}>{periodLabel}</span>
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

        {/* ── Pending Orders table ── */}
        <div className="dashboard-panel" style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h2 style={{ margin: 0 }}>Pending Orders</h2>
            {staticStats.pendingOrders > 0 && (
              <span style={{
                background: 'var(--secondary)', color: '#fff', borderRadius: '999px',
                fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.55rem',
              }}>{staticStats.pendingOrders}</span>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              oldest first · click Fulfill to open order
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

        {/* ── Right sidebar ── */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Period demand */}
          <div className="dashboard-panel">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Demand
              <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>· {periodLabel}</span>
            </h2>
            {topProducts.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>No orders in period.</div>
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

          {/* Quick stats */}
          <div className="dashboard-panel">
            <h2>Live Status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
              {[
                { label: 'Low-stock products', val: staticStats.lowStockProducts, warn: staticStats.lowStockProducts > 0, link: '/admin/products' },
                { label: 'Pending visits', val: staticStats.newVisits, warn: staticStats.newVisits > 0, link: '/admin/visits' },
                { label: 'Farmer applications', val: staticStats.pendingApps, warn: staticStats.pendingApps > 0, link: '/admin/applications' },
                { label: 'Orders >24h old', val: staticStats.agingOrders, warn: staticStats.agingOrders > 0, link: '/admin/orders' },
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

        {/* Revenue chart */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} style={{ color: 'var(--secondary)' }} />
            Revenue · {periodLabel}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              fulfilled only
            </span>
          </h2>
          {dayBuckets.every((d) => d.revenue === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No fulfilled orders in period.</div>
          ) : (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <MiniBarChart
                  data={dayBuckets.map((d) => ({ label: d.label, value: d.revenue, sub: d.orders > 0 ? `${d.orders}` : '' }))}
                  color="var(--secondary)"
                  formatValue={(n) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))}
                  height={110}
                />
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>Total: <strong style={{ color: 'var(--text-main)' }}>{fmt(rangedStats.revenue)}</strong></span>
                <span>Orders: <strong style={{ color: 'var(--text-main)' }}>{rangedStats.fulfilledCount}</strong></span>
                {dayBuckets.length > 1 && (
                  <span>Best: <strong style={{ color: 'var(--secondary)' }}>
                    {dayBuckets.reduce((b, d) => d.revenue > b.revenue ? d : b, dayBuckets[0]).label}
                  </strong></span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Orders by hour */}
        <div className="dashboard-panel" style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            Orders by Hour · {periodLabel}
          </h2>
          {hourBuckets.every((v) => v === 0) ? (
            <div className="admin-empty-state" style={{ padding: '2rem 0' }}>No order data in period.</div>
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
                const peakH    = hourBuckets.indexOf(Math.max(...hourBuckets));
                const total    = hourBuckets.reduce((s, v) => s + v, 0);
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
