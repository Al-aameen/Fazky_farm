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
import Settings from './pages/Settings';
import FeedWatch from './pages/FeedWatch';
import FlockHealth from './pages/FlockHealth';
import FlockLifecycle from './pages/FlockLifecycle';
import CustomerOrders from './pages/CustomerOrders';
import FarmProjects from './pages/FarmProjects';

function AppContent() {
  const { user, role, loading } = useAuth();
  
  // Persist active page in localStorage so page refresh never kicks user back to dashboard
  const [activePage, setActivePage] = useState(() => {
    const saved = localStorage.getItem('fazky_active_page');
    return saved || 'dashboard';
  });

  const handleSetActivePage = (page) => {
    setActivePage(page);
    localStorage.setItem('fazky_active_page', page);
  };

  // If user role is staff, ensure they don't land on admin-only page
  useEffect(() => {
    if (user && role === 'staff') {
      const staffAllowed = ['census', 'production', 'flockhealth', 'feedwatch'];
      if (!staffAllowed.includes(activePage)) {
        handleSetActivePage('census');
      }
    }
  }, [user, role, activePage]);

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
      case 'farmprojects':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <FarmProjects />
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
      case 'flockhealth':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
            <FlockHealth />
          </ProtectedRoute>
        );
      case 'flocklifecycle':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <FlockLifecycle />
          </ProtectedRoute>
        );
      case 'feedwatch':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager', 'staff']}>
            <FeedWatch />
          </ProtectedRoute>
        );
      case 'customerorders':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <CustomerOrders />
          </ProtectedRoute>
        );
      case 'settings':
        return (
          <ProtectedRoute allowedRoles={['admin', 'manager']}>
            <Settings />
          </ProtectedRoute>
        );
      default:
        return <CensusMatrix />;
    }
  };

  return (
    <MainLayout activePage={activePage} setActivePage={handleSetActivePage}>
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
