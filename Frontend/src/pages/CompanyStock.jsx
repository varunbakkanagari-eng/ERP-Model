import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyStockAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const fmt  = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtQ = (n, unit) => `${Number(n || 0).toLocaleString('en-IN')} ${unit || ''}`;
const statusColor = (s) =>
  ({ PAID: 'badge-green', UNPAID: 'badge-red', PARTIAL: 'badge-orange' }[s] || 'badge-gray');

const TABS = ['Stock', 'Purchases', 'Suppliers', 'Payments'];

/* ═══════════════════════════════════════════════════════════ */
export default function CompanyStock() {
  const [tab, setTab] = useState('Stock');

  return (
    <div className="fade-in">
      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--gray6)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '9px 20px',
              border: 'none',
              background: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              color: tab === t ? 'var(--blue)' : 'var(--gray3)',
              borderBottom: tab === t ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'color 0.12s',
            }}
          >
            {t === 'Stock' && '📦 '}
            {t === 'Purchases' && '🛒 '}
            {t === 'Suppliers' && '🏭 '}
            {t === 'Payments' && '💳 '}
            {t}
          </button>
        ))}
      </div>

      {tab === 'Stock'     && <StockTab />}
      {tab === 'Purchases' && <PurchasesTab />}
      {tab === 'Suppliers' && <SuppliersTab />}
      {tab === 'Payments'  && <AllPaymentsTab />}
    </div>
  );
}

/* ─── STOCK TAB ─────────────────────────────────────────────── */
function StockTab() {
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [matModal, setMatModal]   = useState(false);
  const [editMat, setEditMat]     = useState(null);
  const [matForm, setMatForm]     = useState({ name: '', unit: 'Bag', lowStockAlert: 50, notes: '' });
  const [useModal, setUseModal]   = useState(null);
  const [adjModal, setAdjModal]   = useState(null);
  const [txnModal, setTxnModal]   = useState(null);
  const [txns, setTxns]           = useState([]);
  const [opForm, setOpForm]       = useState({ quantity: '', note: '' });

  const load = useCallback(() => {
    setLoading(true);
    companyStockAPI.getMaterials()
      .then(r => setMaterials(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openAddMat  = () => { setEditMat(null); setMatForm({ name: '', unit: 'Bag', lowStockAlert: 50, notes: '' }); setMatModal(true); };
  const openEditMat = (m) => {
    setEditMat(m);
    setMatForm({ name: m.Name, unit: m.Unit, lowStockAlert: m.LowStockAlert, notes: m.Notes || '' });
    setMatModal(true);
  };

  const saveMat = async () => {
    if (!matForm.name.trim()) { toast('Name required', 'error'); return; }
    try {
      if (editMat) {
        await companyStockAPI.updateMaterial(editMat.MaterialID, matForm);
        toast('Material updated');
      } else {
        await companyStockAPI.createMaterial(matForm);
        toast('Material added');
      }
      setMatModal(false); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const deleteMat = async (m) => {
    if (!window.confirm(`Remove material "${m.Name}"?`)) return;
    try {
      await companyStockAPI.deleteMaterial(m.MaterialID);
      toast('Removed'); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleUse = async () => {
    if (!opForm.quantity || parseFloat(opForm.quantity) <= 0) { toast('Enter valid quantity', 'error'); return; }
    try {
      await companyStockAPI.useStock({ materialID: useModal.MaterialID, quantity: parseFloat(opForm.quantity), note: opForm.note });
      toast(`${opForm.quantity} ${useModal.Unit} deducted`);
      setUseModal(null); setOpForm({ quantity: '', note: '' }); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleAdj = async () => {
    try {
      await companyStockAPI.adjustStock({ materialID: adjModal.MaterialID, quantity: parseFloat(opForm.quantity), note: opForm.note });
      toast('Stock adjusted'); setAdjModal(null); setOpForm({ quantity: '', note: '' }); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const openTxns = async (m) => {
    setTxnModal(m);
    try {
      const r = await companyStockAPI.getTransactions(m.MaterialID);
      setTxns(r.data);
    } catch (e) { toast(e.message, 'error'); }
  };

  const totalValue = materials.reduce((a, m) => a + m.Quantity * 0, 0); // cost not tracked here

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="flex-between mb-16">
        <div style={{ fontSize: 13, color: 'var(--gray3)' }}>
          {materials.length} material type(s) tracked
        </div>
        <button className="btn btn-primary" onClick={openAddMat}>+ Add Material</button>
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Material</th><th>Unit</th><th>In Stock</th>
                <th>Alert Level</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.length ? materials.map((m, i) => {
                const low = m.Quantity <= m.LowStockAlert;
                return (
                  <tr key={m.MaterialID}>
                    <td className="text-gray">{i + 1}</td>
                    <td><strong>{m.Name}</strong>{m.Notes && <div className="text-sm text-gray">{m.Notes}</div>}</td>
                    <td className="text-gray">{m.Unit}</td>
                    <td>
                      <span className={`badge ${m.Quantity === 0 ? 'badge-red' : low ? 'badge-orange' : 'badge-green'}`}>
                        {fmtQ(m.Quantity, m.Unit)}
                      </span>
                    </td>
                    <td className="text-gray">{m.LowStockAlert} {m.Unit}</td>
                    <td>
                      {m.Quantity === 0
                        ? <span className="badge badge-red">Out of Stock</span>
                        : low
                          ? <span className="badge badge-orange">Low Stock</span>
                          : <span className="badge badge-green">OK</span>}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-danger btn-sm"
                          onClick={() => { setUseModal(m); setOpForm({ quantity: '', note: '' }); }}>
                          − Use
                        </button>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => { setAdjModal(m); setOpForm({ quantity: String(m.Quantity), note: '' }); }}>
                          Adjust
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openTxns(m)}>
                          History
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditMat(m)}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteMat(m)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <div className="empty-text">No materials yet. Add Cement, Metal 6mm, Dust, etc.</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Material */}
      <Modal open={matModal} onClose={() => setMatModal(false)} title={editMat ? 'Edit Material' : 'Add Material'}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input className="form-input" value={matForm.name}
              onChange={e => setMatForm({ ...matForm, name: e.target.value })} autoFocus placeholder="e.g. Cement" />
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <select className="form-select" value={matForm.unit} onChange={e => setMatForm({ ...matForm, unit: e.target.value })}>
              {['Bag', 'KG', 'Ton', 'CFT', 'Load', 'KL', 'Litre', 'Nos', 'Meter'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Low Stock Alert Level</label>
          <input className="form-input" type="number" value={matForm.lowStockAlert}
            onChange={e => setMatForm({ ...matForm, lowStockAlert: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes <span>(optional)</span></label>
          <input className="form-input" value={matForm.notes}
            onChange={e => setMatForm({ ...matForm, notes: e.target.value })} placeholder="e.g. OPC 53 Grade" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setMatModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={saveMat}>{editMat ? 'Save Changes' : 'Add Material'}</button>
        </div>
      </Modal>

      {/* Use Stock Modal */}
      <Modal open={!!useModal} onClose={() => setUseModal(null)} title={`Use Stock — ${useModal?.Name}`}>
        <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
          Available: <strong>{fmtQ(useModal?.Quantity, useModal?.Unit)}</strong>
        </div>
        <div className="form-group">
          <label className="form-label">Quantity to Deduct ({useModal?.Unit})</label>
          <input className="form-input" type="number" step="0.01" value={opForm.quantity}
            onChange={e => setOpForm({ ...opForm, quantity: e.target.value })} autoFocus placeholder="e.g. 10" />
        </div>
        <div className="form-group">
          <label className="form-label">Note <span>(optional)</span></label>
          <input className="form-input" value={opForm.note}
            onChange={e => setOpForm({ ...opForm, note: e.target.value })} placeholder="e.g. Used in production batch #5" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setUseModal(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleUse}>Deduct Stock</button>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal open={!!adjModal} onClose={() => setAdjModal(null)} title={`Adjust Stock — ${adjModal?.Name}`}>
        <div className="form-group">
          <label className="form-label">Set Quantity to ({adjModal?.Unit})</label>
          <input className="form-input" type="number" step="0.01" value={opForm.quantity}
            onChange={e => setOpForm({ ...opForm, quantity: e.target.value })} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-input" value={opForm.note}
            onChange={e => setOpForm({ ...opForm, note: e.target.value })} placeholder="e.g. Physical count correction" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setAdjModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdj}>Set Quantity</button>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal open={!!txnModal} onClose={() => setTxnModal(null)} title={`History — ${txnModal?.Name}`} wide>
        {txns.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Qty</th><th>PO #</th><th>Note</th></tr>
              </thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.TxnID}>
                    <td className="text-sm text-gray">{t.TransactionDate?.split('T')[0]}</td>
                    <td>
                      <span className={`badge ${t.ChangeType === 'IN' ? 'badge-green' : t.ChangeType === 'OUT' ? 'badge-red' : 'badge-blue'}`}>
                        {t.ChangeType}
                      </span>
                    </td>
                    <td><strong>{t.Quantity}</strong></td>
                    <td className="text-sm text-gray">{t.PONumber || '—'}</td>
                    <td className="text-sm text-gray">{t.Note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><div className="empty-text">No transactions yet</div></div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setTxnModal(null)}>Close</button>
        </div>
      </Modal>
    </>
  );
}

/* ─── PURCHASES TAB ─────────────────────────────────────────── */
function PurchasesTab() {
  const toast    = useToast();
  const nav      = useNavigate();
  const [purchases, setPurchases]   = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [materials, setMaterials]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('ALL');
  const [modal, setModal]           = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [editModal, setEditModal]   = useState(null);
  const [payModal, setPayModal]     = useState(null);

  // PO form
  const emptyPO = { supplierID: '', supplierName: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '', isCreditBuy: false };
  const [poForm, setPoForm]         = useState(emptyPO);
  const [lines, setLines]           = useState([]);
  const [lineForm, setLineForm]     = useState({ materialID: '', quantity: '', unitPrice: '' });

  // Payment form
  const emptyPay = { amount: '', paymentMode: 'CASH', reference: '', notes: '' };
  const [payForm, setPayForm]       = useState(emptyPay);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      companyStockAPI.getPurchases(),
      companyStockAPI.getSuppliers(),
      companyStockAPI.getMaterials(),
    ])
      .then(([pr, sr, mr]) => {
        setPurchases(pr.data); setSuppliers(sr.data); setMaterials(mr.data);
      })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const addLine = () => {
    if (!lineForm.materialID || !lineForm.quantity || !lineForm.unitPrice) {
      toast('Select material, quantity and price', 'error'); return;
    }
    const mat = materials.find(m => m.MaterialID === parseInt(lineForm.materialID));
    const qty = parseFloat(lineForm.quantity);
    const price = parseFloat(lineForm.unitPrice);
    setLines([...lines, {
      materialID: mat.MaterialID, materialName: mat.Name, unit: mat.Unit,
      quantity: qty, unitPrice: price, lineAmount: qty * price,
    }]);
    setLineForm({ materialID: '', quantity: '', unitPrice: '' });
  };

  const subtotal = lines.reduce((a, l) => a + l.lineAmount, 0);

  const savePO = async () => {
    if (!lines.length) { toast('Add at least one item', 'error'); return; }
    setSaving(true);
    try {
      const res = await companyStockAPI.createPurchase({
        supplierID:   poForm.supplierID ? parseInt(poForm.supplierID) : null,
        supplierName: poForm.supplierName || null,
        purchaseDate: poForm.purchaseDate,
        lines: lines.map(l => ({ materialID: l.materialID, quantity: l.quantity, unitPrice: l.unitPrice })),
        notes:        poForm.notes,
        isCreditBuy:  poForm.isCreditBuy,
      });
      toast(`${res.data.poNumber} created!`);
      setModal(false); setPoForm(emptyPO); setLines([]); load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await companyStockAPI.updatePurchase(editModal.POID, {
        supplierID:   editModal.supplierID ? parseInt(editModal.supplierID) : null,
        supplierName: editModal.supplierName || null,
        purchaseDate: editModal.purchaseDate,
        notes:        editModal.notes,
        isCreditBuy:  editModal.isCreditBuy,
      });
      toast('Purchase order updated'); setEditModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const deletePO = async (po) => {
    if (!window.confirm(`Delete PO ${po.PONumber}? This will also delete all payments and restore stock.`)) return;
    try {
      await companyStockAPI.deletePurchase(po.POID);
      toast('Purchase order deleted'); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const openDetail = async (po) => {
    try {
      const r = await companyStockAPI.getPurchase(po.POID);
      setDetailModal(r.data);
    } catch (e) { toast(e.message, 'error'); }
  };

  const savePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast('Enter valid amount', 'error'); return; }
    setSaving(true);
    try {
      await companyStockAPI.createPayment({
        poID:        payModal.POID,
        supplierID:  payModal.SupplierID || null,
        amount:      parseFloat(payForm.amount),
        paymentMode: payForm.paymentMode,
        reference:   payForm.reference || null,
        notes:       payForm.notes || null,
      });
      toast('Payment recorded'); setPayModal(null); setPayForm(emptyPay); load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const filtered = purchases.filter(p =>
    filter === 'ALL' || p.PaymentStatus === filter
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      {/* Filters & New */}
      <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map(s => (
            <button key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => { setPoForm(emptyPO); setLines([]); setModal(true); }}>
          + New Purchase
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Purchased', val: purchases.reduce((a,p) => a+parseFloat(p.TotalAmount||0),0), color: 'var(--blue)' },
          { label: 'Total Paid', val: purchases.reduce((a,p) => a+parseFloat(p.PaidAmount||0),0), color: 'var(--green)' },
          { label: 'Total Due', val: purchases.reduce((a,p) => a+parseFloat(p.DueAmount||0),0), color: 'var(--red)' },
          { label: 'Credit Buys', val: purchases.filter(p=>p.IsCreditBuy).reduce((a,p) => a+parseFloat(p.TotalAmount||0),0), color: 'var(--orange)' },
        ].map(c => (
          <div key={c.label} className="card" style={{ marginBottom: 0, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color, marginTop: 4 }}>{fmt(c.val)}</div>
          </div>
        ))}
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO #</th><th>Date</th><th>Supplier</th><th>Items</th>
                <th>Total</th><th>Paid</th><th>Due</th><th>Type</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(po => (
                <tr key={po.POID}>
                  <td>
                    <strong style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => openDetail(po)}>
                      {po.PONumber}
                    </strong>
                  </td>
                  <td className="text-sm text-gray">{po.PurchaseDate?.split('T')[0]}</td>
                  <td>{po.SupplierName || <span className="text-gray">—</span>}</td>
                  <td className="text-gray">{po.LineCount}</td>
                  <td><strong>{fmt(po.TotalAmount)}</strong></td>
                  <td className="text-green text-bold">{fmt(po.PaidAmount)}</td>
                  <td><strong style={{ color: po.DueAmount > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(po.DueAmount)}</strong></td>
                  <td>
                    {po.IsCreditBuy
                      ? <span className="badge badge-orange">Credit</span>
                      : <span className="badge badge-blue">Cash</span>}
                  </td>
                  <td><span className={`badge ${statusColor(po.PaymentStatus)}`}>{po.PaymentStatus}</span></td>
                  <td>
                    <div className="actions">
                      {po.PaymentStatus !== 'PAID' && (
                        <button className="btn btn-success btn-sm"
                          onClick={() => {
                            setPayModal({ ...po, DueAmount: po.DueAmount });
                            setPayForm({ ...emptyPay, amount: String(parseFloat(po.DueAmount).toFixed(2)) });
                          }}>
                          + Pay
                        </button>
                      )}
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => setEditModal({
                          POID: po.POID, supplierID: po.SupplierID || '', supplierName: po.SupplierName || '',
                          purchaseDate: po.PurchaseDate?.split('T')[0], notes: po.Notes || '', isCreditBuy: !!po.IsCreditBuy,
                        })}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deletePO(po)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-icon">🛒</div>
                    <div className="empty-text">No purchases found</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="New Purchase Order" wide>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select className="form-select" value={poForm.supplierID}
              onChange={e => setPoForm({ ...poForm, supplierID: e.target.value, supplierName: '' })}>
              <option value="">— Select Supplier —</option>
              {suppliers.map(s => <option key={s.SupplierID} value={s.SupplierID}>{s.Name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Or Enter Supplier Name</label>
            <input className="form-input" value={poForm.supplierName}
              onChange={e => setPoForm({ ...poForm, supplierName: e.target.value, supplierID: '' })}
              placeholder="Free-text supplier" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Purchase Date</label>
            <input className="form-input" type="date" value={poForm.purchaseDate}
              onChange={e => setPoForm({ ...poForm, purchaseDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input type="checkbox" id="creditBuy" checked={poForm.isCreditBuy}
              onChange={e => setPoForm({ ...poForm, isCreditBuy: e.target.checked })} style={{ width: 16, height: 16 }} />
            <label htmlFor="creditBuy" className="form-label" style={{ marginBottom: 0 }}>Bought on Credit</label>
          </div>
        </div>

        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--gray4)', textTransform: 'uppercase', marginBottom: 10 }}>
          Add Material Lines
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 12 }}>
          <select className="form-select" value={lineForm.materialID}
            onChange={e => setLineForm({ ...lineForm, materialID: e.target.value })}>
            <option value="">— Material —</option>
            {materials.map(m => <option key={m.MaterialID} value={m.MaterialID}>{m.Name} ({m.Unit})</option>)}
          </select>
          <input className="form-input" type="number" step="0.01" placeholder="Quantity"
            value={lineForm.quantity} onChange={e => setLineForm({ ...lineForm, quantity: e.target.value })} />
          <input className="form-input" type="number" step="0.01" placeholder="Unit Price ₹"
            value={lineForm.unitPrice} onChange={e => setLineForm({ ...lineForm, unitPrice: e.target.value })} />
          <button className="btn btn-primary" onClick={addLine}>+ Add</button>
        </div>

        {lines.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table className="data-table">
              <thead><tr><th>Material</th><th>Qty</th><th>Price</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td><strong>{l.materialName}</strong> <span className="text-sm text-gray">({l.unit})</span></td>
                    <td>{l.quantity}</td>
                    <td>₹{l.unitPrice}</td>
                    <td><strong>{fmt(l.lineAmount)}</strong></td>
                    <td>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>✕</button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                  <td colSpan={2}><strong className="text-blue">{fmt(subtotal)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Notes <span>(optional)</span></label>
          <input className="form-input" value={poForm.notes}
            onChange={e => setPoForm({ ...poForm, notes: e.target.value })} placeholder="Any notes..." />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={savePO} disabled={saving || !lines.length}>
            {saving ? 'Saving...' : '✓ Create Purchase Order'}
          </button>
        </div>
      </Modal>

      {/* Edit PO Modal */}
      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Purchase Order">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={editModal.supplierID}
                onChange={e => setEditModal({ ...editModal, supplierID: e.target.value })}>
                <option value="">— Select Supplier —</option>
                {suppliers.map(s => <option key={s.SupplierID} value={s.SupplierID}>{s.Name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Or Supplier Name</label>
              <input className="form-input" value={editModal.supplierName}
                onChange={e => setEditModal({ ...editModal, supplierName: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input className="form-input" type="date" value={editModal.purchaseDate}
                onChange={e => setEditModal({ ...editModal, purchaseDate: e.target.value })} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <input type="checkbox" id="editCredit" checked={editModal.isCreditBuy}
                onChange={e => setEditModal({ ...editModal, isCreditBuy: e.target.checked })} style={{ width: 16, height: 16 }} />
              <label htmlFor="editCredit" className="form-label" style={{ marginBottom: 0 }}>Bought on Credit</label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={editModal.notes}
              onChange={e => setEditModal({ ...editModal, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Pay Against ${payModal.PONumber}`}>
          <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
            Total: <strong>{fmt(payModal.TotalAmount)}</strong> &nbsp;·&nbsp;
            Paid: <strong className="text-green">{fmt(payModal.PaidAmount)}</strong> &nbsp;·&nbsp;
            Due: <strong className="text-red">{fmt(payModal.DueAmount)}</strong>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input className="form-input" type="number" step="0.01" value={payForm.amount}
              onChange={e => setPayForm({ ...payForm, amount: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="form-select" value={payForm.paymentMode}
              onChange={e => setPayForm({ ...payForm, paymentMode: e.target.value })}>
              {['CASH','UPI','BANK','CHEQUE','OTHER'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Reference <span>(optional)</span></label>
              <input className="form-input" value={payForm.reference}
                onChange={e => setPayForm({ ...payForm, reference: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes <span>(optional)</span></label>
              <input className="form-input" value={payForm.notes}
                onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-success" onClick={savePayment} disabled={saving}>
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={`PO Detail — ${detailModal.PONumber}`} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gray3)', lineHeight: 1.9 }}>
              <strong className="text-gray1">{detailModal.SupplierDisplayName || '—'}</strong><br />
              Date: {detailModal.PurchaseDate?.split('T')[0]}<br />
              {detailModal.IsCreditBuy && <span className="badge badge-orange">Credit Purchase</span>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.9 }}>
              Total: <strong>{fmt(detailModal.TotalAmount)}</strong><br />
              Paid: <strong className="text-green">{fmt(detailModal.PaidAmount)}</strong><br />
              Due: <strong className="text-red">{fmt(parseFloat(detailModal.TotalAmount) - parseFloat(detailModal.PaidAmount))}</strong>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--gray4)', textTransform: 'uppercase', marginBottom: 8 }}>Items</div>
          <table className="data-table" style={{ marginBottom: 16 }}>
            <thead><tr><th>Material</th><th>Qty</th><th>Unit</th><th>Price</th><th>Amount</th></tr></thead>
            <tbody>
              {detailModal.lines?.map(l => (
                <tr key={l.POLineID}>
                  <td><strong>{l.MaterialName}</strong></td>
                  <td>{l.Quantity}</td><td className="text-gray">{l.Unit}</td>
                  <td>₹{l.UnitPrice}</td><td><strong>{fmt(l.LineAmount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailModal.payments?.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--gray4)', textTransform: 'uppercase', marginBottom: 8 }}>
                Payment History
              </div>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Mode</th><th>Ref</th><th>Amount</th></tr></thead>
                <tbody>
                  {detailModal.payments.map(p => (
                    <tr key={p.PaymentID}>
                      <td className="text-sm text-gray">{p.PaymentDate?.split('T')[0]}</td>
                      <td><span className="badge badge-blue">{p.PaymentMode}</span></td>
                      <td className="text-gray">{p.Reference || '—'}</td>
                      <td><strong className="text-green">{fmt(p.Amount)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─── SUPPLIERS TAB ─────────────────────────────────────────── */
function SuppliersTab() {
  const toast = useToast();
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]             = useState({ name: '', phone: '', address: '', email: '' });

  const load = useCallback(() => {
    setLoading(true);
    companyStockAPI.getSuppliers()
      .then(r => setSuppliers(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditTarget(null); setForm({ name: '', phone: '', address: '', email: '' }); setModal(true); };
  const openEdit = (s) => {
    setEditTarget(s);
    setForm({ name: s.Name, phone: s.Phone || '', address: s.Address || '', email: s.Email || '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast('Supplier name required', 'error'); return; }
    try {
      if (editTarget) {
        await companyStockAPI.updateSupplier(editTarget.SupplierID, form); toast('Updated');
      } else {
        await companyStockAPI.createSupplier(form); toast('Supplier added');
      }
      setModal(false); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const del = async (s) => {
    if (!window.confirm(`Delete supplier "${s.Name}"?`)) return;
    try {
      await companyStockAPI.deleteSupplier(s.SupplierID); toast('Deleted'); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="flex-end mb-16">
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>
      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Supplier</th><th>Phone</th><th>Address</th>
                <th>Total Purchased</th><th>Total Paid</th><th>Total Due</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {suppliers.length ? suppliers.map((s, i) => (
                <tr key={s.SupplierID}>
                  <td className="text-gray">{i + 1}</td>
                  <td><strong>{s.Name}</strong>{s.Email && <div className="text-sm text-gray">{s.Email}</div>}</td>
                  <td>{s.Phone || '—'}</td>
                  <td className="text-sm text-gray">{s.Address || '—'}</td>
                  <td>{fmt(s.TotalPurchased)}</td>
                  <td className="text-green text-bold">{fmt(s.TotalPaid)}</td>
                  <td><strong style={{ color: s.TotalDue > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(s.TotalDue)}</strong></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8}>
                  <div className="empty-state"><div className="empty-icon">🏭</div><div className="empty-text">No suppliers yet</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editTarget ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="form-group">
          <label className="form-label">Supplier Name *</label>
          <input className="form-input" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email <span>(optional)</span></label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address <span>(optional)</span></label>
          <input className="form-input" value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{editTarget ? 'Save Changes' : 'Add Supplier'}</button>
        </div>
      </Modal>
    </>
  );
}

/* ─── ALL PAYMENTS TAB ──────────────────────────────────────── */
function AllPaymentsTab() {
  const toast = useToast();
  const [payments, setPayments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    companyStockAPI.getPayments()
      .then(r => setPayments(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    if (!editModal.Amount || parseFloat(editModal.Amount) <= 0) { toast('Enter valid amount', 'error'); return; }
    setSaving(true);
    try {
      await companyStockAPI.updatePayment(editModal.PaymentID, {
        amount:      parseFloat(editModal.Amount),
        paymentMode: editModal.PaymentMode,
        reference:   editModal.Reference || null,
        notes:       editModal.Notes || null,
      });
      toast('Payment updated'); setEditModal(null); load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const del = async (p) => {
    if (!window.confirm('Delete this payment? PO status will be recalculated.')) return;
    try {
      await companyStockAPI.deletePayment(p.PaymentID); toast('Deleted'); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const total = payments.reduce((a, p) => a + parseFloat(p.Amount || 0), 0);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="flex-between mb-16">
        <div style={{ fontSize: 13, color: 'var(--gray3)' }}>
          Total paid to suppliers: <strong style={{ color: 'var(--green)' }}>{fmt(total)}</strong>
        </div>
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>PO #</th><th>Supplier</th><th>Mode</th><th>Reference</th><th>Amount</th><th>Notes</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {payments.length ? payments.map(p => (
                <tr key={p.PaymentID}>
                  <td className="text-sm text-gray">{p.PaymentDate?.split('T')[0]}</td>
                  <td><strong>{p.PONumber}</strong></td>
                  <td>{p.SupplierName || '—'}</td>
                  <td><span className="badge badge-blue">{p.PaymentMode}</span></td>
                  <td className="text-gray text-sm">{p.Reference || '—'}</td>
                  <td><strong className="text-green">{fmt(p.Amount)}</strong></td>
                  <td className="text-sm text-gray">{p.Notes || '—'}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => setEditModal({ ...p })}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8}>
                  <div className="empty-state"><div className="empty-icon">💳</div><div className="empty-text">No payments recorded</div></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Payment">
          <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
            PO: <strong>{editModal.PONumber}</strong> &nbsp;·&nbsp; Supplier: {editModal.SupplierName || '—'}
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input className="form-input" type="number" step="0.01" value={editModal.Amount}
              onChange={e => setEditModal({ ...editModal, Amount: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="form-select" value={editModal.PaymentMode}
              onChange={e => setEditModal({ ...editModal, PaymentMode: e.target.value })}>
              {['CASH','UPI','BANK','CHEQUE','OTHER'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Reference</label>
              <input className="form-input" value={editModal.Reference || ''}
                onChange={e => setEditModal({ ...editModal, Reference: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={editModal.Notes || ''}
                onChange={e => setEditModal({ ...editModal, Notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
