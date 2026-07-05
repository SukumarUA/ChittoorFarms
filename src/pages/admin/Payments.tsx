import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Download, Pencil, Printer, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { esc, logoRow, footer, wrapHtml, openPrint } from '../../lib/printUtils';

type PaymentMode = 'UPI' | 'Cash on delivery' | 'Bank transfer' | 'Card';

interface PaymentRecord {
  id: string;
  order_number: string | null;
  created_at: string;
  customer_name: string;
  phone: string;
  total: number;
  payment_mode: PaymentMode | null;
  payment_amount: number | null;
  payment_reference: string | null;
  payment_notes: string | null;
  payment_recorded_at: string | null;
}

const paymentModes: PaymentMode[] = ['UPI', 'Cash on delivery', 'Bank transfer', 'Card'];

const escapeCsv = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const Payments: React.FC = () => {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | PaymentMode>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentRecord | null>(null);
  const [editMode, setEditMode] = useState<PaymentMode>('UPI');
  const [editAmount, setEditAmount] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, customer_name, phone, total, payment_mode, payment_amount, payment_reference, payment_notes, payment_recorded_at')
        .eq('status', 'fulfilled')
        .order('payment_recorded_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setPayments((data as PaymentRecord[]) || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      showToast('Could not load payment records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.resolve().then(fetchPayments);
    const subscription = supabase
      .channel('payments-db-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchPayments)
      .subscribe();
    return () => { void subscription.unsubscribe(); };
  }, [fetchPayments]);

  const filteredPayments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return payments.filter((payment) => {
      const recordedDate = (payment.payment_recorded_at || payment.created_at).slice(0, 10);
      const searchable = [payment.order_number, payment.customer_name, payment.phone, payment.payment_reference]
        .filter(Boolean).join(' ').toLowerCase();
      return (!query || searchable.includes(query))
        && (modeFilter === 'all' || payment.payment_mode === modeFilter)
        && (!dateFrom || recordedDate >= dateFrom)
        && (!dateTo || recordedDate <= dateTo);
    });
  }, [payments, searchTerm, modeFilter, dateFrom, dateTo]);

  const collectedTotal = filteredPayments.reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0);
  const outstandingTotal = filteredPayments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.total) - Number(payment.payment_amount || 0)),
    0,
  );

  const openEdit = (payment: PaymentRecord) => {
    setEditPayment(payment);
    setEditMode(payment.payment_mode || 'UPI');
    setEditAmount(String(payment.payment_amount ?? payment.total));
    setEditReference(payment.payment_reference || '');
    setEditNotes(payment.payment_notes || '');
  };

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editPayment || !editAmount || Number(editAmount) < 0) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('orders').update({
        payment_mode: editMode,
        payment_amount: Number(editAmount),
        payment_reference: editReference.trim() || null,
        payment_notes: editNotes.trim() || null,
        payment_recorded_at: editPayment.payment_recorded_at || new Date().toISOString(),
      }).eq('id', editPayment.id);
      if (error) throw error;
      showToast('Payment record updated.', 'success');
      setEditPayment(null);
      await fetchPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      showToast('Could not update payment record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const printReport = () => {
    const ref = `Payment Report · ${new Date().toLocaleDateString('en-IN')}`;
    const orderValueTotal = filteredPayments.reduce((s, p) => s + Number(p.total), 0);

    const rows = filteredPayments.map((p) => {
      const balance = Math.max(0, Number(p.total) - Number(p.payment_amount || 0));
      return `<tr>
        <td style="white-space:nowrap;font-weight:700">${esc(p.order_number || p.id.slice(0, 8).toUpperCase())}</td>
        <td style="white-space:nowrap;font-size:0.82em">${esc(new Date(p.payment_recorded_at || p.created_at).toLocaleDateString('en-IN'))}</td>
        <td><strong>${esc(p.customer_name)}</strong><br><span style="color:#6b7280;font-size:0.82em">${esc(p.phone)}</span></td>
        <td><span class="badge badge-fulfilled">${esc(p.payment_mode || 'Not set')}</span></td>
        <td style="text-align:right">₹${Number(p.total).toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700;color:#15803d">₹${Number(p.payment_amount || 0).toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:${balance > 0 ? '700' : '400'};color:${balance > 0 ? '#dc2626' : '#374151'}">₹${balance.toLocaleString('en-IN')}</td>
        <td style="font-size:0.82em;color:#374151">${esc(p.payment_reference || '—')}</td>
        <td style="font-size:0.78em;color:#6b7280">${esc(p.payment_notes || '—')}</td>
      </tr>`;
    }).join('');

    const totalsRow = `<tr class="total-row">
      <td colspan="4"><strong>TOTALS (${filteredPayments.length} records)</strong></td>
      <td style="text-align:right"><strong>₹${orderValueTotal.toLocaleString('en-IN')}</strong></td>
      <td style="text-align:right"><strong>₹${collectedTotal.toLocaleString('en-IN')}</strong></td>
      <td style="text-align:right"><strong>₹${outstandingTotal.toLocaleString('en-IN')}</strong></td>
      <td colspan="2"></td>
    </tr>`;

    const body = `
      ${logoRow('Payment Report', ref)}
      <div class="info-grid">
        <div class="info-box"><div class="lbl">Records</div><div class="val">${filteredPayments.length}</div></div>
        <div class="info-box"><div class="lbl">Order Value</div><div class="val">₹${orderValueTotal.toLocaleString('en-IN')}</div></div>
        <div class="info-box"><div class="lbl">Collected</div><div class="val" style="color:#15803d">₹${collectedTotal.toLocaleString('en-IN')}</div></div>
        <div class="info-box"><div class="lbl">Outstanding</div><div class="val" style="color:#dc2626">₹${outstandingTotal.toLocaleString('en-IN')}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Order</th><th>Date</th><th>Customer</th><th>Mode</th>
          <th style="text-align:right">Order Total</th>
          <th style="text-align:right">Collected</th>
          <th style="text-align:right">Balance</th>
          <th>Reference</th><th>Notes</th>
        </tr></thead>
        <tbody>${rows}${totalsRow}</tbody>
      </table>
      ${footer()}`;

    openPrint(wrapHtml('Payment Report – Chittoor Farms', body));
  };

  const exportCsv = () => {
    const rows = [
      ['Order Ref', 'Payment Date', 'Customer', 'Phone', 'Mode', 'Order Total (INR)', 'Collected (INR)', 'Outstanding (INR)', 'Reference', 'Notes'],
      ...filteredPayments.map((p) => [
        p.order_number || p.id.slice(0, 8).toUpperCase(),
        new Date(p.payment_recorded_at || p.created_at).toLocaleDateString('en-CA'), // ISO YYYY-MM-DD for spreadsheet sorting
        p.customer_name,
        p.phone,
        p.payment_mode || 'Not set',
        Number(p.total),
        Number(p.payment_amount || 0),
        Math.max(0, Number(p.total) - Number(p.payment_amount || 0)),
        p.payment_reference || '',
        p.payment_notes || '',
      ]),
      [],
      ['TOTALS', '', '', '', '',
        filteredPayments.reduce((s, p) => s + Number(p.total), 0),
        collectedTotal,
        outstandingTotal,
        '', ''],
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `chittoor-farms-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="payments-page">
      <div className="payments-heading">
        <div><h1>Payments</h1><p>Reconcile, maintain, and report fulfilled-order payments.</p></div>
        <div className="payments-report-actions">
          <button className="btn btn-outline" onClick={printReport} disabled={!filteredPayments.length}><Printer size={16} /> Print Report</button>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={!filteredPayments.length}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="payment-summary-grid">
        <div className="payment-summary-card"><span>Payment Records</span><strong>{filteredPayments.length}</strong></div>
        <div className="payment-summary-card"><span>Order Value</span><strong>₹{filteredPayments.reduce((sum, payment) => sum + Number(payment.total), 0).toLocaleString('en-IN')}</strong></div>
        <div className="payment-summary-card success"><span>Amount Collected</span><strong>₹{collectedTotal.toLocaleString('en-IN')}</strong></div>
        <div className="payment-summary-card warning"><span>Outstanding</span><strong>₹{outstandingTotal.toLocaleString('en-IN')}</strong></div>
      </div>

      <div className="admin-filter-bar payments-filters">
        <div className="admin-search-field"><Search size={17} /><input type="search" placeholder="Search order, customer, phone, reference..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <select className="form-control payment-mode-filter" value={modeFilter} onChange={(event) => setModeFilter(event.target.value as 'all' | PaymentMode)}>
          <option value="all">All payment modes</option>
          {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>
        <label className="admin-date-filter">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="admin-date-filter">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      </div>

      {loading ? <div className="admin-empty-state">Loading payment records...</div> : !filteredPayments.length ? <div className="admin-empty-state">No payments match these filters.</div> : (
        <div className="table-responsive payment-report-table">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Payment Date</th><th>Customer</th><th>Mode</th><th>Order Total</th><th>Paid</th><th>Balance</th><th>Reference</th><th>Actions</th></tr></thead>
            <tbody>{filteredPayments.map((payment) => {
              const balance = Math.max(0, Number(payment.total) - Number(payment.payment_amount || 0));
              return <tr key={payment.id}>
                <td className="payment-order-ref">{payment.order_number || payment.id.slice(0, 8).toUpperCase()}</td>
                <td>{new Date(payment.payment_recorded_at || payment.created_at).toLocaleDateString('en-IN')}</td>
                <td><strong>{payment.customer_name}</strong><small>{payment.phone}</small></td>
                <td><span className="badge badge-fulfilled">{payment.payment_mode || 'Not set'}</span></td>
                <td>₹{Number(payment.total).toLocaleString('en-IN')}</td>
                <td className="payment-paid">₹{Number(payment.payment_amount || 0).toLocaleString('en-IN')}</td>
                <td className={balance > 0 ? 'payment-balance' : ''}>₹{balance.toLocaleString('en-IN')}</td>
                <td>{payment.payment_reference || '-'}</td>
                <td><button className="order-action-icon edit" onClick={() => openEdit(payment)} title="Edit payment" aria-label={`Edit payment ${payment.order_number || payment.id}`}><Pencil size={16} /></button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}

      {editPayment && <div className="modal-backdrop open" onClick={() => setEditPayment(null)}>
        <div className="modal-content" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header"><h3><CreditCard size={20} /> Edit Payment</h3><button className="btn-icon" onClick={() => setEditPayment(null)}><X size={20} /></button></div>
          <form onSubmit={savePayment}><div className="modal-body">
            <div className="payment-edit-order"><strong>{editPayment.order_number || editPayment.id.slice(0, 8).toUpperCase()}</strong><span>{editPayment.customer_name} · Order total ₹{editPayment.total}</span></div>
            <div className="form-group"><label>Payment Mode</label><select className="form-control" value={editMode} onChange={(event) => setEditMode(event.target.value as PaymentMode)}>{paymentModes.map((mode) => <option key={mode}>{mode}</option>)}</select></div>
            <div className="form-group"><label>Paid Amount</label><input className="form-control" type="number" min="0" step="0.01" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} required /></div>
            <div className="form-group"><label>Reference / UTR / Receipt</label><input className="form-control" value={editReference} onChange={(event) => setEditReference(event.target.value)} /></div>
            <div className="form-group"><label>Notes</label><textarea className="form-control" rows={3} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} /></div>
          </div><div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setEditPayment(null)}>Cancel</button><button className="btn btn-secondary" disabled={saving}>{saving ? 'Saving...' : 'Save Payment'}</button></div></form>
        </div>
      </div>}
    </div>
  );
};
