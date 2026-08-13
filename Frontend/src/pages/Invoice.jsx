import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI, stockAPI, invoiceAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Invoice() {
  const { user } = useAuth();
  const isGuest = user?.Role === 'GUEST';

  const [customers, setCustomers] = useState([]);
  const [stock, setStock] = useState([]);
  const [custId, setCustId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState([]);
  const [selBrick, setSelBrick] = useState('');
  const [selQty, setSelQty] = useState('');
  const [selRate, setSelRate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([customerAPI.getAll(), stockAPI.getAll()])
      .then(([cr, sr]) => { setCustomers(cr.data || []); setStock(sr.data || []); });
  }, []);

  const selectedCust = customers.find(c => c.CustomerID === parseInt(custId));
  const selectedBrick = stock.find(s => s.BrickID === parseInt(selBrick));

  const handleBrickChange = (e) => {
    const b = stock.find(s => s.BrickID === parseInt(e.target.value));
    setSelBrick(e.target.value);
    setSelRate(b ? String(b.CostPerBrick) : '');
    setSelQty(b ? String(b.TripQty) : '');
  };

  const addLine = () => {
    if (!selBrick || !selQty || !selRate) { toast('Select brick, quantity, and rate', 'error'); return; }
    const brick = stock.find(s => s.BrickID === parseInt(selBrick));
    const qty = parseInt(selQty); const rate = parseFloat(selRate);
    const existing = lines.findIndex(l => l.brickID === brick.BrickID);
    if (existing >= 0) {
      const upd = [...lines];
      upd[existing] = { ...upd[existing], quantity: upd[existing].quantity + qty, lineAmount: (upd[existing].quantity + qty) * upd[existing].ratePerBrick };
      setLines(upd);
    } else {
      setLines([...lines, { brickID: brick.BrickID, sizeInch: brick.SizeInch, sizeMM: brick.SizeMM, quantity: qty, ratePerBrick: rate, lineAmount: qty * rate }]);
    }
    setSelBrick(''); setSelQty(''); setSelRate('');
  };

  const updateLine = (i, field, val) => {
    const upd = [...lines];
    upd[i] = { ...upd[i], [field]: field === 'quantity' ? parseInt(val) || 0 : parseFloat(val) || 0 };
    upd[i].lineAmount = upd[i].quantity * upd[i].ratePerBrick;
    setLines(upd);
  };
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((a, l) => a + l.lineAmount, 0);
  const cgst = parseFloat((subtotal * 0.09).toFixed(2));
  const sgst = parseFloat((subtotal * 0.09).toFixed(2));
  const total = subtotal + cgst + sgst;

  const handleSubmit = async () => {
    if (!custId) { toast('Select a customer', 'error'); return; }
    if (!lines.length) { toast('Add at least one item', 'error'); return; }
    setSaving(true);
    try {
      const res = await invoiceAPI.create({
        customerID: parseInt(custId), invoiceDate: date, lines: lines.map(l => ({
          brickID: l.brickID, quantity: l.quantity, ratePerBrick: l.ratePerBrick
        })), notes
      });
      toast(`${res.data.invoiceNumber} generated!`);
      nav(`/history/${res.data.invoiceID}`);
    } catch (e) { toast(e.message, 'error'); setSaving(false); }
  };

  return (
    <div className="fade-in">
      <div className="grid-2">
        {/* Left column */}
        <div>
          <div className="card">
            <div className="card-title">Invoice Details</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input className="form-input" value="Auto-generated" readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Customer *</label>
              <select className="form-select" value={custId} onChange={e => setCustId(e.target.value)}>
                <option value="">— Select Customer —</option>
                {customers.map(c => <option key={c.CustomerID} value={c.CustomerID}>{c.FullName} ({c.Phone})</option>)}
              </select>
            </div>
            {selectedCust && (
              <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--gray3)' }}>
                <strong style={{ color: 'var(--gray1)' }}>{selectedCust.FullName}</strong> · {selectedCust.Phone}
                {selectedCust.Address && <><br />{selectedCust.Address}</>}
                <br />Balance: <strong style={{ color: selectedCust.Balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(selectedCust.Balance)}</strong>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Add Brick Item</div>
            <div className="form-group">
              <label className="form-label">Brick Size</label>
              <select className="form-select" value={selBrick} onChange={handleBrickChange}>
                <option value="">— Select Brick Size —</option>
                {stock.map(s => (
                  <option key={s.BrickID} value={s.BrickID}>
                    {s.SizeInch} | {s.SizeMM} | ₹{s.CostPerBrick} | Stock: {s.Quantity}
                  </option>
                ))}
              </select>
            </div>
            {selectedBrick && (
              <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--gray3)', marginBottom: 12 }}>
                <strong>{selectedBrick.SizeInch}</strong> ({selectedBrick.SizeMM}) · ₹{selectedBrick.CostPerBrick}/brick ·
                Available: <strong style={{ color: selectedBrick.Quantity > 0 ? 'var(--green)' : 'var(--red)' }}>{selectedBrick.Quantity} nos</strong>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity (nos)</label>
                <input className="form-input" type="number" value={selQty} onChange={e => setSelQty(e.target.value)} placeholder="e.g. 800" />
              </div>
              <div className="form-group">
                <label className="form-label">Rate / Brick (₹) <span>editable</span></label>
                <input className="form-input" type="number" step="0.01" value={selRate} onChange={e => setSelRate(e.target.value)} placeholder="Auto-filled" />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={isGuest} onClick={addLine}>+ Add to Invoice</button>
          </div>

          <div className="form-group">
            <label className="form-label">Notes <span>(optional)</span></label>
            <textarea className="form-textarea" placeholder="Any notes for this invoice..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Right column — summary */}
        <div>
          <div className="card">
            <div className="card-title">Invoice Summary</div>
            {lines.length ? (
              <table className="data-table" style={{ marginBottom: 8 }}>
                <thead><tr><th>Brick</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{l.sizeInch}</strong><br />
                        <span className="text-sm text-gray">{l.sizeMM}</span>
                      </td>
                      <td>
                        <input type="number" className="form-input" style={{ width: 72, padding: '4px 6px', fontSize: 13 }}
                          disabled={isGuest} value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-input" style={{ width: 72, padding: '4px 6px', fontSize: 13 }}
                          disabled={isGuest} value={l.ratePerBrick} onChange={e => updateLine(i, 'ratePerBrick', e.target.value)} />
                      </td>
                      <td><strong>{fmt(l.lineAmount)}</strong></td>
                      <td><button className="btn btn-danger btn-sm" disabled={isGuest} onClick={() => removeLine(i)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-text">No items added. Select a brick and add.</div>
              </div>
            )}

            {lines.length > 0 && (
              <>
                <div className="divider" />
                <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 14 }}>
                  <div className="inv-total-row"><span className="text-gray">Subtotal</span><span>{fmt(subtotal)}</span></div>
                  <div className="inv-total-row"><span className="text-gray">CGST @ 9%</span><span>{fmt(cgst)}</span></div>
                  <div className="inv-total-row"><span className="text-gray">SGST @ 9%</span><span>{fmt(sgst)}</span></div>
                  <div className="inv-total-row grand"><span>Grand Total</span><span className="text-blue">{fmt(total)}</span></div>
                </div>
              </>
            )}

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleSubmit} disabled={saving || !lines.length || !custId || isGuest}>
                {saving ? 'Generating...' : '✓ Generate Invoice'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setLines([]); setCustId(''); setNotes(''); }}>Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
