import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Customers from './pages/Customers';
import Invoice from './pages/Invoice';
import { InvoiceHistory } from './pages/InvoiceHistory';
import { Ledger, LedgerDetail } from './pages/Ledger';
import Alerts from './pages/Alerts';
import CompanyStock from './pages/CompanyStock';
import InvoiceDetail from './pages/InvoiceDetail';

export default function App() {
  return (
    <BrowserRouter>
      <LoadingScreen />
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* ERP Console Routes (Direct access, no login/checkout needed) */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/"               element={<Dashboard />} />
                  <Route path="/stock"          element={<Stock />} />
                  <Route path="/company-stock"  element={<CompanyStock />} />
                  <Route path="/customers"      element={<Customers />} />
                  <Route path="/invoice"        element={<Invoice />} />
                  <Route path="/history"        element={<InvoiceHistory />} />
                  <Route path="/history/:id"    element={<InvoiceDetail />} />
                  <Route path="/ledger"         element={<Ledger />} />
                  <Route path="/ledger/:id"     element={<LedgerDetail />} />
                  <Route path="/alerts"         element={<Alerts />} />
                  <Route path="*"               element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
