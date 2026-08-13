import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerAPI, invoiceAPI, paymentAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const statusColor = (s) =>
  ({ PAID: 'badge-green', UNPAID: 'badge-red', PARTIAL: 'badge-orange', CANCELLED: 'badge-gray' }[s] || 'badge-gray');

/* ─── Ledger List ──────────────────────────────────────────── */
export function Ledger() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const nav = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let mounted = true;

    customerAPI.getAll()
      .then(r => {
        if (mounted) setCustomers(r.data || []);
      })
      .catch(e => {
        toast(e.message || 'Failed to load ledger', 'error');
        if (mounted) setCustomers([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [toast]);

  const filtered = customers.filter(c =>
    !search ||
    c.FullName.toLowerCase().includes(search.toLowerCase()) ||
    c.Phone.includes(search)
  );

  const totalOutstanding = customers.reduce((a, c) => a + parseFloat(c.Balance || 0), 0);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="ledger-stats">
          <div className="ledger-stat">
            <div className="ledger-stat-label">Total Outstanding</div>
            <div className="ledger-stat-value" style={{ color: totalOutstanding > 0 ? 'var(--red)' : 'var(--green)' }}>
              {fmt(totalOutstanding)}
            </div>
          </div>
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total Invoiced</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((c, i) => (
                <tr key={c.CustomerID} style={{ cursor: 'pointer' }} onClick={() => nav(`/ledger/${c.CustomerID}`)}>
                  <td className="text-gray">{i + 1}</td>
                  <td><strong>{c.FullName}</strong></td>
                  <td>{c.Phone}</td>
                  <td>{fmt(c.TotalInvoiced)}</td>
                  <td className="text-green text-bold">{fmt(c.TotalPaid)}</td>
                  <td>
                    <strong style={{ color: c.Balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {fmt(c.Balance)}
                    </strong>
                    {c.Balance > 0 && <span className="badge badge-red" style={{ marginLeft: 8 }}>Due</span>}
                    {c.Balance <= 0 && c.TotalInvoiced > 0 && <span className="badge badge-green" style={{ marginLeft: 8 }}>Clear</span>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={() => nav(`/ledger/${c.CustomerID}`)}>
                      View Ledger
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">💰</div>
                      <div className="empty-text">No customers found</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Ledger Detail ────────────────────────────────────────── */
export function LedgerDetail() {
  const { id } = useParams();
  const nav    = useNavigate();
  const toast  = useToast();

  const [customer, setCustomer]   = useState(null);
  const [invoices, setInvoices]   = useState([]);
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [payModal, setPayModal]   = useState(false);
  const [payForm, setPayForm]     = useState({ amount: '', paymentMode: 'CASH', reference: '', notes: '', invoiceID: '' });
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    try {
      const [custRes, invRes, payRes] = await Promise.all([
        customerAPI.getOne(id),
        invoiceAPI.getAll(),
        paymentAPI.getAll(id),
      ]);
      setCustomer(custRes.data);
      setInvoices(invRes.data.filter(i => i.CustomerID === parseInt(id)));
      setPayments(payRes.data);
    } catch (e) {
      toast('Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDeletePayment = async (paymentId, originalAmount) => {
    const confirmation = window.confirm(
      `CRITICAL BALANCE CHANGE WARNING:\n\nAre you sure you want to completely delete this payment record of ${fmt(originalAmount)}? This will immediately recalculate the client's net due statement balance.`
    );
    if (!confirmation) return;

    try {
      await paymentAPI.delete(paymentId);
      toast('Payment entry removed successfully');
      load();
    } catch (e) {
      toast(e.message || 'Failed to discard payment transaction', 'error');
    }
  };

  const handlePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast('Enter a valid amount', 'error'); return;
    }
    setSaving(true);
    try {
      await paymentAPI.create({
        customerID:  parseInt(id),
        invoiceID:   payForm.invoiceID ? parseInt(payForm.invoiceID) : null,
        amount:      parseFloat(payForm.amount),
        paymentMode: payForm.paymentMode,
        reference:   payForm.reference || null,
        notes:       payForm.notes || null,
      });
      toast('Payment recorded');
      setPayModal(false);
      setPayForm({ amount: '', paymentMode: 'CASH', reference: '', notes: '', invoiceID: '' });
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!customer) return <div className="empty-state"><div className="empty-icon">⚠️</div><div className="empty-text">Customer not found</div></div>;

  const balance = parseFloat(customer.Balance || 0);

  // Build a merged timeline of invoices + payments sorted by date
  const timeline = [
    ...invoices.map(i => ({ type: 'invoice', date: i.InvoiceDate?.split('T')[0], data: i })),
    ...payments.map(p => ({ type: 'payment', date: p.PaymentDate?.split('T')[0], data: p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const unpaidInvoices = invoices.filter(i => i.Status !== 'PAID' && i.Status !== 'CANCELLED');

  return (
    <div className="fade-in">
      <button className="back-btn" onClick={() => nav('/ledger')}>← Back to Ledger</button>

      {/* Customer Summary */}
      <div className="card mb-16">
        <div className="ledger-header">
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray1)', marginBottom: 2 }}>{customer.FullName}</div>
            <div style={{ fontSize: 13, color: 'var(--gray3)' }}>
              📞 {customer.Phone}
              {customer.Address && <> · 📍 {customer.Address}</>}
              {customer.Email && <> · ✉️ {customer.Email}</>}
            </div>
          </div>
          <div className="ledger-stats">
            <div className="ledger-stat">
              <div className="ledger-stat-label">Total Invoiced</div>
              <div className="ledger-stat-value">{fmt(customer.TotalInvoiced)}</div>
            </div>
            <div className="ledger-stat">
              <div className="ledger-stat-label">Total Paid</div>
              <div className="ledger-stat-value" style={{ color: 'var(--green)' }}>{fmt(customer.TotalPaid)}</div>
            </div>
            <div className="ledger-stat">
              <div className="ledger-stat-label">Balance Due</div>
              <div className="ledger-stat-value" style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(balance)}</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => {
            setPayForm({ amount: '', paymentMode: 'CASH', reference: '', notes: '', invoiceID: '' });
            setPayModal(true);
          }}>
            + General Payment
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="card mb-0">
        <div className="card-title">Transaction Timeline</div>
        {timeline.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description / Details</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((t, i) => (
                  <tr key={i}>
                    <td className="text-gray text-sm">{t.date}</td>
                    <td>
                      {t.type === 'invoice'
                        ? <span className="badge badge-blue">Invoice</span>
                        : <span className="badge badge-green">Payment</span>}
                    </td>
                    <td>
                      {t.type === 'invoice' ? (
                        <div>
                          <span
                            style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 600 }}
                            onClick={() => nav(`/history/${t.data.InvoiceID}`)}
                          >
                            {t.data.InvoiceNumber}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-gray" style={{ fontWeight: 600 }}>
                            {t.data.PaymentMode}{t.data.Reference ? ` · Ref: ${t.data.Reference}` : ''}
                          </span>
                          {/* FIXED CHANGE: Explicitly matches which invoice ID this timeline row is paying */}
                          {t.data.InvoiceID ? (
                            <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: '11px' }}>
                              Linked: Inv #{t.data.InvoiceID}
                            </span>
                          ) : (
                            <span className="badge badge-orange" style={{ marginLeft: 8, fontSize: '11px' }}>
                              ⚠️ Floating Advance
                            </span>
                          )}
                          {t.data.Notes && <div style={{ fontSize: '11px', color: 'var(--gray4)', marginTop: 2 }}>Note: {t.data.Notes}</div>}
                        </div>
                      )}
                    </td>
                    <td>
                      {t.type === 'invoice' && t.data.Status !== 'CANCELLED'
                        ? <strong className="text-red">{fmt(t.data.TotalAmount)}</strong>
                        : '—'}
                    </td>
                    <td>
                      {t.type === 'payment'
                        ? <strong className="text-green">{fmt(t.data.Amount)}</strong>
                        : '—'}
                    </td>
                    <td>
                      {t.type === 'invoice'
                        ? <span className={`badge ${statusColor(t.data.Status)}`}>{t.data.Status}</span>
                        : <span className="badge badge-green">RECEIVED</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {/* FIXED CHANGE: Contextual single action based on line transaction item type */}
                      {t.type === 'invoice' ? (
                        t.data.Status !== 'PAID' && t.data.Status !== 'CANCELLED' ? (
                          <button
                            className="btn btn-success btn-sm"
                            style={{ padding: '2px 10px', fontSize: '12px' }}
                            onClick={() => {
                              setPayForm({ amount: String(t.data.TotalAmount), paymentMode: 'CASH', reference: '', notes: `Payment for Invoice ${t.data.InvoiceNumber}`, invoiceID: String(t.data.InvoiceID) });
                              setPayModal(true);
                            }}
                          >
                            💵 Pay Invoice
                          </button>
                        ) : (
                          <span className="text-gray" style={{ fontSize: '12px' }}>✓ Cleared</span>
                        )
                      ) : (
                        <button
                          className="btn btn-red btn-sm"
                          style={{ padding: '2px 8px', fontSize: '12px' }}
                          onClick={() => handleDeletePayment(t.data.PaymentID, t.data.Amount)}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <div className="empty-text">No transactions yet</div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title={payForm.invoiceID ? `Record Payment for Invoice` : "Record General Account Payment"}>
        <div className="form-group">
          <label className="form-label">Link to Invoice <span>(optional)</span></label>
          <select
            className="form-select"
            value={payForm.invoiceID}
            onChange={e => setPayForm({ ...payForm, invoiceID: e.target.value })}
          >
            <option value="">— General payment (no specific invoice) —</option>
            {unpaidInvoices.map(i => (
              <option key={i.InvoiceID} value={i.InvoiceID}>
                {i.InvoiceNumber} — {fmt(i.TotalAmount)} ({i.Status})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            value={payForm.amount}
            onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
            autoFocus
          />
          <div style={{ fontSize: 12, color: 'var(--gray4)', marginTop: 4 }}>
            Outstanding balance: <strong>{fmt(balance)}</strong>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Mode</label>
          <select className="form-select" value={payForm.paymentMode} onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Reference <span>(optional)</span></label>
            <input className="form-input" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes <span>(optional)</span></label>
            <input className="form-input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePayment} disabled={saving}>
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
