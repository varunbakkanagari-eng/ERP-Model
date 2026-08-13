import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navItems = [
  { to: '/',              icon: '📊', label: 'Dashboard' },
  { to: '/stock',         icon: '📦', label: 'Brick Stock' },
  { to: '/company-stock', icon: '🏗️',  label: 'Company Stock' },
  { to: '/customers',     icon: '👥', label: 'Customers' },
  { to: '/invoice',       icon: '🧾', label: 'New Invoice' },
  { to: '/history',       icon: '📋', label: 'Invoice History' },
  { to: '/ledger',        icon: '💰', label: 'Ledger' },
  { to: '/alerts',        icon: '⚠️',  label: 'Alerts' },
];

const titles = {
  '/':              'Dashboard',
  '/stock':         'Brick Stock',
  '/company-stock': 'Company Stock',
  '/customers':     'Customers',
  '/invoice':       'New Invoice',
  '/history':       'Invoice History',
  '/ledger':        'Ledger',
  '/alerts':        'Alerts',
};

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loc = useLocation();
  const base = '/' + loc.pathname.split('/')[1];
  const title = titles[base] || 'Sai Varun ERP';

  return (
    <div className="app-shell">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>🧱 Sai Varun</h1>
            <p>Enterprise ERP</p>
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="sidebar-nav">
          {navItems.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: 'var(--gray4)', textAlign: 'center' }}>
            Sai Varun Enterprise · v1.0
          </div>
        </div>
      </nav>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="topbar-title">{title}</span>
          </div>
          <span className="topbar-date">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </header>
        <main className="page-content fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
