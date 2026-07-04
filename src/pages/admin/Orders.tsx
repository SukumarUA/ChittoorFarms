import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, Check, ChevronDown, ChevronRight as ChevronRightIcon, Download, FileText, Package, Phone, Printer, RotateCcw, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { esc, logoRow, footer, wrapHtml, openPrint } from '../../lib/printUtils';

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

interface ProductSummary {
  key: string;
  product_id: string;
  name: string;
  unit: string;
  pendingQty: number;
  fulfilledQty: number;
  failedQty: number;
  totalQty: number;
  orderCount: number;
  orders: Array<{ order: Order; quantity: number }>;
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--warning)',
  fulfilled: 'var(--success)',
  failed: 'var(--danger)',
};

export const Orders: React.FC = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'by-order' | 'by-product'>('by-order');
  const [activeTab, setActiveTab] = useState<'pending' | 'fulfilled' | 'failed'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

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

  // Shared search/date filter (no status constraint) — used by both views
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const baseFilteredOrders = useMemo(() => orders.filter((order) => {
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
  }), [orders, normalizedSearch, dateFrom, dateTo]);

  // "By Order" view: add status tab filter
  const filteredOrders = useMemo(
    () => baseFilteredOrders.filter((order) => order.status === activeTab),
    [baseFilteredOrders, activeTab],
  );

  // "By Product" view: aggregate across all statuses
  const productSummaries = useMemo((): ProductSummary[] => {
    const map = new Map<string, ProductSummary>();

    baseFilteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.product_id || item.name;
        if (!map.has(key)) {
          map.set(key, {
            key,
            product_id: item.product_id,
            name: item.name,
            unit: item.unit,
            pendingQty: 0,
            fulfilledQty: 0,
            failedQty: 0,
            totalQty: 0,
            orderCount: 0,
            orders: [],
          });
        }
        const entry = map.get(key)!;
        entry.totalQty += item.quantity;
        entry.orderCount += 1;
        if (order.status === 'pending') entry.pendingQty += item.quantity;
        else if (order.status === 'fulfilled') entry.fulfilledQty += item.quantity;
        else entry.failedQty += item.quantity;
        entry.orders.push({ order, quantity: item.quantity });
      });
    });

    // Sort by pending qty descending (most pressing inventory need first)
    return Array.from(map.values()).sort((a, b) => b.pendingQty - a.pendingQty);
  }, [baseFilteredOrders]);

  const toggleProductExpand = (key: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
        order.items.map((item) => `${item.name}: ${item.quantity}${item.unit.replace(/^1\s*/, '')} x Rs.${item.price}`).join('; ') + `; Total: ${order.items.reduce((sum, item) => sum + item.quantity, 0)}kg`,
        order.total,
        order.payment_mode || '',
        order.payment_amount ?? '',
        order.payment_reference || '',
        order.special_instructions || '',
      ]),
    ];
    const csv = `﻿${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
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
        <td>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}${escapeHtml(item.unit.replace(/^1\s*/, ''))}`).join('<br>')}<br><strong>Total: ${order.items.reduce((sum, item) => sum + item.quantity, 0)}kg</strong></td>
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

  // ── Print: Delivery Challan ──────────────────────────────────────────────
  const printChallan = (order: Order) => {
    const ref = order.order_number || order.id.slice(0, 8).toUpperCase();
    const body = `
      ${logoRow('Delivery Challan', `Order: ${ref}`)}
      <div class="info-grid">
        <div class="info-box">
          <div class="lbl">Deliver To</div>
          <div class="val">${esc(order.customer_name)}</div>
          <div class="sub">${esc(order.address)}${order.pin_code ? ` — PIN ${esc(order.pin_code)}` : ''}</div>
          <div class="sub" style="margin-top:4px">📞 ${esc(order.phone)}</div>
        </div>
        <div class="info-box">
          <div class="lbl">Order Details</div>
          <div class="val">${esc(ref)}</div>
          <div class="sub">Placed: ${esc(formatDateTime(order.created_at))}</div>
          <div class="sub">Delivery: <strong>${esc(order.preferred_delivery_date || 'ASAP')}</strong></div>
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>
          ${order.items.map((item, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(item.name)}</td>
              <td><strong>${item.quantity} ${esc(item.unit.replace(/^1\s*/, ''))}</strong></td>
              <td>₹${esc(item.price)}</td>
              <td>₹${(item.quantity * item.price).toFixed(2)}</td>
            </tr>`).join('')}
          <tr class="total-row"><td colspan="4" style="text-align:right">Total</td><td>₹${esc(order.total)}</td></tr>
        </tbody>
      </table>
      ${order.special_instructions ? `<p style="margin-top:10px;font-size:0.82rem;color:#374151"><em>Instructions: ${esc(order.special_instructions)}</em></p>` : ''}
      <div class="sig-block">
        <div class="sig-line"><div class="line"></div><div class="label">Delivered by (Name & Sign)</div></div>
        <div class="sig-line"><div class="line"></div><div class="label">Received by (Customer Sign)</div></div>
        <div class="sig-line"><div class="line"></div><div class="label">Date of Delivery</div></div>
      </div>
      ${footer()}`;
    openPrint(wrapHtml(`Challan – ${ref}`, body));
  };

  // ── Print: Customer Receipt ───────────────────────────────────────────────
  const printReceipt = (order: Order) => {
    const ref = order.order_number || order.id.slice(0, 8).toUpperCase();
    const body = `
      ${logoRow('Payment Receipt', ref)}
      <div class="info-grid">
        <div class="info-box">
          <div class="lbl">Customer</div>
          <div class="val">${esc(order.customer_name)}</div>
          <div class="sub">${esc(order.phone)}</div>
          <div class="sub">${esc(order.address)}</div>
        </div>
        <div class="info-box">
          <div class="lbl">Payment Details</div>
          <div class="val">₹${esc(order.payment_amount ?? order.total)}</div>
          <div class="sub">Mode: ${esc(order.payment_mode || '—')}</div>
          ${order.payment_reference ? `<div class="sub">Ref: ${esc(order.payment_reference)}</div>` : ''}
          <div class="sub">Date: ${esc(order.payment_recorded_at ? formatDateTime(order.payment_recorded_at) : formatDateTime(order.created_at))}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>
          ${order.items.map((item) => `
            <tr>
              <td>${esc(item.name)}</td>
              <td>${item.quantity} ${esc(item.unit.replace(/^1\s*/, ''))}</td>
              <td>₹${esc(item.price)}</td>
              <td>₹${(item.quantity * item.price).toFixed(2)}</td>
            </tr>`).join('')}
          <tr class="total-row"><td colspan="3" style="text-align:right">Total Paid</td><td>₹${esc(order.payment_amount ?? order.total)}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:14px;color:#15803d;font-weight:600">✓ Payment Received. Thank you for your order!</p>
      ${footer()}`;
    openPrint(wrapHtml(`Receipt – ${ref}`, body));
  };

  // ── Print: Daily Dispatch Sheet ───────────────────────────────────────────
  const printDispatchSheet = () => {
    const pending = baseFilteredOrders.filter((o) => o.status === 'pending');
    if (!pending.length) return;
    const dateLabel = dateFrom === dateTo && dateFrom ? dateFrom : (dateFrom || dateTo ? `${dateFrom || ''}–${dateTo || ''}` : new Date().toLocaleDateString('en-IN'));
    const rows = pending.map((order, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(order.order_number || order.id.slice(0, 8).toUpperCase())}</strong></td>
        <td><strong>${esc(order.customer_name)}</strong><br><span style="font-size:0.78rem;color:#6b7280">${esc(order.phone)}</span></td>
        <td style="font-size:0.8rem">${esc(order.address)}${order.pin_code ? ` (${esc(order.pin_code)})` : ''}</td>
        <td>${order.items.map((it) => `${esc(it.name)} × ${it.quantity}${esc(it.unit.replace(/^1\s*/, ''))}`).join('<br>')}</td>
        <td><strong>${esc(order.preferred_delivery_date || 'ASAP')}</strong></td>
        <td style="font-weight:700">₹${esc(order.total)}</td>
        <td style="width:60px"></td>
      </tr>`).join('');
    const body = `
      ${logoRow('Dispatch Sheet', dateLabel)}
      <p style="margin-bottom:10px;color:#374151">Pending deliveries: <strong>${pending.length}</strong> &nbsp;|&nbsp; Total value: <strong>₹${pending.reduce((s, o) => s + Number(o.total), 0).toLocaleString('en-IN')}</strong></p>
      <table>
        <thead><tr><th>#</th><th>Order</th><th>Customer</th><th>Address</th><th>Items</th><th>Delivery</th><th>Total</th><th>✓ Done</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${footer()}`;
    openPrint(wrapHtml('Dispatch Sheet', body));
  };

  return (
    <div>
      {/* View Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${viewMode === 'by-order' ? 'active' : ''}`}
          onClick={() => setViewMode('by-order')}
        >
          By Order
        </button>
        <button
          className={`tab-btn ${viewMode === 'by-product' ? 'active' : ''}`}
          onClick={() => setViewMode('by-product')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Package size={15} />
          By Product
        </button>
      </div>

      {viewMode === 'by-order' ? (
        <>
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
              <button type="button" className="btn btn-outline" onClick={printDispatchSheet} disabled={!baseFilteredOrders.filter((o) => o.status === 'pending').length} title="Print dispatch sheet for all pending orders"><Printer size={16} /> Dispatch Sheet</button>
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
                          <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.4rem', paddingTop: '0.3rem', fontWeight: 600, fontSize: '0.85rem' }}>
                            Total: {order.items.reduce((sum, item) => sum + item.quantity, 0)}kg
                          </div>
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
                              <button
                                className="btn-icon"
                                onClick={() => printChallan(order)}
                                title="Print Delivery Challan"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Printer size={16} />
                              </button>
                            </>
                          )}

                          {order.status === 'fulfilled' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ Fulfilled</span>
                              <button
                                className="btn-icon"
                                onClick={() => printReceipt(order)}
                                title="Print Customer Receipt"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Printer size={15} />
                              </button>
                            </div>
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
        </>
      ) : (
        /* ─── By Product View ─── */
        <>
          {/* Search/date filter row (reused) */}
          <div className="orders-toolbar">
            <div className="admin-filter-bar">
              <div className="admin-search-field">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Search product name, customer, order..."
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

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.75rem 0 1rem 0', fontSize: '0.85rem' }}>
            <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: 'var(--warning)', borderRadius: '999px', fontWeight: 600 }}>
              Pending: {productSummaries.reduce((s, p) => s + p.pendingQty, 0)} units across {productSummaries.filter((p) => p.pendingQty > 0).length} products
            </span>
            <span style={{ padding: '0.25rem 0.75rem', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '999px', fontWeight: 600 }}>
              Fulfilled: {productSummaries.reduce((s, p) => s + p.fulfilledQty, 0)} units
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              🔄 Loading orders...
            </div>
          ) : productSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No orders match the current filters.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '2rem' }}></th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right', color: 'var(--warning)' }}>Pending</th>
                    <th style={{ textAlign: 'right', color: 'var(--success)' }}>Fulfilled</th>
                    <th style={{ textAlign: 'right', color: 'var(--danger)' }}>Failed</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {productSummaries.map((product) => {
                    const isExpanded = expandedProducts.has(product.key);
                    return (
                      <React.Fragment key={product.key}>
                        {/* Product summary row */}
                        <tr
                          onClick={() => toggleProductExpand(product.key)}
                          style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-muted)' : undefined }}
                        >
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Package size={15} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 700 }}>{product.name}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{product.unit}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: product.pendingQty > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {product.pendingQty > 0 ? `${product.pendingQty} ${product.unit.replace(/^1\s*/, '')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: product.fulfilledQty > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                            {product.fulfilledQty > 0 ? `${product.fulfilledQty} ${product.unit.replace(/^1\s*/, '')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: product.failedQty > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {product.failedQty > 0 ? `${product.failedQty} ${product.unit.replace(/^1\s*/, '')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--secondary)' }}>
                            {product.totalQty} {product.unit.replace(/^1\s*/, '')}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {product.orderCount}
                          </td>
                        </tr>

                        {/* Expanded order sub-rows */}
                        {isExpanded && product.orders.map(({ order, quantity }, idx) => (
                          <tr
                            key={`${product.key}-${order.id}-${idx}`}
                            style={{
                              background: 'var(--bg-card)',
                              borderLeft: `3px solid ${STATUS_COLORS[order.status] || 'var(--border)'}`,
                            }}
                          >
                            <td></td>
                            <td colSpan={2}>
                              <div style={{ paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>
                                  {order.order_number || order.id.slice(0, 8).toUpperCase()}
                                </span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                  {formatDate(order.created_at)}
                                </span>
                              </div>
                            </td>
                            <td colSpan={2}>
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                                <a href={`tel:${order.phone}`} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <Phone size={11} /> {order.phone}
                                </a>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {quantity} {product.unit.replace(/^1\s*/, '')}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                background: order.status === 'pending' ? '#fef3c7' : order.status === 'fulfilled' ? 'var(--success-light)' : '#fee2e2',
                                color: STATUS_COLORS[order.status],
                              }}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
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
