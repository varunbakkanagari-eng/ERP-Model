import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

 const BUSINESS = {
  name: 'DUMMY ENTERPRISES',
  gstin: '22AAAAA0000A1Z5',
  phone: 'Cell : 9876543210',
  address: '123 Dummy Street, Dummy City, Dummy State, 123456',
  email: 'dummy@example.com',
  bank: 'DUMMY BANK',
  branch: 'Dummy Branch',
  accountNo: '0000000000000000',
  ifsc: 'DUMM0000123',
  signatory: 'Dummy Signatory',
};

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
  if (num >= 100000) { str += getBelowThousand(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
  if (num >= 1000) { str += getBelowThousand(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
  if (num > 0) { str += getBelowThousand(num); }
  return str.trim() + ' Only';
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteOption, setDeleteOption] = useState('full');
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    invoiceAPI.getOne(id)
      .then(r => setInv(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleteInvoice = async () => {
    setDeleteModal(false);
    setLoading(true);

    try {
      if (deleteOption === 'full') {
        await invoiceAPI.delete(inv.InvoiceID, { params: { restoreStock: true } });
        toast('Invoice deleted. Stock and balance updated.');
      } else {
        await invoiceAPI.delete(inv.InvoiceID, { params: { restoreStock: false } });
        toast('Invoice record dropped successfully.');
      }
      nav('/history', { replace: true });
    } catch (e) {
      setLoading(false);
      toast(e.message || 'Server response timeout', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!inv) return <div className="empty-state"><div className="empty-text">Invoice not found</div></div>;

  const totalPaid = inv.payments?.reduce((a, p) => a + parseFloat(p.Amount || 0), 0) || 0;
  const balance = parseFloat(inv.TotalAmount || 0) - totalPaid;
  const fmtInvoiceDate = inv.InvoiceDate
    ? new Date(inv.InvoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="fade-in">
      <style>{`
        /* --- Dynamic Local Styles for Print Alignment --- */
        .bp-wrap {
          background: #ffffff;
          color: #000000;
          font-family: 'Inter', -apple-system, sans-serif;
          padding: 28px;
          border: 1px solid #000000;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          max-width: 800px;
          margin: 0 auto 24px auto;
          box-sizing: border-box;
        }
        .bp-top-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .bp-top-left   { text-align: left; }
        .bp-top-center {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          text-decoration: underline;
          flex: 1;
        }
        .bp-top-right  { text-align: right; white-space: nowrap; }
        .bp-company-name {
          text-align: center;
          font-size: 26px;
          font-weight: 900;
          color: #000000;
          margin: 4px 0;
          letter-spacing: 0.5px;
        }
        .bp-addr-center {
          text-align: center;
          font-size: 11.5px;
          color: #111111;
          margin-bottom: 20px;
          line-height: 1.4;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
        }
        .bp-no-date-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: bold;
        }
        .bp-field-left  { display: flex; align-items: flex-end; width: 48%; }
        .bp-field-right { display: flex; align-items: flex-end; width: 40%; justify-content: flex-end; }
        .bp-dotline { border-bottom: 1px dotted #333333; flex: 1; margin-left: 6px; height: 18px; }
        .bp-dotline-val {
          border-bottom: 1px dotted #333333;
          flex: 1;
          margin-left: 6px;
          height: 18px;
          padding-left: 8px;
          font-weight: bold;
          font-size: 13.5px;
        }
        .bp-ms-row {
          display: flex;
          align-items: flex-end;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 12px;
        }
        .bp-ms-value {
          border-bottom: 1px dotted #333333;
          flex: 1;
          margin-left: 6px;
          height: 18px;
          padding-left: 8px;
          font-weight: bold;
        }
        .bp-gstin-row {
          display: flex;
          align-items: flex-end;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 16px;
          width: 50%;
        }
        .bp-gstin-label { white-space: nowrap; font-weight: bold; }
        .bp-gstin-val {
          border-bottom: 1px dotted #333333;
          flex: 1;
          margin-left: 6px;
          height: 18px;
          padding-left: 8px;
          font-weight: bold;
        }
        .bp-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
        .bp-table th {
          border: 1px solid #000000;
          padding: 8px 4px;
          font-size: 12px;
          font-weight: bold;
          text-align: center;
          background: #f8fafc;
        }
        .bp-table td {
          border: 1px solid #000000;
          padding: 6px 6px;
          font-size: 13px;
          text-align: center;
          height: 32px;
        }
        .bp-footer {
          display: flex;
          width: 100%;
          border-left:   1px solid #000000;
          border-right:  1px solid #000000;
          border-bottom: 1px solid #000000;
        }
        .bp-footer-left {
          flex: 1;
          padding: 12px;
          border-right: 1px solid #000000;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .bp-bank-title { font-size: 12px; font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
        .bp-bank-body  { font-size: 11.5px; line-height: 1.5; }
        .bp-rupees-section { margin-top: 12px; }
        .bp-rupees-line {
          display: flex;
          align-items: flex-end;
          font-size: 13px;
          font-weight: bold;
        }
        .bp-rupees-dotline {
          border-bottom: 1px dotted #333333;
          flex: 1;
          height: 18px;
          margin-left: 6px;
          font-size: 12px;
          font-style: italic;
          font-weight: bold;
          line-height: 16px;
          overflow: hidden;
          white-space: nowrap;
        }
        .bp-footer-right { width: 42%; }
        .bp-totals-table { width: 100%; border-collapse: collapse; }
        .bp-totals-table td {
          border-bottom: 1px solid #000000;
          padding: 8px;
          font-size: 12px;
          color: #000000;
          height: 30px;
        }
        .bp-totals-table tr:last-child td { border-bottom: none; }
        .bp-totals-label { font-weight: bold; border-right: 1px solid #000000; white-space: nowrap; }
        .bp-totals-blank { width: 10%; border-right: 1px solid #000000; }
        .bp-totals-val   { text-align: right; padding-right: 8px !important; font-weight: bold; font-size: 12.5px; }
        
        .bp-sig-area {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
          width: 100%;
        }
        .bp-system-note { font-style: italic; font-size: 9.5px; color: #555555; }
        .bp-sig-block   { text-align: right; min-width: 220px; }
        .bp-sig-line {
          display: inline-block;
          width: 180px;
          border-top: 1px solid #000000;
          padding-top: 4px;
          font-size: 12px;
          text-align: center;
          margin-top: 40px;
          font-weight: 500;
        }

        /* --- Print Mode Styles --- */
        @media print {
          .sidebar, .topbar, .no-print, .back-btn, .btn, .flex-between {
            display: none !important;
          }
          body, .app-shell, .main-content, .page-content {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .bp-wrap {
            border: 1px solid #000000 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 14px !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            box-sizing: border-box;
          }
        }
      `}</style>

      <div className="flex-between mb-16 no-print" style={{ flexWrap: 'wrap', gap: 10 }}>
        <button className="back-btn" onClick={() => nav('/history')}>← Back to History</button>
        <div className="flex-gap">
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 Print Invoice</button>
          <button className="btn btn-danger btn-sm" style={{ backgroundColor: '#b91c1c' }} onClick={() => setDeleteModal(true)}>🗑 Delete Invoice</button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          SRI LAXMI BRICK INDUSTRY TAX INVOICE
      ════════════════════════════════════════════ */}
      <div className="bp-wrap">
        {/* ── TOP ROW: GSTIN | TAX INVOICE | Cell ── */}
        <div className="bp-top-row">
          <div className="bp-top-left">GSTIN : {BUSINESS.gstin}</div>
          <div className="bp-top-center">TAX INVOICE</div>
          <div className="bp-top-right">{BUSINESS.phone}</div>
        </div>

        {/* ── COMPANY NAME ── */}
        <div className="bp-company-name">{BUSINESS.name}</div>

        {/* ── ADDRESS BLOCK ── */}
        <div className="bp-addr-center">
          {BUSINESS.address}<br />
          Email : {BUSINESS.email}
        </div>

        {/* ── No. / Date ROW ── */}
        <div className="bp-no-date-row">
          <div className="bp-field-left">
            <span>No.</span>
            <span className="bp-dotline-val">{inv.InvoiceNumber}</span>
          </div>
          <div className="bp-field-right">
            <span>Date</span>
            <span className="bp-dotline-val">{fmtInvoiceDate}</span>
          </div>
        </div>

        {/* ── M/s. LINE ── */}
        <div className="bp-ms-row">
          <span>M/s.</span>
          <span className="bp-ms-value">{inv.CustomerName}</span>
        </div>

        {/* ── GSTIN ROW ── */}
        <div className="bp-gstin-row">
          <span className="bp-gstin-label">GSTIN</span>
          <span className="bp-gstin-val">{inv.CustomerGSTIN || '___________________________'}</span>
        </div>

        {/* ── MAIN 7-COLUMN TABLE ── */}
        <table className="bp-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>S. No.</th>
              <th style={{ width: '13%' }}>Receipt No.</th>
              <th style={{ width: '13%' }}>Date</th>
              <th>PARTICULARS</th>
              <th style={{ width: '10%' }}>Qty.</th>
              <th style={{ width: '10%' }}>Rate</th>
              <th style={{ width: '15%' }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l, i) => (
              <tr key={l.InvoiceLineID || i}>
                <td>{i + 1}</td>
                <td>{l.ReceiptNo || ''}</td>
                <td>
                  {l.ReceiptDate
                    ? new Date(l.ReceiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : fmtInvoiceDate}
                </td>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }}>
                  Bricks {l.SizeInch} {l.SizeMM ? `(${l.SizeMM})` : ''}
                </td>
                <td>{Number(l.Quantity || 0).toLocaleString('en-IN')}</td>
                <td>{parseFloat(l.RatePerBrick || 0).toFixed(2)}</td>
                <td style={{ textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                  {parseFloat(l.LineAmount || 0).toFixed(2)}
                </td>
              </tr>
            ))}
            {/* Spacer rows — pad to minimum 5 rows to match classic bill pad look */}
            {[...Array(Math.max(0, 5 - (inv.lines?.length || 0)))].map((_, i) => (
              <tr key={`spacer-${i}`}>
                <td /><td /><td /><td /><td /><td /><td />
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── FOOTER SUMMARY BLOCK ── */}
        <div className="bp-footer">
          {/* Left Side: Bank Details & Rupees in words */}
          <div className="bp-footer-left">
            <div>
              <div className="bp-bank-title">Bank Details :</div>
              <div className="bp-bank-body">
                Bank : <strong>{BUSINESS.bank}</strong><br />
                Branch : {BUSINESS.branch}<br />
                A/c. No. : <strong>{BUSINESS.accountNo}</strong><br />
                IFSC : <strong>{BUSINESS.ifsc}</strong>
              </div>
            </div>

            {/* Rupees in Words */}
            <div className="bp-rupees-section">
              <div className="bp-rupees-line">
                <span style={{ whiteSpace: 'nowrap' }}>Rupees</span>
                <span className="bp-rupees-dotline">
                  {convertNumberToWords(inv.TotalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Tax Summary Table */}
          <div className="bp-footer-right">
            <table className="bp-totals-table">
              <tbody>
                <tr>
                  <td className="bp-totals-label">TOTAL</td>
                  <td className="bp-totals-blank" />
                  <td className="bp-totals-val">{parseFloat(inv.Subtotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="bp-totals-label">CGST @ {parseFloat(inv.CGSTRate || 9)}%</td>
                  <td className="bp-totals-blank" />
                  <td className="bp-totals-val">{parseFloat(inv.CGSTAmount || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="bp-totals-label">SGST @ {parseFloat(inv.SGSTRate || 9)}%</td>
                  <td className="bp-totals-blank" />
                  <td className="bp-totals-val">{parseFloat(inv.SGSTAmount || 0).toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 'bold' }}>
                  <td className="bp-totals-label">GRAND TOTAL</td>
                  <td className="bp-totals-blank" />
                  <td className="bp-totals-val" style={{ fontSize: '13.5px' }}>
                    {parseFloat(inv.TotalAmount || 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SIGNATURE AREA ── */}
        <div className="bp-sig-area">
          <div className="bp-system-note">* System Generated Record Copy</div>
          <div className="bp-sig-block">
            <span style={{ fontSize: '12.5px', fontWeight: 'bold' }}>For {BUSINESS.signatory}</span>
            <br />
            <span className="bp-sig-line">Authorised Signatory</span>
          </div>
        </div>
      </div>

      {/* ── ON-SCREEN PAYMENT HISTORY (Only visible on Dashboard, hidden on print) ── */}
      {inv.payments?.length > 0 && (
        <div className="card no-print" style={{ marginTop: 24, maxWidth: 800, margin: '24px auto 0 auto' }}>
          <div className="card-title">Payment History</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p, i) => (
                <tr key={i}>
                  <td>{p.PaymentDate?.split('T')[0]}</td>
                  <td><span className="badge badge-blue">{p.PaymentMode}</span></td>
                  <td className="text-gray">{p.Reference || '—'}</td>
                  <td style={{ textAlign: 'right' }}><strong className="text-green">{fmt(p.Amount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, fontSize: 13, gap: 16 }}>
            <span>Total Paid: <strong style={{ color: 'var(--green)' }}>{fmt(totalPaid)}</strong></span>
            <span>Balance Due: <strong style={{ color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(balance)}</strong></span>
          </div>
        </div>
      )}

      {/* Delete Invoice Modal */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="⚠️ Delete Invoice Confirmation">
        <div style={{ fontSize: 14, marginBottom: 16 }}>
          Choose how to handle the deletion for Invoice <strong>{inv.InvoiceNumber}</strong>:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', gap: 10, background: 'var(--gray8)', padding: 12, borderRadius: 6, cursor: 'pointer' }}>
            <input type="radio" name="deleteOpt" value="full" checked={deleteOption === 'full'} onChange={() => setDeleteOption('full')} />
            <div>
              <strong>1. Full Delete (Restore Stock)</strong>
              <div style={{ fontSize: 12, color: 'var(--gray3)' }}>Reverts brick quantities back into warehouse inventory stock profiles automatically.</div>
            </div>
          </label>
          <label style={{ display: 'flex', gap: 10, background: 'var(--gray8)', padding: 12, borderRadius: 6, cursor: 'pointer' }}>
            <input type="radio" name="deleteOpt" value="recordOnly" checked={deleteOption === 'recordOnly'} onChange={() => setDeleteOption('recordOnly')} />
            <div>
              <strong>2. Hard Delete Record Only</strong>
              <div style={{ fontSize: 12, color: 'var(--gray3)' }}>Drops the invoice layout out of your history lists entirely without altering current stock counts.</div>
            </div>
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setDeleteModal(false)}>Cancel</button>
          <button className="btn btn-danger" style={{ backgroundColor: '#b91c1c' }} onClick={handleDeleteInvoice}>Confirm Deletion</button>
        </div>
      </Modal>
    </div>
  );
}
