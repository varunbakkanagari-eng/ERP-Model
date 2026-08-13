import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { invoiceAPI, paymentAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

/* ─── Constants ──────────────────────────────────────────────── */
const BUSINESS = {
  name:        'SAI VARUN ENTERPRISES',
  gstin:       '36AEDFS1935H1Z0',
  phone:       'Cell : 9989888226',
  email:       'srilaxmibrickindustry@gmail.com',
  address:     'Sy. No.19/A/17/A, Raviryala, Maheshwaram Mdl., R.R. Dist.',
  bank:        'KARUR VYSYA BANK',
  branch:      'Meerpet.',
  accountNo:   '1481135000006632',
  ifsc:        'KVBL0001481',
  signatory:   'Sai Varun Enterprises',   // kept as per spec
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const statusColor = (s) =>
  ({ PAID: 'badge-green', UNPAID: 'badge-red', PARTIAL: 'badge-orange', CANCELLED: 'badge-gray' }[s] || 'badge-gray');

function convertNumberToWords(amount) {
  const words = {
    0: '', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
    10: 'Ten', 11: 'Eleven', 12: 'Twelve', 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen',
    17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty', 30: 'Thirty', 40: 'Forty', 50: 'Fifty',
    60: 'Sixty', 70: 'Seventy', 80: 'Eighty', 90: 'Ninety',
  };
  let num = Math.floor(amount);
  if (num === 0) return 'Zero Only';
  const getBelowHundred = (n) => {
    if (n < 20) return words[n];
    return words[Math.floor(n / 10) * 10] + (n % 10 ? ' ' + words[n % 10] : '');
  };
  const getBelowThousand = (n) => {
    let out = '';
    if (n >= 100) { out += words[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n > 0) out += ' and '; }
    if (n > 0) out += getBelowHundred(n);
    return out;
  };
  let str = '';
  if (num >= 10000000) { str += getBelowThousand(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
  if (num >= 100000)   { str += getBelowThousand(Math.floor(num / 100000))   + ' Lakh ';  num %= 100000; }
  if (num >= 1000)     { str += getBelowThousand(Math.floor(num / 1000))     + ' Thousand '; num %= 1000; }
  if (num > 0)         { str += getBelowThousand(num); }
  return str.trim() + ' Only';
}

/* ═══════════════════════════════════════════════════════════════
   INVOICE HISTORY LIST
═══════════════════════════════════════════════════════════════ */
export function InvoiceHistory() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('ALL');
  const nav   = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    invoiceAPI.getAll()
      .then(r => { if (mounted) setInvoices(r.data || []); })
      .catch(e => { toast(e.message || 'Failed to load invoices', 'error'); if (mounted) setInvoices([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [toast]);

  const filtered = invoices.filter(i => {
    const matchStatus = filter === 'ALL' || i.Status === filter;
    const matchSearch = !search ||
      i.InvoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.CustomerName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="Search invoice / customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Total Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(i => {
                const rowTotal   = parseFloat(i.TotalAmount || 0);
                const rowPaid    = parseFloat(i.TotalPaid !== undefined ? i.TotalPaid : (i.PaidAmount || 0));
                const rowBalance = i.BalanceDue !== undefined ? parseFloat(i.BalanceDue) : (rowTotal - rowPaid);
                return (
                  <tr key={i.InvoiceID} style={{ cursor: 'pointer' }} onClick={() => nav(`/history/${i.InvoiceID}`)}>
                    <td><strong>{i.InvoiceNumber}</strong></td>
                    <td className="text-gray text-sm">{i.InvoiceDate?.split('T')[0]}</td>
                    <td>
                      {i.CustomerName}
                      <br /><span className="text-sm text-gray">{i.CustomerPhone}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}><strong>{fmt(rowTotal)}</strong></td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmt(rowPaid)}</td>
                    <td style={{ textAlign: 'right', color: rowBalance > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 'bold' }}>
                      {fmt(rowBalance)}
                    </td>
                    <td><span className={`badge ${statusColor(i.Status)}`}>{i.Status}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => nav(`/history/${i.InvoiceID}`)}>View</button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-text">No invoices found</div>
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

/* ═══════════════════════════════════════════════════════════════
   INVOICE DETAIL
═══════════════════════════════════════════════════════════════ */
export function InvoiceDetail() {
  const { id } = useParams();
  const nav    = useNavigate();
  const toast  = useToast();

  const [invoice, setInvoice]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [payModal, setPayModal]     = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [payForm, setPayForm]       = useState({ amount: '', paymentMode: 'CASH', reference: '', notes: '' });
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    invoiceAPI.getOne(id)
      .then(r => setInvoice(r.data))
      .catch(() => toast('Failed to load invoice', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try {
      await invoiceAPI.cancel(id);
      toast('Invoice cancelled');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast('Enter a valid amount', 'error'); return;
    }
    setSaving(true);
    try {
      await paymentAPI.create({
        customerID:  invoice.CustomerID,
        invoiceID:   invoice.InvoiceID,
        amount:      parseFloat(payForm.amount),
        paymentMode: payForm.paymentMode,
        reference:   payForm.reference || null,
        notes:       payForm.notes || null,
      });
      toast('Payment recorded');
      setPayModal(false);
      setPayForm({ amount: '', paymentMode: 'CASH', reference: '', notes: '' });
      const freshData = await invoiceAPI.getOne(id);
      setInvoice(freshData.data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!invoice) return (
    <div className="empty-state">
      <div className="empty-state-icon">⚠️</div>
      <div className="empty-state-text">Invoice not found</div>
    </div>
  );

  const totalPaid = invoice.payments?.reduce((a, p) => a + parseFloat(p.Amount || 0), 0) || 0;
  const balance   = parseFloat(invoice.TotalAmount) - totalPaid;

  /* ── formatted invoice date for bill pad ── */
  const fmtInvoiceDate = invoice.InvoiceDate
    ? new Date(invoice.InvoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  /* ── numeric prefix extracted from invoice number ── */
  const invoiceNumeric = invoice.InvoiceNumber?.replace(/[^0-9]/g, '') || invoice.InvoiceID;

  return (
    <div className="fade-in">
      <style>{`
        /* ══════════════════════════════════════════
           ON-SCREEN PREMIUM VIEW
        ══════════════════════════════════════════ */
        .invoice-sheet {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
          padding: 40px;
          margin-bottom: 24px;
        }
        .inv-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 24px;
          margin-bottom: 32px;
          gap: 24px;
        }
        .inv-company h2 { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; }
        .inv-company p  { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; }
        .inv-badge { text-align: right; }
        .inv-badge h3 { font-size: 12px; font-weight: 700; color: #2563eb; letter-spacing: 1px; margin: 0 0 4px 0; }
        .inv-badge .inv-num { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
        .inv-parties {
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
          margin-bottom: 32px; background: #f8fafc; padding: 24px;
          border-radius: 8px; border: 1px solid #e2e8f0;
        }
        .inv-party-label  { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
        .inv-party-name   { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
        .inv-party-detail { font-size: 13px; color: #475569; line-height: 1.5; }
        .screen-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
        .screen-table th { background: #f1f5f9; color: #475569; font-weight: 600; font-size: 11px; padding: 12px 16px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        .screen-table td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .inv-totals { display: flex; justify-content: flex-end; }
        .inv-totals-box { width: 100%; max-width: 360px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; }
        .inv-total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #475569; }
        .inv-total-row.grand { border-top: 2px dashed #e2e8f0; margin-top: 8px; padding-top: 12px; font-size: 16px; font-weight: 700; color: #0f172a; }

        /* ══════════════════════════════════════════
           PRINT: hide everything except bill pad
        ══════════════════════════════════════════ */
        @media print {
          .sidebar, .topbar, .no-print, .back-btn, .flex-end,
          .card, .invoice-sheet { display: none !important; }
          body, .app-shell, .main-content, .page-content {
            padding: 0 !important; margin: 0 !important; background: #fff !important;
          }
          .modal-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .modal-wide    { width: 100% !important; max-width: 100% !important; box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
          .bp-wrap { border: 2px solid #1e3a8a !important; width: 100% !important; margin: 0 !important; padding: 14px !important; box-sizing: border-box; }
        }

        /* ══════════════════════════════════════════
           PHYSICAL BILL PAD
        ══════════════════════════════════════════ */
        .bp-wrap {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          padding: 20px 24px 18px;
          border: 2px solid #1e3a8a;
          background: #fff;
          font-family: Arial, sans-serif;
          color: #000;
          box-sizing: border-box;
        }

        /* ── TOP META ROW: GSTIN | TAX INVOICE | Cell ── */
        .bp-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-size: 11.5px;
          font-weight: bold;
          color: #000;
          margin-bottom: 2px;
        }
        .bp-top-left   { white-space: nowrap; }
        .bp-top-center {
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          text-decoration: underline;
          letter-spacing: 0.5px;
          flex: 1;
        }
        .bp-top-right  { text-align: right; font-size: 11.5px; font-weight: bold; white-space: nowrap; }

        /* ── COMPANY NAME ── */
        .bp-company-name {
          text-align: center;
          font-size: 26px;
          font-weight: 900;
          color: #1e3a8a;
          margin: 2px 0;
          letter-spacing: 0.3px;
        }

        /* ── ADDRESS BLOCK (centered, below company name) ── */
        .bp-addr-center {
          text-align: center;
          font-size: 11px;
          color: #000;
          font-weight: 600;
          line-height: 1.55;
          margin-bottom: 6px;
        }

        /* ── No. / Date ROW ── */
        .bp-no-date-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .bp-field-left  { display: flex; align-items: flex-end; gap: 6px; flex: 1; }
        .bp-field-right { display: flex; align-items: flex-end; gap: 6px; min-width: 200px; }
        .bp-dotline {
          border-bottom: 1px dotted #333;
          display: inline-block;
          height: 18px;
          flex: 1;
          min-width: 80px;
        }
        .bp-dotline-val {
          border-bottom: 1px solid #000;
          display: inline-block;
          padding: 0 8px 1px;
          font-weight: bold;
        }

        /* ── M/s. LINE ── */
        .bp-ms-row {
          display: flex;
          align-items: flex-end;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .bp-ms-value {
          flex: 1;
          margin-left: 8px;
          border-bottom: 1px solid #000;
          padding-bottom: 1px;
          font-weight: bold;
          line-height: 18px;
        }

        /* ── GSTIN CENTER ROW ── */
        .bp-gstin-row {
          display: flex;
          align-items: flex-end;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 10px;
          justify-content: center;
        }
        .bp-gstin-dots-left  { border-bottom: 1px dotted #333; flex: 1; height: 18px; }
        .bp-gstin-dots-right { border-bottom: 1px dotted #333; flex: 1; height: 18px; }
        .bp-gstin-label { white-space: nowrap; padding: 0 6px; font-weight: bold; }
        .bp-gstin-val   {
          white-space: nowrap;
          padding: 0 6px;
          font-family: monospace;
          font-weight: bold;
          border-bottom: 1px solid #000;
          min-width: 160px;
          text-align: center;
        }

        /* ── MAIN TABLE ── */
        .bp-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
        .bp-table th {
          border: 1px solid #000;
          padding: 7px 4px;
          font-size: 12px;
          font-weight: bold;
          text-align: center;
          background: #fafafa;
        }
        .bp-table td {
          border: 1px solid #000;
          padding: 7px 5px;
          font-size: 13px;
          text-align: center;
          height: 30px;
        }

        /* ── FOOTER ── */
        .bp-footer {
          display: flex;
          width: 100%;
          border-left:   1px solid #000;
          border-right:  1px solid #000;
          border-bottom: 1px solid #000;
        }
        .bp-footer-left {
          flex: 1;
          padding: 10px 12px;
          border-right: 1px solid #000;
        }
        .bp-bank-title { font-size: 12px; font-weight: bold; text-decoration: underline; }
        .bp-bank-body  { font-size: 12px; line-height: 1.6; }

        /* Rupees section */
        .bp-rupees-section { margin-top: 14px; }
        .bp-rupees-line {
          display: flex;
          align-items: flex-end;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .bp-rupees-dotline {
          border-bottom: 1px dotted #333;
          flex: 1;
          height: 18px;
          margin-left: 6px;
          font-size: 11.5px;
          font-style: italic;
          font-weight: bold;
          line-height: 16px;
          overflow: hidden;
          white-space: nowrap;
        }
        .bp-rupees-dotline2 {
          border-bottom: 1px dotted #333;
          width: 100%;
          height: 18px;
          margin-top: 4px;
          display: block;
        }

        /* ── RIGHT TOTALS BOX ── */
        .bp-footer-right { width: 42%; }
        .bp-totals-table { width: 100%; border-collapse: collapse; }
        .bp-totals-table td {
          border-bottom: 1px solid #000;
          padding: 7px 8px;
          font-size: 12px;
          color: #000;
          height: 28px;
        }
        .bp-totals-table tr:last-child td { border-bottom: none; }
        .bp-totals-label { font-weight: bold; border-right: 1px solid #000; white-space: nowrap; }
        .bp-totals-blank { width: 28%; border-right: 1px solid #000; }
        .bp-totals-val   { text-align: right; padding-right: 10px !important; font-weight: bold; }
        .bp-for-company  {
          text-align: center;
          font-size: 12px;
          padding: 5px 8px;
          border-top: 1px solid #000;
          font-weight: 600;
        }

        /* ── SIGNATURE AREA ── */
        .bp-sig-area {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 28px;
          width: 100%;
        }
        .bp-system-note { font-style: italic; font-size: 9.5px; color: #666; }
        .bp-sig-block   { text-align: right; min-width: 200px; }
        .bp-sig-line {
          display: inline-block;
          width: 160px;
          border-top: 1px solid #000;
          padding-top: 4px;
          font-size: 12px;
          text-align: center;
          margin-top: 36px;
        }
      `}</style>

      <button className="back-btn" onClick={() => nav('/history')}>← Back to History</button>

      <div className="flex-end mb-16">
        {invoice.Status !== 'PAID' && invoice.Status !== 'CANCELLED' && (
          <>
            <button className="btn btn-success" onClick={() => {
              setPayForm({ amount: String(balance.toFixed(2)), paymentMode: 'CASH', reference: '', notes: '' });
              setPayModal(true);
            }}>
              + Record Payment
            </button>
            <button className="btn btn-danger" onClick={handleCancel}>Cancel Invoice</button>
          </>
        )}
        <button className="btn btn-primary" onClick={() => setPrintModal(true)}>🖨 Open Print Pad View</button>
      </div>

      {/* ════════════════════════════════════════════
          ON-SCREEN BACK-OFFICE DASHBOARD PANEL
      ════════════════════════════════════════════ */}
      <div className="invoice-sheet">
        <div className="inv-header">
          <div className="inv-company">
            <h2>🧱 {BUSINESS.name}</h2>
            <p>
              {BUSINESS.address}<br />
              <strong>GSTIN:</strong> {BUSINESS.gstin} | <strong>Phone:</strong> {BUSINESS.phone} | <strong>Email:</strong> {BUSINESS.email}
            </p>
          </div>
          <div className="inv-badge">
            <h3>TAX INVOICE</h3>
            <div className="inv-num">{invoice.InvoiceNumber}</div>
            <span className={`badge ${statusColor(invoice.Status)}`}>{invoice.Status}</span>
          </div>
        </div>

        <div className="inv-parties">
          <div>
            <div className="inv-party-label">Bill To</div>
            <div className="inv-party-name">{invoice.CustomerName}</div>
            <div className="inv-party-detail">
              <strong>Phone:</strong> {invoice.CustomerPhone}<br />
              {invoice.CustomerGSTIN && (
                <><strong>GSTIN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{invoice.CustomerGSTIN}</span><br /></>
              )}
              {invoice.CustomerAddress && <><strong>Address:</strong> {invoice.CustomerAddress}</>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="inv-party-label">Invoice Details</div>
            <div className="inv-party-detail">
              <strong>Date Issued:</strong> {invoice.InvoiceDate?.split('T')[0]}<br />
              <strong>System Record ID:</strong> #{invoice.InvoiceID}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="screen-table">
            <thead>
              <tr>
                <th style={{ width: '5%'  }}>#</th>
                <th style={{ width: '12%' }}>Receipt No.</th>
                <th style={{ width: '12%' }}>Date</th>
                <th style={{ width: '33%' }}>Particulars</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Quantity</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Rate</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((l, i) => (
                <tr key={l.InvoiceLineID}>
                  <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>{l.ReceiptNo || '—'}</td>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>
                    {l.ReceiptDate || invoice.InvoiceDate?.split('T')[0] || '—'}
                  </td>
                  <td>
                    <strong style={{ color: '#1e293b' }}>Bricks {l.SizeInch || l.Description}</strong>
                    {l.SizeMM && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{l.SizeMM}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500' }}>
                    {Number(l.Quantity).toLocaleString('en-IN')} nos
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    ₹{Number(l.RatePerBrick || l.Rate || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                    {fmt(l.LineAmount || (l.Quantity * (l.RatePerBrick || l.Rate || 0)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="inv-totals">
          <div className="inv-totals-box">
            <div className="inv-total-row"><span>Subtotal</span><strong>{fmt(invoice.Subtotal)}</strong></div>
            <div className="inv-total-row"><span>CGST ({invoice.CGSTRate || 9}%)</span><span>{fmt(invoice.CGSTAmount)}</span></div>
            <div className="inv-total-row"><span>SGST ({invoice.SGSTRate || 9}%)</span><span>{fmt(invoice.SGSTAmount)}</span></div>
            <div className="inv-total-row grand"><span>Grand Total</span><span style={{ color: '#2563eb' }}>{fmt(invoice.TotalAmount)}</span></div>
            <div className="inv-total-row" style={{ color: 'var(--green)', fontSize: '13px' }}>
              <span>Total Paid</span><span>{fmt(totalPaid)}</span>
            </div>
            <div className="inv-total-row" style={{
              color: balance > 0 ? 'var(--red)' : 'var(--green)',
              fontWeight: 700,
              borderTop: '1px solid #e2e8f0',
              marginTop: '4px',
              paddingTop: '8px',
            }}>
              <span>Balance Due</span><span>{fmt(balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Audit Records ── */}
      {invoice.payments?.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>
            Payment Audit Records
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Mode</th><th>Reference</th><th>Amount</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {invoice.payments.map(p => (
                <tr key={p.PaymentID}>
                  <td className="text-gray text-sm">{p.PaymentDate?.split('T')[0]}</td>
                  <td><span className="badge badge-blue">{p.PaymentMode}</span></td>
                  <td className="text-gray">{p.Reference || '—'}</td>
                  <td><strong className="text-green">{fmt(p.Amount)}</strong></td>
                  <td className="text-gray text-sm">{p.Notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════
          PAYMENT ENTRY MODAL
      ════════════════════════════════════════════ */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Payment">
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
            Balance due: <strong>{fmt(balance)}</strong>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Mode</label>
          <select
            className="form-select"
            value={payForm.paymentMode}
            onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reference / UTR</label>
          <input
            className="form-input"
            value={payForm.reference}
            onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
            placeholder="UPI ref / cheque no."
          />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input
            className="form-input"
            value={payForm.notes}
            onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePayment} disabled={saving}>
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════
          PHYSICAL BILL BOOK FORMAT MODAL
      ════════════════════════════════════════════ */}
      <Modal open={printModal} onClose={() => setPrintModal(false)} title="" wide={true}>

        {/* Controls bar — hidden on print */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          background: '#f4f4f5',
          padding: '12px 16px',
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '14px', color: '#27272a' }}>
            ✨ <strong>{BUSINESS.name}</strong> — Physical Bill Pad Print Engine
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '9px 20px',
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              🖨 Print Invoice Sheet
            </button>
            <button className="btn btn-secondary" onClick={() => setPrintModal(false)}>Close</button>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            PHYSICAL BILL PAD — EXACT FORMAT
        ════════════════════════════════════════════ */}
        <div className="bp-wrap">

          {/* ── TOP ROW: GSTIN | TAX INVOICE | Cell ── */}
          <div className="bp-top-row">
            <div className="bp-top-left">GSTIN : {BUSINESS.gstin}</div>
            <div className="bp-top-center">TAX INVOICE</div>
            <div className="bp-top-right">Cell : {BUSINESS.phone}</div>
          </div>

          {/* ── COMPANY NAME ── */}
          <div className="bp-company-name">{BUSINESS.name}</div>

          {/* ── ADDRESS BLOCK (full-width centered, no invoice# prefix) ── */}
          <div className="bp-addr-center">
            {BUSINESS.address}<br />
            Email : {BUSINESS.email}
          </div>

          {/* ── No. / Date ROW ── */}
          <div className="bp-no-date-row">
            <div className="bp-field-left">
              <span>No.</span>
              {/* Static dotted line — field is filled manually on printed copy */}
              <span className="bp-dotline" />
            </div>
            <div className="bp-field-right">
              <span>Date</span>
              <span className="bp-dotline-val">{fmtInvoiceDate}</span>
            </div>
          </div>

          {/* ── M/s. LINE ── */}
          <div className="bp-ms-row">
            <span>M/s.</span>
            <span className="bp-ms-value">{invoice.CustomerName}</span>
          </div>

          {/* ── GSTIN ROW ── */}
          <div className="bp-gstin-row">
            <span className="bp-gstin-dots-left" />
            <span className="bp-gstin-label">GSTIN</span>
            <span className="bp-gstin-val">{invoice.CustomerGSTIN || ''}</span>
            <span className="bp-gstin-dots-right" />
          </div>

          {/* ── MAIN TABLE ──
              Columns (spec-exact):
              S. No. | Receipt No. | Date | PARTICULARS | Qty. | Rate | AMOUNT
          ── */}
          <table className="bp-table">
            <thead>
              <tr>
                <th style={{ width: '6%'  }}>S.<br />No.</th>
                <th style={{ width: '12%' }}>Receipt<br />No.</th>
                <th style={{ width: '13%' }}>Date</th>
                <th style={{ width: '38%' }}>PARTICULARS</th>
                <th style={{ width: '9%'  }}>Qty.</th>
                <th style={{ width: '9%'  }}>Rate</th>
                <th style={{ width: '13%' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => (
                <tr key={line.InvoiceLineID} style={{ height: '34px' }}>
                  <td>{idx + 1}</td>
                  <td style={{ fontSize: '11px' }}>{line.ReceiptNo || ''}</td>
                  <td style={{ fontSize: '11px' }}>
                    {line.ReceiptDate
                      ? new Date(line.ReceiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : fmtInvoiceDate}
                  </td>
                  <td style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                    Bricks {line.SizeInch || line.Description}
                    {line.SizeMM ? ` (${line.SizeMM})` : ''}
                  </td>
                  <td>{Number(line.Quantity).toLocaleString('en-IN')}</td>
                  <td>{Number(line.RatePerBrick || line.Rate || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                    {Number(line.LineAmount || (line.Quantity * (line.RatePerBrick || line.Rate || 0))).toFixed(2)}
                  </td>
                </tr>
              ))}
              {/* Spacer rows — pad to minimum 6 rows like physical book */}
              {[...Array(Math.max(0, 6 - (invoice.lines?.length || 0)))].map((_, i) => (
                <tr key={`spacer-${i}`} style={{ height: '34px' }}>
                  <td /><td /><td /><td /><td /><td /><td />
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── FOOTER BLOCK ──
              LEFT  (58%): Bank Details + Rupees in words
              RIGHT (42%): Tax summary table + "For <signatory>" label
          ── */}
          <div className="bp-footer">

            {/* LEFT */}
            <div className="bp-footer-left">
              <div className="bp-bank-title">Bank Details :</div>
              <div className="bp-bank-body">
                Bank : <strong>{BUSINESS.bank}</strong><br />
                Branch : {BUSINESS.branch}<br />
                A/c. No. : <strong>{BUSINESS.accountNo}</strong><br />
                IFSC : <strong>{BUSINESS.ifsc}</strong>
              </div>

              {/* Rupees in words */}
              <div className="bp-rupees-section">
                <div className="bp-rupees-line">
                  <span style={{ whiteSpace: 'nowrap' }}>Rupees</span>
                  <span className="bp-rupees-dotline">
                    {convertNumberToWords(invoice.TotalAmount)}
                  </span>
                </div>
                {/* Second dotted continuation line */}
                <span className="bp-rupees-dotline2" />
              </div>
            </div>

            {/* RIGHT: Totals */}
            <div className="bp-footer-right">
              <table className="bp-totals-table">
                <tbody>
                  <tr>
                    <td className="bp-totals-label">TOTAL</td>
                    <td className="bp-totals-blank" />
                    <td className="bp-totals-val">{Number(invoice.Subtotal || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="bp-totals-label">CGST @ {Number(invoice.CGSTRate || 9).toFixed(1)}%</td>
                    <td className="bp-totals-blank" />
                    <td className="bp-totals-val">{Number(invoice.CGSTAmount || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="bp-totals-label">SGST @ {Number(invoice.SGSTRate || 9).toFixed(1)}%</td>
                    <td className="bp-totals-blank" />
                    <td className="bp-totals-val">{Number(invoice.SGSTAmount || 0).toFixed(2)}</td>
                  </tr>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td className="bp-totals-label">GRAND TOTAL</td>
                    <td className="bp-totals-blank" />
                    <td className="bp-totals-val" style={{ fontSize: '13px' }}>
                      {Number(invoice.TotalAmount || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {/* "For <signatory>" label sits inside the totals box, below GRAND TOTAL */}
              <div className="bp-for-company">For <strong>{BUSINESS.signatory}</strong></div>
            </div>

          </div>{/* end bp-footer */}

          {/* ── SIGNATURE AREA ── */}
          <div className="bp-sig-area">
            <div className="bp-system-note">* System Assimilated Book Record Copy</div>
            <div className="bp-sig-block">
              <span style={{ fontSize: '12px' }}>For <strong>{BUSINESS.signatory}</strong></span>
              <br />
              <span className="bp-sig-line">Authorised Signatory</span>
            </div>
          </div>

        </div>{/* end bp-wrap */}
      </Modal>
    </div>
  );
}