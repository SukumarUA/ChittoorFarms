import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Check, Download, FileText, Phone, RotateCcw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
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

const escapeCsv = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const escapeHtml = (value: string | number | null | undefined) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getLocalDateValue = (dateStr: string) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    void Promise.resolve().then(fetchOrders);

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
      .subscribe((_status, err) => {
        if (err) {
          console.error('Orders real-time subscription error:', err);
        }
      });

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
    const orderDate = getLocalDateValue(order.created_at);
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
      setOrders((current) => current.map((order) => (
        order.id === id ? { ...order, status: 'failed' } : order
      )));
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
      setOrders((current) => current.map((order) => (
        order.id === id
          ? {
              ...order,
              status: 'pending',
              payment_mode: null,
              payment_amount: null,
              payment_reference: null,
              payment_notes: null,
              payment_recorded_at: null,
            }
          : order
      )));
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
      setOrders((current) => current.filter((order) => order.id !== deleteTargetOrder.id));
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

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast('Please enter a valid payment amount greater than ₹0.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentRecordedAt = new Date().toISOString();
      const paidAmount = parseFloat(paymentAmount);
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'fulfilled',
          payment_mode: paymentMode,
          payment_amount: paidAmount,
          payment_reference: paymentReference.trim() || null,
          payment_notes: paymentNotes.trim() || null,
          payment_recorded_at: paymentRecordedAt,
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setOrders((current) => current.map((order) => (
        order.id === selectedOrder.id
          ? {
              ...order,
              status: 'fulfilled',
              payment_mode: paymentMode,
              payment_amount: paidAmount,
              payment_reference: paymentReference.trim() || null,
              payment_notes: paymentNotes.trim() || null,
              payment_recorded_at: paymentRecordedAt,
            }
          : order
      )));
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

  const exportCsv = () => {
    const generatedAt = new Date();
    const logoUrl = `${window.location.origin}/CTRFLOGO.jpeg`;
    const rows = [
      ['Chittoor Farms Orders Report'],
      ['Logo', logoUrl],
      ['Order Status', activeTab.toUpperCase()],
      ['Generated At', generatedAt.toLocaleString('en-IN')],
      [],
      ['Order Reference', 'Order Date', 'Status', 'Customer', 'Phone', 'Address', 'PIN Code', 'Delivery Date', 'Items', 'Total', 'Payment Mode', 'Paid Amount', 'Payment Reference', 'Instructions'],
      ...filteredOrders.map((order) => [
        order.order_number || order.id.slice(0, 8).toUpperCase(),
        new Date(order.created_at).toLocaleString('en-IN'),
        order.status,
        order.customer_name,
        order.phone,
        order.address,
        order.pin_code || '',
        order.preferred_delivery_date || 'ASAP',
        order.items.map((item) => `${item.name}: ${item.quantity}${item.unit} x Rs.${item.price}`).join('; '),
        order.total,
        order.payment_mode || '',
        order.payment_amount ?? '',
        order.payment_reference || '',
        order.special_instructions || '',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `chittoor-farms-orders-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const logoUrl = `${window.location.origin}/CTRFLOGO.jpeg`;

    const rows = filteredOrders.map((order) => `
      <tr>
        <td>${escapeHtml(order.order_number || order.id.slice(0, 8).toUpperCase())}</td>
        <td>${escapeHtml(formatDateTime(order.created_at))}</td>
        <td><strong>${escapeHtml(order.customer_name)}</strong><br>${escapeHtml(order.phone)}<br>${escapeHtml(order.address)} ${order.pin_code ? `- ${escapeHtml(order.pin_code)}` : ''}</td>
        <td>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}${escapeHtml(item.unit.replace(/^1\s*/, ''))}`).join('<br>')}</td>
        <td>${escapeHtml(order.preferred_delivery_date || 'ASAP')}</td>
        <td>Rs.${escapeHtml(order.total)}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><title>Chittoor Farms Orders</title><style>
      body{font-family:Arial,sans-serif;color:#1f2937;padding:24px}.watermark{position:fixed;top:52%;left:50%;width:420px;max-width:52vw;transform:translate(-50%,-50%);opacity:.14;mix-blend-mode:multiply;z-index:2;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-content{position:relative;z-index:1}h1{color:#17633f;margin-bottom:4px}p{color:#64748b;margin-top:0}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px;background:rgba(255,255,255,.45)}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top;background:transparent}th{background:#17633f;color:white}.summary{display:flex;gap:24px;margin-top:14px;font-weight:bold}@page{size:landscape;margin:12mm}
    </style></head><body><img class="watermark" src="${escapeHtml(logoUrl)}" alt=""><main class="report-content"><h1>Chittoor Farms Orders</h1><p>${escapeHtml(activeTab.toUpperCase())} orders report generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</p><div class="summary"><span>Records: ${filteredOrders.length}</span><span>Total value: Rs.${filteredOrders.reduce((sum, order) => sum + Number(order.total), 0).toLocaleString('en-IN')}</span></div><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></main><script>window.onload=()=>{window.print();window.onafterprint=()=>{URL.revokeObjectURL(window.location.href);};};</script></body></html>`;

    // Use a Blob URL instead of document.write — avoids the deprecated API and
    // works reliably across modern browsers including mobile.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const reportWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
      URL.revokeObjectURL(blobUrl);
      showToast('Please allow pop-ups to generate the PDF report.', 'warning');
      return;
    }
    // Clean up blob URL after the window has had time to load
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  };

  return (
    <div>
      <div className="orders-header-row">
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
        <div className="orders-export-actions">
          <button type="button" className="btn btn-outline" onClick={exportPdf} disabled={!filteredOrders.length}><FileText size={16} /> Export PDF</button>
          <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!filteredOrders.length}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="orders-toolbar">
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
      </div>

      {(dateFrom || dateTo) && (
        <p className="orders-filter-summary">
          Showing {filteredOrders.length} {activeTab} order{filteredOrders.length === 1 ? '' : 's'}
          {dateFrom ? ` from ${dateFrom}` : ''}{dateTo ? ` through ${dateTo}` : ''}. PDF and CSV exports will contain only these records.
        </p>
      )}

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
                          <span>{item.name} × {item.quantity}{item.unit.replace(/^1\s*/, '')}</span>
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
