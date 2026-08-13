import React, { useEffect, useState } from 'react';
import { stockAPI } from '../utils/api';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Stock() {
  const { user } = useAuth();
  const isGuest = user?.Role === 'GUEST';

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [addNote, setAddNote] = useState('');
  const [editForm, setEditForm] = useState({});
  const toast = useToast();

  const load = () => {
    setLoading(true);
    stockAPI.getAll()
      .then(r => setStock(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAddStock = async () => {
    if (!addQty || parseInt(addQty) <= 0) { toast('Enter a valid quantity', 'error'); return; }
    try {
      await stockAPI.addQuantity(addModal.id, parseInt(addQty), addNote);
      toast(`Stock added to ${addModal.inch}`);
      setAddModal(null); setAddQty(''); setAddNote('');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleEdit = async () => {
    try {
      await stockAPI.update(editModal.BrickID, {
        costPerBrick: parseFloat(editForm.cost),
        tripQty: parseInt(editForm.trip),
        lowStockAlert: parseInt(editForm.alert),
      });
      await stockAPI.setQuantity(editModal.BrickID, {
        quantity: parseInt(editForm.qty),
        note: 'Manual adjustment',
      });
      toast('Stock updated');
      setEditModal(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const totalValue = stock.reduce((a, s) => a + s.Quantity * s.CostPerBrick, 0);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="flex-between mb-16">
        <div style={{ fontSize: 13, color: 'var(--gray3)' }}>
          Total inventory value:{' '}
          <strong style={{ color: 'var(--gray1)' }}>{fmt(totalValue)}</strong>
        </div>
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Size (Inches)</th>
                <th>Size (MM)</th>
                <th>Cost/Brick</th>
                <th>Trip Qty</th>
                <th>In Stock</th>
                <th>Stock Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s, i) => {
                const low = s.Quantity <= (s.LowStockAlert || 500);
                return (
                  <tr key={s.BrickID}>
                    <td className="text-gray">{i + 1}</td>
                    <td><strong>{s.SizeInch}</strong></td>
                    <td className="text-gray text-sm">{s.SizeMM}</td>
                    <td><strong>{fmt(s.CostPerBrick)}</strong></td>
                    <td className="text-gray">{s.TripQty?.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge ${s.Quantity > 1000 ? 'badge-green' : s.Quantity > 0 ? 'badge-orange' : 'badge-red'}`}>
                        {s.Quantity?.toLocaleString('en-IN')} nos
                      </span>
                    </td>
                    <td><strong>{fmt(s.Quantity * s.CostPerBrick)}</strong></td>
                    <td>
                      {s.Quantity === 0
                        ? <span className="badge badge-red">Out of Stock</span>
                        : low
                          ? <span className="badge badge-orange">Low Stock</span>
                          : <span className="badge badge-green">Available</span>}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-success btn-sm"
                          disabled={isGuest}
                          onClick={() => { setAddModal({ id: s.BrickID, inch: s.SizeInch, currentQty: s.Quantity }); setAddQty(String(s.TripQty)); }}
                        >
                          + Add
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={isGuest}
                          onClick={() => { setEditModal(s); setEditForm({ qty: s.Quantity, cost: s.CostPerBrick, trip: s.TripQty, alert: s.LowStockAlert || 500 }); }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Modal */}
      <Modal open={!!addModal} onClose={() => setAddModal(null)} title={`Add Stock — ${addModal?.inch}`}>
        <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--gray3)' }}>
          Current stock: <strong style={{ color: 'var(--gray1)' }}>{addModal?.currentQty?.toLocaleString('en-IN')} nos</strong>
        </div>
        <div className="form-group">
          <label className="form-label">Quantity to Add (nos)</label>
          <input className="form-input" type="number" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="e.g. 800" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Note <span>(optional)</span></label>
          <input className="form-input" value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="e.g. Trip from Hyderabad" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setAddModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddStock} disabled={!addQty || parseInt(addQty) <= 0}>Add Stock</button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit — ${editModal?.SizeInch}`}>
        <div style={{ background: 'var(--gray8)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--gray3)' }}>
          {editModal?.SizeInch} &nbsp;|&nbsp; {editModal?.SizeMM}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Stock Quantity (nos)</label>
            <input className="form-input" type="number" value={editForm.qty ?? ''} onChange={e => setEditForm({ ...editForm, qty: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Cost per Brick (₹)</label>
            <input className="form-input" type="number" step="0.01" value={editForm.cost ?? ''} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Qty per Trip</label>
            <input className="form-input" type="number" value={editForm.trip ?? ''} onChange={e => setEditForm({ ...editForm, trip: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Low Stock Alert (nos)</label>
            <input className="form-input" type="number" value={editForm.alert ?? ''} onChange={e => setEditForm({ ...editForm, alert: e.target.value })} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEdit}>Save Changes</button>
        </div>
      </Modal>
    </div>
  );
}
