import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI, invoiceAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Alerts() {
  const [stock, setStock]         = useState([]);
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const nav = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let mounted = true;

    Promise.all([stockAPI.getAll(), invoiceAPI.getAll()])
      .then(([sr, ir]) => {
        if (!mounted) return;
        setStock(sr.data || []);
        setInvoices(ir.data || []);
      })
      .catch(e => {
        toast(e.message || 'Failed to load alerts', 'error');
        if (mounted) {
          setStock([]);
          setInvoices([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [toast]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const outOfStock  = stock.filter(s => s.Quantity === 0);
  const lowStock    = stock.filter(s => s.Quantity > 0 && s.Quantity <= (s.LowStockAlert || 500));
  const unpaidInvs  = invoices.filter(i => i.Status === 'UNPAID');
  const partialInvs = invoices.filter(i => i.Status === 'PARTIAL');

  const total = outOfStock.length + lowStock.length + unpaidInvs.length + partialInvs.length;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28 }}>⚠️</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray1)' }}>
            {total} Active Alert{total !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray4)' }}>Review items that need attention</div>
        </div>
      </div>

      {total === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-text" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16 }}>
            All clear — no alerts!
          </div>
          <div className="text-sm text-gray" style={{ marginTop: 8 }}>
            All stock levels are healthy and all invoices are paid.
          </div>
        </div>
      )}

      {/* Out of Stock */}
      {outOfStock.length > 0 && (
        <div className="card">
          <div className="card-title">🔴 Out of Stock ({outOfStock.length})</div>
          {outOfStock.map(s => (
            <div key={s.BrickID} className="alert-item alert-red">
              <div className="alert-dot dot-red" />
              <div style={{ flex: 1 }}>
                <strong>{s.SizeInch}</strong>{' '}
                <span className="text-sm text-gray">({s.SizeMM})</span>
                <div className="text-sm text-gray">
                  Stock: <strong className="text-red">0 nos</strong> · Cost: {fmt(s.CostPerBrick)}/brick
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => nav('/stock')}>
                Manage Stock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Low Stock */}
      {lowStock.length > 0 && (
        <div className="card">
          <div className="card-title">🟠 Low Stock ({lowStock.length})</div>
          {lowStock.map(s => (
            <div key={s.BrickID} className="alert-item alert-orange">
              <div className="alert-dot dot-orange" />
              <div style={{ flex: 1 }}>
                <strong>{s.SizeInch}</strong>{' '}
                <span className="text-sm text-gray">({s.SizeMM})</span>
                <div className="text-sm text-gray">
                  Stock: <strong>{s.Quantity} nos</strong> · Alert level: {s.LowStockAlert || 500} nos
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => nav('/stock')}>
                Add Stock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unpaid Invoices */}
      {unpaidInvs.length > 0 && (
        <div className="card">
          <div className="card-title">🔴 Unpaid Invoices ({unpaidInvs.length})</div>
          {unpaidInvs.map(i => (
            <div key={i.InvoiceID} className="alert-item alert-red" style={{ cursor: 'pointer' }} onClick={() => nav(`/history/${i.InvoiceID}`)}>
              <div className="alert-dot dot-red" />
              <div style={{ flex: 1 }}>
                <strong>{i.InvoiceNumber}</strong>{' '}
                <span className="text-sm text-gray">— {i.CustomerName}</span>
                <div className="text-sm text-gray">
                  Date: {i.InvoiceDate?.split('T')[0]} · Amount: <strong>{fmt(i.TotalAmount)}</strong>
                </div>
              </div>
              <span className="badge badge-red">UNPAID</span>
            </div>
          ))}
        </div>
      )}

      {/* Partial Invoices */}
      {partialInvs.length > 0 && (
        <div className="card">
          <div className="card-title">🟠 Partially Paid Invoices ({partialInvs.length})</div>
          {partialInvs.map(i => (
            <div key={i.InvoiceID} className="alert-item alert-orange" style={{ cursor: 'pointer' }} onClick={() => nav(`/history/${i.InvoiceID}`)}>
              <div className="alert-dot dot-orange" />
              <div style={{ flex: 1 }}>
                <strong>{i.InvoiceNumber}</strong>{' '}
                <span className="text-sm text-gray">— {i.CustomerName}</span>
                <div className="text-sm text-gray">
                  Date: {i.InvoiceDate?.split('T')[0]} · Total: <strong>{fmt(i.TotalAmount)}</strong>
                </div>
              </div>
              <span className="badge badge-orange">PARTIAL</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
