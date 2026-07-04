import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, Check, ChevronDown, ChevronRight as ChevronRightIcon, Download, FileText, MessageSquare, Package, Phone, Printer, RotateCcw, Search, ShieldAlert, Tag, Trash2, X } from 'lucide-react';
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
  // Referral / promo fields
  referral_code: string | null;
  promo_code: string | null;
  discount_pct: number | null;
  discount_amount: number | null;
  original_total: number | null;
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

interface ReferralSummary {
  code: string;
  type: 'referral' | 'promo' | 'both';
  orderCount: number;
  originalTotal: number;
  discountTotal: number;
  netTotal: number;
  orders: Order[];
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

// Color-coded age badge for pending order rows
const ageBadge = (createdAt: string): { label: string; color: string; bg: string } => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (h >= 6) return { label, color: '#dc2626', bg: '#fee2e2' };
  if (h >= 2) return { label, color: '#92400e', bg: '#fef3c7' };
  return { label, color: '#166534', bg: '#dcfce7' };
};

// Pre-filled WhatsApp message for a pending order
const waMessage = (order: Order) => {
  const ref = order.order_number || order.id.slice(0, 8).toUpperCase();
  const itemLines = order.items.map((it) => `• ${it.name} × ${it.quantity}${it.unit.replace(/^1\s*/, '')}`).join('\n');
  const delivery = order.preferred_delivery_date || 'ASAP';
  return `Hello ${order.customer_name}! 🌿\n\nYour Chittoor Farms order *${ref}* is confirmed.\n\nItems:\n${itemLines}\n\nTotal: ₹${order.total}\nDelivery: ${delivery}\n\nThank you for supporting local farms! 🍃`;
};

export const Orders: React.FC = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'by-order' | 'by-product' | 'by-referral'>('by-order');
  const [activeTab, setActiveTab] = useState<'pending' | 'fulfilled' | 'failed'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedReferrals, setExpandedReferrals] = useState<Set<string>>(new Set());

  // Modal states for fulfillment
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Cash on delivery' | 'Bank transfer' | 'Card'>('UPI');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states for deletion
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);

  // Tick every 60s so aging badges stay fresh without reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

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

    const subscription = supabase
      .channel('orders-db-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => { fetchOrders(); }
      )
      .subscribe((_status, err) => {
        if (err) console.error('Orders real-time subscription error:', err);
      });

    return () => { subscription.unsubscribe(); };
  }, [fetchOrders]);

  // Shared search/date filter — includes referral/promo code search
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const baseFilteredOrders = useMemo(() => orders.filter((order) => {
    const searchable = [
      order.order_number,
      order.id,
      order.customer_name,
      order.phone,
      order.address,
      order.payment_reference,
      order.referral_code,
      order.promo_code,
      ...order.items.map((item) => item.name),
    ].filter(Boolean).join(' ').toLowerCase();
    const orderDate = getLocalDateValue(order.created_at);
    return (!normalizedSearch || searchable.includes(normalizedSearch))
      && (!dateFrom || orderDate >= dateFrom)
      && (!dateTo || orderDate <= dateTo);
  }), [orders, normalizedSearch, dateFrom, dateTo]);

  // "By Order" view: status tab filter + sort pending oldest-first (most urgent at top)
  const filteredOrders = useMemo(() => {
    const list = baseFilteredOrders.filter((order) => order.status === activeTab);
    if (activeTab === 'pending') {
      return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return list;
  }, [baseFilteredOrders, activeTab]);

  // "By Product" view: aggregate across all statuses
  const productSummaries = useMemo((): ProductSummary[] => {
    const map = new Map<string, ProductSummary>();
    baseFilteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.product_id || item.name;
        if (!map.has(key)) {
          map.set(key, { key, product_id: item.product_id, name: item.name, unit: item.unit, pendingQty: 0, fulfilledQty: 0, failedQty: 0, totalQty: 0, orderCount: 0, orders: [] });
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
    return Array.from(map.values()).sort((a, b) => b.pendingQty - a.pendingQty);
  }, [baseFilteredOrders]);

  // "By Referral" view: aggregate by referral/promo code
  const referralSummaries = useMemo((): ReferralSummary[] => {
    const map = new Map<string, ReferralSummary>();
    const promoOrders = baseFilteredOrders.filter((o) => o.referral_code || o.promo_code);

    promoOrders.forEach((order) => {
      const code = (order.referral_code || order.promo_code || '').toUpperCase();
      const hasRef = !!order.referral_code;
      const hasPromo = !!order.promo_code;
      const type: ReferralSummary['type'] = hasRef && hasPromo ? 'both' : hasRef ? 'referral' : 'promo';

      if (!map.has(code)) {
        map.set(code, { code, type, orderCount: 0, originalTotal: 0, discountTotal: 0, netTotal: 0, orders: [] });
      }
      const entry = map.get(code)!;
      entry.orderCount += 1;
      entry.originalTotal += Number(order.original_total ?? order.total);
      entry.discountTotal += Number(order.discount_amount ?? 0);
      entry.netTotal += Number(order.total);
      entry.orders.push(order);
    });

    return Array.from(map.values()).sort((a, b) => b.discountTotal - a.discountTotal);
  }, [baseFilteredOrders]);

  const toggleProductExpand = (key: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleReferralExpand = (code: string) => {
    setExpandedReferrals((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  // Status Change: Fail
  const handleMarkFailed = async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'failed' }).eq('id', id);
      if (error) throw error;
      setOrders((current) => current.map((order) => order.id === id ? { ...order, status: 'failed' } : order));
      showToast('Order marked as Failed.', 'warning');
    } catch (err) {
      console.error('Error failing order:', err);
      showToast('Failed to update status.', 'error');
    }
  };

  // Status Change: Restore to Pending
  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase.from('orders').update({
        status: 'pending', payment_mode: null, payment_amount: null,
        payment_reference: null, payment_notes: null, payment_recorded_at: null,
      }).eq('id', id);
      if (error) throw error;
      setOrders((current) => current.map((order) =>
        order.id === id ? { ...order, status: 'pending', payment_mode: null, payment_amount: null, payment_reference: null, payment_notes: null, payment_recorded_at: null } : order
      ));
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
      const { error } = await supabase.from('orders').delete().eq('id', deleteTargetOrder.id);
      if (error) throw error;
      setOrders((current) => current.filter((order) => order.id !== deleteTargetOrder.id));
      showToast('Order deleted permanently.', 'success');
      setDeleteTargetOrder(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      showToast('Failed to delete order.', 'error');
    }
  };

  const handleOpenFulfil = (order: Order) => {
    setSelectedOrder(order);
    setPaymentMode('UPI');
    setPaymentAmount(order.total.toString());
    setPaymentReference('');
    setPaymentNotes('');
  };

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
      const { error } = await supabase.from('orders').update({
        status: 'fulfilled', payment_mode: paymentMode, payment_amount: paidAmount,
        payment_reference: paymentReference.trim() || null,
        payment_notes: paymentNotes.trim() || null,
        payment_recorded_at: paymentRecordedAt,
      }).eq('id', selectedOrder.id);
      if (error) throw error;
      setOrders((current) => current.map((order) =>
        order.id === selectedOrder.id ? { ...order, status: 'fulfilled', payment_mode: paymentMode, payment_amount: paidAmount, payment_reference: paymentReference.trim() || null, payment_notes: paymentNotes.trim() || null, payment_recorded_at: paymentRecordedAt } : order
      ));
      showToast('Order fulfilled and paid successfully!', 'success');
      setSelectedOrder(null);
    } catch (err) {
      console.error('Error fulfilling order:', err);
      showToast('Fulfillment failed. Please check connection.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const exportCsv = () => {
    const generatedAt = new Date();
    const rows = [
      ['Chittoor Farms Orders Report'],
      ['Order Status', activeTab.toUpperCase()],
      ['Generated At', generatedAt.toLocaleString('en-IN')],
      [],
      ['Order Reference', 'Order Date', 'Status', 'Customer', 'Phone', 'Address', 'PIN Code', 'Delivery Date', 'Items', 'Original Total', 'Discount', 'Net Total', 'Referral Code', 'Promo Code', 'Payment Mode', 'Paid Amount', 'Payment Reference', 'Instructions'],
      ...filteredOrders.map((order) => [
        order.order_number || order.id.slice(0, 8).toUpperCase(),
        new Date(order.created_at).toLocaleString('en-IN'),
        order.status,
        order.customer_name,
        order.phone,
        order.address,
        order.pin_code || '',
        order.preferred_delivery_date || 'ASAP',
        order.items.map((item) => `${item.name}: ${item.quantity}${item.unit.replace(/^1\s*/, '')} x Rs.${item.price}`).join('; '),
        order.original_total ?? order.total,
        order.discount_amount ?? 0,
        order.total,
        order.referral_code || '',
        order.promo_code || '',
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
        <td>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}${escapeHtml(item.unit.replace(/^1\s*/, ''))}`).join('<br>')}
            <br><strong>Total: ${order.items.reduce((sum, item) => sum + item.quantity, 0)}kg</strong></td>
        <td>${escapeHtml(order.preferred_delivery_date || 'ASAP')}</td>
        <td>
          ${order.discount_amount ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:0.85em">Rs.${escapeHtml(order.original_total ?? order.total)}</span><br>` : ''}
          <strong>Rs.${escapeHtml(order.total)}</strong>
          ${order.referral_code || order.promo_code ? `<br><span style="font-size:0.8em;color:#15803d">🏷 ${escapeHtml(order.referral_code || order.promo_code)}</span>` : ''}
        </td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><title>Chittoor Farms Orders</title><style>
      body{font-family:Arial,sans-serif;color:#1f2937;padding:24px}
      .wm{position:fixed;top:50%;left:50%;width:300px;transform:translate(-50%,-50%);opacity:.07;z-index:0;pointer-events:none}
      .wm img{width:100%;object-fit:contain}
      .rc{position:relative;z-index:1}
      h1{color:#17633f;margin-bottom:4px}p{color:#64748b;margin-top:0}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}
      th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#17633f;color:#fff}
      .summary{display:flex;gap:24px;margin-top:12px;font-weight:bold;font-size:12px}
      @page{size:landscape;margin:10mm 12mm}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="wm"><img src="${escapeHtml(logoUrl)}" alt=""/></div>
    <main class="rc">
      <h1>Chittoor Farms Orders</h1>
      <p>${escapeHtml(activeTab.toUpperCase())} orders · Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</p>
      <div class="summary">
        <span>Records: ${filteredOrders.length}</span>
        <span>Total value: Rs.${filteredOrders.reduce((sum, o) => sum + Number(o.total), 0).toLocaleString('en-IN')}</span>
      </div>
      <table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </main>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>{URL.revokeObjectURL(window.location.href);};};<\/script>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!win) { URL.revokeObjectURL(blobUrl); showToast('Please allow pop-ups.', 'warning'); return; }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  };

  // ── Print: Delivery Challan ───────────────────────────────────────────────
  const printChallan = (order: Order) => {
    const ref = order.order_number || order.id.slice(0, 8).toUpperCase();
    const hasDiscount = order.discount_amount && Number(order.discount_amount) > 0;
    const codeLabel = order.referral_code || order.promo_code || '';
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
          ${codeLabel ? `<div class="sub" style="margin-top:4px;color:#15803d;font-weight:600">🏷 Code: ${esc(codeLabel)}</div>` : ''}
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
          ${hasDiscount ? `
            <tr>
              <td colspan="4" style="text-align:right;color:#6b7280">Subtotal</td>
              <td>₹${esc(order.original_total ?? order.total)}</td>
            </tr>
            <tr>
              <td colspan="4" style="text-align:right;color:#991b1b">Discount (${esc(codeLabel)}, ${esc(order.discount_pct ?? '')}%)</td>
              <td style="color:#991b1b">−₹${esc(Number(order.discount_amount).toFixed(2))}</td>
            </tr>` : ''}
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
    const hasDiscount = order.discount_amount && Number(order.discount_amount) > 0;
    const codeLabel = order.referral_code || order.promo_code || '';
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
          ${codeLabel ? `<div class="sub" style="margin-top:4px;color:#15803d;font-weight:600">🏷 ${esc(codeLabel)} (${esc(order.discount_pct ?? '')}% off applied)</div>` : ''}
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
          ${hasDiscount ? `
            <tr>
              <td colspan="3" style="text-align:right;color:#6b7280">Subtotal</td>
              <td>₹${esc(order.original_total ?? order.total)}</td>
            </tr>
            <tr>
              <td colspan="3" style="text-align:right;color:#991b1b">Discount (${esc(codeLabel)}, ${esc(order.discount_pct ?? '')}%)</td>
              <td style="color:#991b1b">−₹${esc(Number(order.discount_amount).toFixed(2))}</td>
            </tr>` : ''}
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

  // ── Print: Referral Usage Report ──────────────────────────────────────────
  const printReferralReport = () => {
    if (!referralSummaries.length) return;
    const totalDiscount = referralSummaries.reduce((s, r) => s + r.discountTotal, 0);
    const totalOrders = referralSummaries.reduce((s, r) => s + r.orderCount, 0);
    const totalNet = referralSummaries.reduce((s, r) => s + r.netTotal, 0);

    const rows = referralSummaries.map((r) => `
      <tr>
        <td><strong style="font-size:1rem;letter-spacing:.06em;color:#17633f">${esc(r.code)}</strong></td>
        <td><span style="padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${r.type === 'referral' ? '#dcfce7' : '#fef3c7'};color:${r.type === 'referral' ? '#166534' : '#92400e'}">${r.type === 'referral' ? 'Referral' : r.type === 'promo' ? 'Promo' : 'Both'}</span></td>
        <td style="text-align:right">${r.orderCount}</td>
        <td style="text-align:right">₹${r.originalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;color:#991b1b;font-weight:600">−₹${r.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;font-weight:700;color:#15803d">₹${r.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>`).join('');

    const body = `
      ${logoRow('Referral & Promo Report', new Date().toLocaleDateString('en-IN'))}
      <div class="info-grid" style="margin-bottom:12px">
        <div class="info-box">
          <div class="lbl">Total Codes Used</div>
          <div class="val">${referralSummaries.length} codes across ${totalOrders} orders</div>
        </div>
        <div class="info-box">
          <div class="lbl">Discount Given</div>
          <div class="val" style="color:#991b1b">−₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div class="sub">Net revenue from promo orders: ₹${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Type</th><th style="text-align:right">Orders</th><th style="text-align:right">Orig. Value</th><th style="text-align:right">Discount</th><th style="text-align:right">Net Revenue</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h2 style="margin-top:18px">Order Detail by Code</h2>
      ${referralSummaries.map((r) => `
        <p style="margin:10px 0 4px;font-weight:700;color:#17633f;font-size:0.9rem">🏷 ${esc(r.code)}</p>
        <table style="margin-bottom:12px">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Status</th><th style="text-align:right">Orig.</th><th style="text-align:right">Discount</th><th style="text-align:right">Paid</th></tr></thead>
          <tbody>${r.orders.map((o) => `
            <tr>
              <td>${esc(o.order_number || o.id.slice(0, 8).toUpperCase())}</td>
              <td>${esc(formatDate(o.created_at))}</td>
              <td>${esc(o.customer_name)}</td>
              <td>${esc(o.status)}</td>
              <td style="text-align:right">₹${esc(o.original_total ?? o.total)}</td>
              <td style="text-align:right;color:#991b1b">−₹${esc(Number(o.discount_amount ?? 0).toFixed(2))}</td>
              <td style="text-align:right;font-weight:700">₹${esc(o.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`).join('')}
      ${footer()}`;
    openPrint(wrapHtml('Referral & Promo Report', body));
  };

  // ── Shared filter toolbar ─────────────────────────────────────────────────
  const FilterToolbar = () => (
    <div className="orders-toolbar">
      <div className="admin-filter-bar">
        <div className="admin-search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search order, customer, phone, product, referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <label className="admin-date-filter">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label className="admin-date-filter">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        {(searchTerm || dateFrom || dateTo) && (
          <button type="button" className="btn btn-outline" onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}>Clear</button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* ── View Mode Toggle ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={`tab-btn ${viewMode === 'by-order' ? 'active' : ''}`} onClick={() => setViewMode('by-order')}>
          By Order
        </button>
        <button className={`tab-btn ${viewMode === 'by-product' ? 'active' : ''}`} onClick={() => setViewMode('by-product')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Package size={15} /> By Product
        </button>
        <button className={`tab-btn ${viewMode === 'by-referral' ? 'active' : ''}`} onClick={() => setViewMode('by-referral')} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Tag size={15} /> By Referral
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BY ORDER VIEW                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewMode === 'by-order' && (
        <>
          <div className="orders-header-row">
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                Pending ({orders.filter((o) => o.status === 'pending').length})
              </button>
              <button className={`tab-btn ${activeTab === 'fulfilled' ? 'active' : ''}`} onClick={() => setActiveTab('fulfilled')}>
                Fulfilled ({orders.filter((o) => o.status === 'fulfilled').length})
              </button>
              <button className={`tab-btn ${activeTab === 'failed' ? 'active' : ''}`} onClick={() => setActiveTab('failed')}>
                Failed ({orders.filter((o) => o.status === 'failed').length})
              </button>
            </div>
            <div className="orders-export-actions">
              <button type="button" className="btn btn-outline" onClick={printDispatchSheet} disabled={!baseFilteredOrders.filter((o) => o.status === 'pending').length} title="Print dispatch sheet"><Printer size={16} /> Dispatch Sheet</button>
              <button type="button" className="btn btn-outline" onClick={exportPdf} disabled={!filteredOrders.length}><FileText size={16} /> Export PDF</button>
              <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!filteredOrders.length}><Download size={16} /> Export CSV</button>
            </div>
          </div>

          <FilterToolbar />

          {(dateFrom || dateTo) && (
            <p className="orders-filter-summary">
              Showing {filteredOrders.length} {activeTab} order{filteredOrders.length === 1 ? '' : 's'}
              {dateFrom ? ` from ${dateFrom}` : ''}{dateTo ? ` through ${dateTo}` : ''}. PDF and CSV exports contain only these records.
            </p>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>🔄 Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No orders listed under {activeTab.toUpperCase()}.</div>
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
                  {filteredOrders.map((order) => {
                    const hasDiscount = order.discount_amount && Number(order.discount_amount) > 0;
                    const codeLabel = order.referral_code || order.promo_code;
                    return (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>
                          {order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </td>

                        <td>
                          <div>{formatDateTime(order.created_at)}</div>
                          {order.status === 'pending' && (() => {
                            const age = ageBadge(order.created_at);
                            return (
                              <span style={{
                                display: 'inline-block', marginTop: '0.3rem',
                                padding: '0.1rem 0.5rem', borderRadius: '999px',
                                fontSize: '0.72rem', fontWeight: 700,
                                border: `1px solid ${age.color}`,
                                color: age.color, background: age.bg,
                              }}>{age.label} old</span>
                            );
                          })()}
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontWeight: 700 }}>{order.customer_name}</span>
                            <a href={`tel:${order.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                              <Phone size={12} /><span>{order.phone}</span>
                            </a>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {order.address} {order.pin_code && `(PIN: ${order.pin_code})`}
                            </span>
                          </div>
                        </td>

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

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={12} />
                              <strong>Delivery:</strong>{' '}
                              {order.preferred_delivery_date
                                ? order.preferred_delivery_date
                                : <span style={{ color: 'var(--danger)', fontWeight: 600 }}>ASAP</span>}
                            </span>
                            {order.special_instructions && (
                              <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>"{order.special_instructions}"</span>
                            )}
                            {order.status === 'fulfilled' && (
                              <div style={{ marginTop: '0.4rem', padding: '0.25rem', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--success)' }}>
                                <strong>{order.payment_mode}</strong>: ₹{order.payment_amount}
                                {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Total — shows discount if applied */}
                        <td>
                          {hasDiscount ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                ₹{order.original_total ?? order.total}
                              </span>
                              <span style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>
                                ₹{order.total}
                              </span>
                              {codeLabel && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '0.1rem 0.45rem', borderRadius: '999px', width: 'fit-content' }}>
                                  <Tag size={10} /> {codeLabel}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1.05rem' }}>₹{order.total}</span>
                          )}
                        </td>

                        <td>
                          <div className="admin-table-actions">
                            {order.status === 'pending' && (
                              <>
                                <button className="order-action-icon accept" onClick={() => handleOpenFulfil(order)} title="Accept order and record payment" aria-label={`Accept order ${order.order_number || order.id}`}><Check size={18} /></button>
                                <button className="order-action-icon reject" onClick={() => handleMarkFailed(order.id)} title="Reject order" aria-label={`Reject order ${order.order_number || order.id}`}><X size={18} /></button>
                                <button className="btn-icon" onClick={() => printChallan(order)} title="Print Delivery Challan" style={{ color: 'var(--text-muted)' }}><Printer size={16} /></button>
                                <a
                                  href={`https://wa.me/91${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage(order))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-icon"
                                  title="Send WhatsApp confirmation"
                                  style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  aria-label={`WhatsApp ${order.customer_name}`}
                                ><MessageSquare size={16} /></a>
                              </>
                            )}
                            {order.status === 'fulfilled' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ Fulfilled</span>
                                <button className="btn-icon" onClick={() => printReceipt(order)} title="Print Customer Receipt" style={{ color: 'var(--text-muted)' }}><Printer size={15} /></button>
                              </div>
                            )}
                            {order.status === 'failed' && (
                              <>
                                <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }} onClick={() => handleRestore(order.id)} title="Restore to Pending">
                                  <RotateCcw size={14} /><span>Restore</span>
                                </button>
                                <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }} onClick={() => setDeleteTargetOrder(order)} title="Delete Permanently">
                                  <Trash2 size={14} /><span>Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BY PRODUCT VIEW                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewMode === 'by-product' && (
        <>
          <FilterToolbar />
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.75rem 0 1rem 0', fontSize: '0.85rem' }}>
            <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: 'var(--warning)', borderRadius: '999px', fontWeight: 600 }}>
              Pending: {productSummaries.reduce((s, p) => s + p.pendingQty, 0)} units across {productSummaries.filter((p) => p.pendingQty > 0).length} products
            </span>
            <span style={{ padding: '0.25rem 0.75rem', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '999px', fontWeight: 600 }}>
              Fulfilled: {productSummaries.reduce((s, p) => s + p.fulfilledQty, 0)} units
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>🔄 Loading orders...</div>
          ) : productSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No orders match the current filters.</div>
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
                        <tr onClick={() => toggleProductExpand(product.key)} style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-muted)' : undefined }}>
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
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{product.orderCount}</td>
                        </tr>
                        {isExpanded && product.orders.map(({ order, quantity }, idx) => (
                          <tr key={`${product.key}-${order.id}-${idx}`} style={{ background: 'var(--bg-card)', borderLeft: `3px solid ${STATUS_COLORS[order.status] || 'var(--border)'}` }}>
                            <td></td>
                            <td colSpan={2}>
                              <div style={{ paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{formatDate(order.created_at)}</span>
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
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{quantity} {product.unit.replace(/^1\s*/, '')}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: order.status === 'pending' ? '#fef3c7' : order.status === 'fulfilled' ? 'var(--success-light)' : '#fee2e2', color: STATUS_COLORS[order.status] }}>
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* BY REFERRAL VIEW                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewMode === 'by-referral' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <FilterToolbar />
            <button
              type="button"
              className="btn btn-outline"
              onClick={printReferralReport}
              disabled={!referralSummaries.length}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.75rem', flexShrink: 0 }}
              title="Print referral & promo usage report"
            >
              <Printer size={16} /> Referral Report
            </button>
          </div>

          {/* Summary pills */}
          {referralSummaries.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
              <span style={{ padding: '0.25rem 0.75rem', background: '#f0f9ff', color: '#0369a1', borderRadius: '999px', fontWeight: 600 }}>
                {referralSummaries.length} active code{referralSummaries.length === 1 ? '' : 's'} · {referralSummaries.reduce((s, r) => s + r.orderCount, 0)} orders
              </span>
              <span style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '999px', fontWeight: 600 }}>
                Total discount given: ₹{referralSummaries.reduce((s, r) => s + r.discountTotal, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span style={{ padding: '0.25rem 0.75rem', background: 'var(--success-light)', color: 'var(--success)', borderRadius: '999px', fontWeight: 600 }}>
                Net revenue: ₹{referralSummaries.reduce((s, r) => s + r.netTotal, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>🔄 Loading orders...</div>
          ) : referralSummaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Tag size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>No orders with referral or promo codes found.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Orders using a code will appear here automatically.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '2rem' }}></th>
                    <th>Code</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Orders</th>
                    <th style={{ textAlign: 'right' }}>Original Value</th>
                    <th style={{ textAlign: 'right', color: '#991b1b' }}>Discount Given</th>
                    <th style={{ textAlign: 'right', color: 'var(--success)' }}>Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {referralSummaries.map((ref) => {
                    const isExpanded = expandedReferrals.has(ref.code);
                    return (
                      <React.Fragment key={ref.code}>
                        {/* Code summary row */}
                        <tr onClick={() => toggleReferralExpand(ref.code)} style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-muted)' : undefined }}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Tag size={14} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.04em', color: '#17633f' }}>{ref.code}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{
                              padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                              background: ref.type === 'referral' ? '#dcfce7' : ref.type === 'promo' ? '#fef3c7' : '#e0f2fe',
                              color: ref.type === 'referral' ? '#166534' : ref.type === 'promo' ? '#92400e' : '#0369a1',
                            }}>
                              {ref.type === 'referral' ? 'Referral' : ref.type === 'promo' ? 'Promo' : 'Both'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{ref.orderCount}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            ₹{ref.originalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>
                            −₹{ref.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                            ₹{ref.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>

                        {/* Expanded order rows per code */}
                        {isExpanded && ref.orders.map((order, idx) => (
                          <tr key={`${ref.code}-${order.id}-${idx}`} style={{ background: 'var(--bg-card)', borderLeft: `3px solid ${STATUS_COLORS[order.status] || 'var(--border)'}` }}>
                            <td></td>
                            <td colSpan={2}>
                              <div style={{ paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{formatDate(order.created_at)}</span>
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
                            <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', marginRight: '0.4rem' }}>₹{order.original_total ?? order.total}</span>
                                <span style={{ color: '#991b1b', fontWeight: 600 }}>−₹{Number(order.discount_amount ?? 0).toFixed(2)}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95rem' }}>₹{Number(order.total).toFixed(2)}</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: order.status === 'pending' ? '#fef3c7' : order.status === 'fulfilled' ? 'var(--success-light)' : '#fee2e2', color: STATUS_COLORS[order.status] }}>
                                  {order.status}
                                </span>
                              </div>
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
              <button className="btn-icon" onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleFulfilSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <strong>Customer:</strong> {selectedOrder.customer_name} <br />
                  <strong>Order Total:</strong> ₹{selectedOrder.total}
                  {(selectedOrder.referral_code || selectedOrder.promo_code) && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#15803d' }}>
                      🏷 Code applied: <strong>{selectedOrder.referral_code || selectedOrder.promo_code}</strong>
                      {selectedOrder.discount_amount ? ` (−₹${Number(selectedOrder.discount_amount).toFixed(2)})` : ''}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="paymentMode">Payment Mode *</label>
                  <select id="paymentMode" className="form-control" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)} required>
                    <option value="UPI">UPI / Transfer</option>
                    <option value="Cash on delivery">Cash on delivery (COD)</option>
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Card">Card payment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="paymentNotes">Payment Notes</label>
                  <textarea id="paymentNotes" className="form-control" placeholder="Optional reconciliation or collection notes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3} />
                </div>
                <div className="form-group">
                  <label htmlFor="paymentAmount">Payment Amount *</label>
                  <input type="number" step="0.01" id="paymentAmount" className="form-control" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="paymentRef">Reference / UTR / Receipt No.</label>
                  <input type="text" id="paymentRef" className="form-control" placeholder="e.g. UTR1234567890" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedOrder(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>{isSubmitting ? 'Recording...' : 'Confirm Fulfillment'}</button>
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
                <ShieldAlert size={20} /><span>Delete Order?</span>
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
              Are you sure you want to permanently delete order from <strong>{deleteTargetOrder.customer_name}</strong>? This action is irreversible.
            </div>
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTargetOrder(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteOrder}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
