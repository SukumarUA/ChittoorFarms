import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, IndianRupee, Package, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Stats {
  pendingOrders: number;
  totalRevenue: number;
  newVisits: number;
  pendingApps: number;
  lowStockProducts: number;
}

interface RecentOrder {
  id: string;
  order_number: string | null;
  customer_name: string;
  phone: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0,
    totalRevenue: 0,
    newVisits: 0,
    pendingApps: 0,
    lowStockProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStatsAndOrders = useCallback(async () => {
    try {
      const [pendingOrders, fulfilledOrders, visits, applications, lowStock, orders] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('total').eq('status', 'fulfilled'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true).lte('stock', 5),
        supabase
          .from('orders')
          .select('id, order_number, customer_name, phone, total, items')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        pendingOrders: pendingOrders.count || 0,
        totalRevenue: fulfilledOrders.data?.reduce((sum, order) => sum + Number(order.total), 0) || 0,
        newVisits: visits.count || 0,
        pendingApps: applications.count || 0,
        lowStockProducts: lowStock.count || 0,
      });
      setRecentOrders((orders.data as RecentOrder[]) || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadStatsAndOrders);

    const subscription = supabase
      .channel('dashboard-db-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, loadStatsAndOrders)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadStatsAndOrders]);

  return (
    <div>
      <section className="admin-stats-grid">
        <div className="stat-card" onClick={() => navigate('/admin/orders')}>
          <div className="stat-header"><span className="stat-label">Pending Orders</span><Package size={20} className="stat-icon" /></div>
          <div className="stat-value">{stats.pendingOrders}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/admin/orders')}>
          <div className="stat-header"><span className="stat-label">Total Revenue</span><IndianRupee size={20} className="stat-icon" style={{ color: 'var(--success)' }} /></div>
          <div className="stat-value">₹{stats.totalRevenue}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/admin/visits')}>
          <div className="stat-header"><span className="stat-label">New Visit Bookings</span><CalendarDays size={20} className="stat-icon" style={{ color: 'var(--secondary)' }} /></div>
          <div className="stat-value">{stats.newVisits}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/admin/applications')}>
          <div className="stat-header"><span className="stat-label">Pending Apps</span><UserCheck size={20} className="stat-icon" style={{ color: 'var(--accent)' }} /></div>
          <div className="stat-value">{stats.pendingApps}</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/admin/products')}>
          <div className="stat-header"><span className="stat-label">Low-Stock Items</span><AlertTriangle size={20} className="stat-icon" style={{ color: 'var(--danger)' }} /></div>
          <div className="stat-value">{stats.lowStockProducts}</div>
        </div>
      </section>

      <div className="dashboard-panel">
        <h2>Recent Pending Orders</h2>
        {loading ? (
          <div className="admin-empty-state">Loading recent orders...</div>
        ) : recentOrders.length === 0 ? (
          <div className="admin-empty-state">No pending orders to display.</div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead><tr><th>Order Reference</th><th>Customer</th><th>Phone</th><th>Items</th><th>Total</th></tr></thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                      {order.order_number || order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                    <td><a href={`tel:${order.phone}`}>{order.phone}</a></td>
                    <td>
                      <div className="order-items-list">
                        {order.items.map((item, index) => <div key={index}>{item.name} x {item.quantity}</div>)}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>₹{order.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
