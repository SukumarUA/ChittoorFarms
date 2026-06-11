import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, Phone, RotateCcw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface Order {
  id: string;
  order_number: string | null;
  created_at: string;
  customer_name: string;
  phone: string;
  address: string;
  pin_code: string | null;
  preferred_delivery_date: string | null;
  special_instructions: string | null;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'fulfilled' | 'failed';
  payment_mode: 'UPI' | 'Cash on delivery' | 'Bank transfer' | 'Card' | null;
  payment_amount: number | null;
  payment_reference: string | null;
  payment_notes: string | null;
  payment_recorded_at: string | null;
}

export const Orders: React.FC = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'fulfilled' | 'failed'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal states for fulfillment
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Cash on delivery' | 'Bank transfer' | 'Card'>('UPI');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states for deletion
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      showToast('Could not fetch orders list.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('orders-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOrders]);

  // Tab Filtering
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    if (order.status !== activeTab) return false;
    const searchable = [
      order.order_number,
      order.id,
      order.customer_name,
      order.phone,
      order.address,
      order.payment_reference,
      ...order.items.map((item) => item.name),
    ].filter(Boolean).join(' ').toLowerCase();
    const orderDate = order.created_at.slice(0, 10);
    return (!normalizedSearch || searchable.includes(normalizedSearch))
      && (!dateFrom || orderDate >= dateFrom)
      && (!dateTo || orderDate <= dateTo);
  });

  // Status Change: Fail
  const handleMarkFailed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', id);

      if (error) throw error;
      showToast('Order marked as Failed.', 'warning');
    } catch (err) {
      console.error('Error failing order:', err);
      showToast('Failed to update status.', 'error');
    }
  };

  // Status Change: Restore to Pending
  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'pending',
          payment_mode: null,
          payment_amount: null,
          payment_reference: null,
          payment_notes: null,
          payment_recorded_at: null,
        })
        .eq('id', id);

      if (error) throw error;
      showToast('Order restored back to Pending.', 'success');
    } catch (err) {
      console.error('Error restoring order:', err);
      showToast('Failed to restore order.', 'error');
    }
  };

  // Status Change: Delete
  const handleDeleteOrder = async () => {
    if (!deleteTargetOrder) return;
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deleteTargetOrder.id);

      if (error) throw error;
      showToast('Order deleted permanently.', 'success');
      setDeleteTargetOrder(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      showToast('Failed to delete order.', 'error');
    }
  };

  // Open Fulfilment Dialog
  const handleOpenFulfil = (order: Order) => {
    setSelectedOrder(order);
    setPaymentMode('UPI');
    setPaymentAmount(order.total.toString());
    setPaymentReference('');
    setPaymentNotes('');
  };

  // Submit Fulfilment
  const handleFulfilSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!paymentAmount || parseFloat(paymentAmount) < 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'fulfilled',
          payment_mode: paymentMode,
          payment_amount: parseFloat(paymentAmount),
          payment_reference: paymentReference.trim() || null,
          payment_notes: paymentNotes.trim() || null,
          payment_recorded_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      showToast('Order fulfilled and paid successfully!', 'success');
      setSelectedOrder(null);
    } catch (err) {
      console.error('Error fulfilling order:', err);
      showToast('Fulfillment failed. Please check connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Date
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Lifecycle Navigation tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({orders.filter((o) => o.status === 'pending').length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'fulfilled' ? 'active' : ''}`}
          onClick={() => setActiveTab('fulfilled')}
        >
          Fulfilled ({orders.filter((o) => o.status === 'fulfilled').length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'failed' ? 'active' : ''}`}
          onClick={() => setActiveTab('failed')}
        >
          Failed ({orders.filter((o) => o.status === 'failed').length})
        </button>
      </div>

      <div className="admin-filter-bar">
        <div className="admin-search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search order, customer, phone, product, payment reference..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <label className="admin-date-filter">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="admin-date-filter">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {(searchTerm || dateFrom || dateTo) && (
          <button type="button" className="btn btn-outline" onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}>Clear</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔄 Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No orders listed under {activeTab.toUpperCase()}.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order Reference</th>
                <th>Order Date</th>
                <th>Customer Details</th>
                <th>Items Ordered</th>
                <th>Payment Status</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                    {order.order_number || order.id.slice(0, 8).toUpperCase()}
                  </td>
                  
                  {/* Order Date */}
                  <td>{formatDateTime(order.created_at)}</td>
                  
                  {/* Customer details */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 700 }}>{order.customer_name}</span>
                      <a href={`tel:${order.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                        <Phone size={12} />
                        <span>{order.phone}</span>
                      </a>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {order.address} {order.pin_code && `(PIN: ${order.pin_code})`}
                      </span>
                    </div>
                  </td>
                  
                  {/* Items list */}
                  <td>
                    <div className="order-items-list">
                      {order.items.map((item, i) => (
                        <div key={i} className="order-item-row" style={{ gap: '1rem' }}>
                          <span>{item.name} × {item.quantity} {item.unit}</span>
                          <span style={{ color: 'var(--text-muted)' }}>@ ₹{item.price}/unit</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  
                  {/* Delivery date & instructions */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} />
                        <strong>Delivery:</strong>{' '}
                        {order.preferred_delivery_date ? (
                          order.preferred_delivery_date
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>ASAP</span>
                        )}
                      </span>
                      {order.special_instructions && (
                        <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                          " {order.special_instructions} "
                        </span>
                      )}
                      {order.status === 'fulfilled' && (
                        <div style={{ marginTop: '0.4rem', padding: '0.25rem', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--success)' }}>
                          <strong>{order.payment_mode}</strong>: ₹{order.payment_amount}
                          {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* Total */}
                  <td style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1.05rem' }}>
                    ₹{order.total}
                  </td>
                  
                  {/* Contextual actions */}
                  <td>
                    <div className="admin-table-actions">
                      {order.status === 'pending' && (
                        <>
                          <button
                            className="order-action-icon accept"
                            onClick={() => handleOpenFulfil(order)}
                            title="Accept order and record payment"
                            aria-label={`Accept order ${order.order_number || order.id}`}
                          >
                            <Check size={18} />
                          </button>
                          <button
                            className="order-action-icon reject"
                            onClick={() => handleMarkFailed(order.id)}
                            title="Reject order"
                            aria-label={`Reject order ${order.order_number || order.id}`}
                          >
                            <X size={18} />
                          </button>
                        </>
                      )}

                      {order.status === 'fulfilled' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                          ✓ Fulfilled
                        </span>
                      )}

                      {order.status === 'failed' && (
                        <>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}
                            onClick={() => handleRestore(order.id)}
                            title="Restore to Pending"
                          >
                            <RotateCcw size={14} />
                            <span>Restore</span>
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}
                            onClick={() => setDeleteTargetOrder(order)}
                            title="Delete Permanently"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fulfillment payment modal */}
      {selectedOrder && (
        <div className="modal-backdrop open" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fulfill Order & Record Payment</h3>
              <button className="btn-icon" onClick={() => setSelectedOrder(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFulfilSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <strong>Customer:</strong> {selectedOrder.customer_name} <br />
                  <strong>Order Total:</strong> ₹{selectedOrder.total}
                </div>

                <div className="form-group">
                  <label htmlFor="paymentMode">Payment Mode *</label>
                  <select
                    id="paymentMode"
                    className="form-control"
                    value={paymentMode}
                    onChange={(event) => setPaymentMode(event.target.value as typeof paymentMode)}
                    required
                  >
                    <option value="UPI">UPI / Transfer</option>
                    <option value="Cash on delivery">Cash on delivery (COD)</option>
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Card">Card payment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="paymentNotes">Payment Notes</label>
                  <textarea
                    id="paymentNotes"
                    className="form-control"
                    placeholder="Optional reconciliation or collection notes"
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="paymentAmount">Payment Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="paymentAmount"
                    className="form-control"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="paymentRef">Reference / UTR / Receipt No.</label>
                  <input
                    type="text"
                    id="paymentRef"
                    className="form-control"
                    placeholder="e.g. UTR1234567890"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Confirm Fulfillment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetOrder && (
        <div className="modal-backdrop open" onClick={() => setDeleteTargetOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <ShieldAlert size={20} />
                <span>Delete Order?</span>
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
              Are you sure you want to permanently delete order from <strong>{deleteTargetOrder.customer_name}</strong>? This action is irreversible.
            </div>
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTargetOrder(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteOrder}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
