import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './hooks/useData';
import MainLayout from './pages/MainLayout';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

// Pages import
import Dashboard from './pages/Dashboard';
import CensusMatrix from './pages/CensusMatrix';
import ProductionLog from './pages/ProductionLog';
import SalesLog from './pages/SalesLog';
import ExpensesLog from './pages/ExpensesLog';
import Procurement from './pages/Procurement';
import LoanLedger from './pages/LoanLedger';
import Payroll from './pages/Payroll';
import Workers from './pages/Workers';

function AppContent() {
  const { user, role, loading } = useAuth();
  
  // Choose the initial page based on the role
  const [activePage, setActivePage] = useState('census');

  // Automatically switch dashboard for Admin/Manager when logging in
  useEffect(() => {
    if (user && role) {
      if (role === 'admin' || role === 'manager') {
        setActivePage('dashboard');
      } else {
        setActivePage('census');
      }
    }
  }, [user, role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-farm flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary border-b-2"></div>
          <p className="text-sm text-text-muted font-sans font-semibold">Loading FAZKY Farm Ledger...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Dashboard />
          </ProtectedRoute>
        );
      case 'census':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
            <CensusMatrix />
          </ProtectedRoute>
        );
      case 'production':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
            <ProductionLog />
          </ProtectedRoute>
        );
      case 'sales':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <SalesLog />
          </ProtectedRoute>
        );
      case 'expenses':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <ExpensesLog />
          </ProtectedRoute>
        );
      case 'procurement':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Procurement />
          </ProtectedRoute>
        );
      case 'loans':
        return (
          <ProtectedRoute allowedRoles={['admin']}>
            <LoanLedger />
          </ProtectedRoute>
        );
      case 'payroll':
        return (
          <ProtectedRoute allowedRoles={['admin']}>
            <Payroll />
          </ProtectedRoute>
        );
      case 'workers':
        return (
          <ProtectedRoute allowedRoles={['admin']}>
            <Workers />
          </ProtectedRoute>
        );
      default:
        return <CensusMatrix />;
    }
  };

  return (
    <MainLayout activePage={activePage} setActivePage={setActivePage}>
      {renderPage()}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
