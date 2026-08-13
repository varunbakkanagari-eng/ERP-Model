import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, companyStockAPI } from '../utils/api';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const statusColor = (s) =>
  ({ PAID: 'badge-green', UNPAID: 'badge-red', PARTIAL: 'badge-orange', CANCELLED: 'badge-gray' }[s] || 'badge-gray');

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [csData, setCsData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);

      try {
        const dashboardRes = await dashboardAPI.get();
        if (!mounted) return;

        setData(dashboardRes.data);

        try {
          const companyStockRes = await companyStockAPI.getSummary();
          if (mounted) setCsData(companyStockRes.data);
        } catch (err) {
          console.error('Company stock summary failed:', err.message);
          if (mounted) setCsData(null);
        }
      } catch (err) {
        console.error('Dashboard failed:', err.message);
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!data) return (
    <div className="empty-state">
      <div className="empty-icon">⚠️</div>
      <div className="empty-text">Could not load dashboard. Is the backend running?</div>
    </div>
  );

  const { summary, topCustomers, lowStock, recentInvoices } = data;
  const csFinance   = csData?.finance   || {};
  const csMaterials = csData?.materials || [];
  const csLowStock  = csMaterials.filter(m => m.Quantity <= m.LowStockAlert);

  return (
    <div className="fade-in">
      {/* ── Brick Sales KPIs ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Sales Overview
      </div>
      <div className="stat-grid" style={{ marginBottom: 8 }}>
        <div className="stat-card" onClick={() => nav('/stock')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#eff6ff' }}>📦</div>
          <div className="stat-label">Brick Stock</div>
          <div className="stat-value">{Number(summary.TotalStock).toLocaleString('en-IN')}</div>
          <div className="stat-sub">bricks available</div>
        </div>
        <div className="stat-card" onClick={() => nav('/customers')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#f0fdf4' }}>👥</div>
          <div className="stat-label">Customers</div>
          <div className="stat-value">{summary.TotalCustomers}</div>
          <div className="stat-sub">{summary.TodayInvoices} invoices today</div>
        </div>
        <div className="stat-card" onClick={() => nav('/history')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#fff7ed' }}>🧾</div>
          <div className="stat-label">Total Sales</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{fmt(summary.TotalSales)}</div>
          <div className="stat-sub">{summary.TotalInvoices} invoices</div>
        </div>
        <div className="stat-card" onClick={() => nav('/ledger')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}>💰</div>
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ fontSize: 20, color: summary.TotalOutstanding > 0 ? 'var(--red)' : 'var(--green)' }}>
            {fmt(summary.TotalOutstanding)}
          </div>
          <div className="stat-sub">Collected: {fmt(summary.TotalCollected)}</div>
        </div>
      </div>

      {/* ── Company Stock / Supplier KPIs ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, marginTop: 16 }}>
        Company Purchases &amp; Supplier Payments
      </div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" onClick={() => nav('/company-stock')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#f5f3ff' }}>🏗️</div>
          <div className="stat-label">Total Purchased</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(csFinance.TotalPurchased)}</div>
          <div className="stat-sub">raw materials</div>
        </div>
        <div className="stat-card" onClick={() => nav('/company-stock')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#f0fdf4' }}>✅</div>
          <div className="stat-label">Supplier Paid</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt(csFinance.TotalPaid)}</div>
          <div className="stat-sub">to suppliers</div>
        </div>
        <div className="stat-card" onClick={() => nav('/company-stock')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}>⚠️</div>
          <div className="stat-label">Supplier Due</div>
          <div className="stat-value" style={{ fontSize: 18, color: csFinance.TotalDue > 0 ? 'var(--red)' : 'var(--green)' }}>
            {fmt(csFinance.TotalDue)}
          </div>
          <div className="stat-sub">{csFinance.UnpaidPOs || 0} unpaid POs</div>
        </div>
        <div className="stat-card" onClick={() => nav('/company-stock')} role="button" tabIndex={0}>
          <div className="stat-icon" style={{ background: '#fff7ed' }}>💳</div>
          <div className="stat-label">Credit Buys</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--orange)' }}>{fmt(csFinance.TotalCreditBought)}</div>
          <div className="stat-sub">bought on credit</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Invoices */}
        <div className="card">
          <div className="card-title">Recent Invoices</div>
          {recentInvoices.length ? (
            <table className="data-table">
              <thead>
                <tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentInvoices.map(i => (
                  <tr key={i.InvoiceID} style={{ cursor: 'pointer' }} onClick={() => nav(`/history/${i.InvoiceID}`)}>
                    <td>
                      <strong>{i.InvoiceNumber}</strong><br />
                      <span className="text-sm text-gray">{i.InvoiceDate?.split('T')[0]}</span>
                    </td>
                    <td>{i.CustomerName}</td>
                    <td><strong>{fmt(i.TotalAmount)}</strong></td>
                    <td><span className={`badge ${statusColor(i.Status)}`}>{i.Status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🧾</div>
              <div className="empty-text">No invoices yet</div>
            </div>
          )}
        </div>

        <div>
          {/* Outstanding Customers */}
          <div className="card">
            <div className="card-title">🔴 Outstanding Customers</div>
            {topCustomers.length ? (
              <table className="data-table">
                <thead><tr><th>Customer</th><th>Balance</th></tr></thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={i}>
                      <td>{c.FullName}<br /><span className="text-sm text-gray">{c.Phone}</span></td>
                      <td><strong className="text-red">{fmt(c.Balance)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--green)', fontWeight: 600 }}>
                ✓ All accounts clear!
              </div>
            )}
          </div>

          {/* Low brick stock */}
          {lowStock.length > 0 && (
            <div className="card">
              <div className="card-title">🟠 Low Brick Stock</div>
              {lowStock.map((s, i) => (
                <div key={i} className="alert-item alert-orange">
                  <div className="alert-dot dot-orange" />
                  <div style={{ flex: 1 }}>
                    <strong>{s.SizeInch}</strong>{' '}
                    <span className="text-sm text-gray">({s.SizeMM})</span>
                    <div className="text-sm text-gray">Stock: <strong>{s.Quantity} nos</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Low company material stock */}
          {csLowStock.length > 0 && (
            <div className="card">
              <div className="card-title">🟠 Low Material Stock</div>
              {csLowStock.map((m, i) => (
                <div key={i} className="alert-item alert-orange" style={{ cursor: 'pointer' }}
                  onClick={() => nav('/company-stock')}>
                  <div className="alert-dot dot-orange" />
                  <div style={{ flex: 1 }}>
                    <strong>{m.Name}</strong>
                    <div className="text-sm text-gray">
                      Stock: <strong>{m.Quantity} {m.Unit}</strong> · Alert: {m.LowStockAlert} {m.Unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
