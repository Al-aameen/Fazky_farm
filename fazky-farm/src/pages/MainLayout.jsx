import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NetworkStatus from '../components/NetworkStatus';
import { 
  LayoutDashboard, 
  Grid, 
  ClipboardList, 
  CircleDollarSign, 
  Receipt, 
  FileText, 
  Users, 
  PiggyBank, 
  Hammer, 
  LogOut, 
  Menu, 
  ChevronLeft,
  UserCheck,
  Settings as SettingsIcon,
  Package,
  Activity,
  ShoppingCart
} from 'lucide-react';

export default function MainLayout({ activePage, setActivePage, children }) {
  const { user, role, worker, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Define navigation items with icon, label, id, and allowed roles
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
    { id: 'census', label: 'Bird Census', icon: Grid, roles: ['admin', 'manager', 'staff'] },
    { id: 'production', label: 'Production Log', icon: ClipboardList, roles: ['admin', 'manager', 'staff'] },
    { id: 'flockhealth', label: 'Flock Health', icon: Activity, roles: ['admin', 'manager', 'staff'] },
    { id: 'feedwatch', label: 'Feed & Stock', icon: Package, roles: ['admin', 'manager', 'staff'] },
    { id: 'sales', label: 'Sales Log', icon: CircleDollarSign, roles: ['admin', 'manager'] },
    { id: 'customerorders', label: 'Orders & CRM', icon: ShoppingCart, roles: ['admin', 'manager'] },
    { id: 'expenses', label: 'Daily Expenses', icon: Receipt, roles: ['admin', 'manager'] },
    { id: 'procurement', label: 'Procurement', icon: Hammer, roles: ['admin', 'manager'] },
    { id: 'loans', label: 'Loan Ledger', icon: PiggyBank, roles: ['admin'] },
    { id: 'payroll', label: 'Payroll', icon: FileText, roles: ['admin'] },
    { id: 'workers', label: 'Workers', icon: Users, roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
  ];

  // Filter items by current user's role
  const visibleNavItems = navItems.filter(item => item.roles.includes(role));

  const handleNavClick = (id) => {
    setActivePage(id);
  };

  const getPageTitle = () => {
    const item = navItems.find(n => n.id === activePage);
    return item ? item.label : 'Fazky Farm';
  };

  return (
    <div className="flex h-screen bg-bg-farm overflow-hidden">
      {/* Sidebar - collapsing */}
      <aside 
        className={`bg-dark-green text-white flex flex-col justify-between transition-all duration-300 border-r border-border-farm shrink-0 z-20 ${
          collapsed ? 'w-16' : 'w-[220px]'
        }`}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Logo / Branding */}
          <div className="p-4 flex items-center gap-3 border-b border-white/10 h-16 shrink-0">
            <span className="text-2xl shrink-0">🌾</span>
            {!collapsed && (
              <span className="font-serif text-lg font-bold tracking-wider text-white">
                FAZKY FARM
              </span>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-accent text-dark-green font-bold shadow-md'
                      : 'text-light-green hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="font-sans text-left truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Panel */}
        <div className="p-3 border-t border-white/10 bg-black/10 shrink-0">
          {!collapsed && (
            <div className="mb-3 px-2 py-1 bg-white/5 rounded-lg">
              <div className="text-xs text-light-green truncate font-bold">{worker?.name || 'Worker'}</div>
              <div className="text-[10px] text-accent/80 uppercase tracking-widest font-sans font-bold flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3 h-3" />
                <span>{role}</span>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-accent/90 hover:bg-red-950/20 hover:text-red-400 hover:font-bold transition-all duration-150"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="font-sans text-left">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-col flex-grow min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-border-farm h-16 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-text-primary hover:bg-bg-farm p-2 rounded-lg transition-colors border border-border-farm shadow-sm"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <h2 className="text-xl font-serif text-dark-green tracking-tight font-bold m-0">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <NetworkStatus />
            {!collapsed && (
              <div className="text-xs text-text-muted font-semibold bg-bg-farm border border-border-farm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span>ID: {worker?.name || 'Local User'}</span>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Work Area */}
        <main className="flex-grow overflow-auto bg-bg-farm scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
