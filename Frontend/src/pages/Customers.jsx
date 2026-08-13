import React, { useEffect, useState } from 'react';
import { customerAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const emptyForm = { fullName: '', phone: '', address: '', email: '' };

export default function Customers() {
  const { user } = useAuth();
  const isGuest = user?.Role === 'GUEST';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, else customer object
  const [form, setForm] = useState(emptyForm);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    customerAPI.getAll()
      .then(r => setCustomers(r.data))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditTarget(null); setForm(emptyForm); setModal(true); };
  const openEdit = (c) => {
    setEditTarget(c);
    setForm({ fullName: c.FullName, phone: c.Phone, address: c.Address || '', email: c.Email || '' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast('Name and phone are required', 'error'); return;
    }
    try {
      if (editTarget) {
        await customerAPI.update(editTarget.CustomerID, form);
        toast('Customer updated');
      } else {
        await customerAPI.create(form);
        toast('Customer added');
      }
      setModal(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete ${c.FullName}? This cannot be undone.`)) return;
    try {
      await customerAPI.delete(c.CustomerID);
      toast('Customer deleted');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const filtered = customers.filter(c =>
    !search ||
    c.FullName.toLowerCase().includes(search.toLowerCase()) ||
    c.Phone.includes(search)
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="flex-between mb-16">
        <input
          className="form-input"
          style={{ maxWidth: 300 }}
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" disabled={isGuest} onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="card mb-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Total Invoiced</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((c, i) => (
                <tr key={c.CustomerID}>
                  <td className="text-gray">{i + 1}</td>
                  <td><strong>{c.FullName}</strong></td>
                  <td>{c.Phone}</td>
                  <td className="text-sm text-gray">{c.Address || '—'}</td>
                  <td>{fmt(c.TotalInvoiced)}</td>
                  <td className="text-green text-bold">{fmt(c.TotalPaid)}</td>
                  <td>
                    <strong style={{ color: c.Balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {fmt(c.Balance)}
                    </strong>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" disabled={isGuest} onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" disabled={isGuest} onClick={() => handleDelete(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <div className="empty-text">No customers found</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editTarget ? 'Edit Customer' : 'Add New Customer'}
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address <span>(optional)</span></label>
          <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Email <span>(optional)</span></label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editTarget ? 'Save Changes' : 'Add Customer'}</button>
        </div>
      </Modal>
    </div>
  );
}
