import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
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
  X,
  ChevronLeft, 
  Settings as SettingsIcon, 
  Package, 
  Activity, 
  ShoppingCart, 
  Egg,
  Sun,
  Moon,
  Sparkles,
  UserCheck
} from 'lucide-react';

export default function MainLayout({ activePage, setActivePage, children }) {
  const { user, role, worker, logout } = useAuth();
  const { isOnline } = useData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Theme Mode State (persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('fazky_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fazky_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fazky_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Comprehensive navigation items matching updated portal architecture
  const navItems = [
    // Staff-first dashboard
    { id: 'workerdashboard', label: 'My Dashboard',      icon: UserCheck,         roles: ['staff'] },
    
    // Admin / Manager primary dashboard
    { id: 'dashboard',        label: 'Dashboard',         icon: LayoutDashboard,   roles: ['admin', 'manager'] },
    
    // Core Daily Operations
    { id: 'production',       label: 'Production Log',    icon: ClipboardList,     roles: ['admin', 'manager', 'staff'] },
    { id: 'census',           label: 'Bird Census',       icon: Grid,              roles: ['admin', 'manager', 'staff'] },
    { id: 'flockhealth',      label: 'Flock Health',      icon: Activity,          roles: ['admin', 'manager', 'staff'] },
    { id: 'flocklifecycle',   label: 'Flock Lifecycle',   icon: Egg,               roles: ['admin', 'manager'] },
    
    // Unified Feed & Procurement Hub (Item XI)
    { id: 'procurement',      label: 'Feed & Stock Hub',  icon: Package,           roles: ['admin', 'manager', 'staff'] },
    
    // Dedicated General Livestock Module (Item XV)
    { id: 'generallivestock', label: 'General Livestock', icon: Sparkles,          roles: ['admin', 'manager'] },
    
    // Commercial & Finances
    { id: 'sales',            label: 'Sales Log',         icon: CircleDollarSign,  roles: ['admin', 'manager'] },
    { id: 'customerorders',   label: 'Orders & CRM',      icon: ShoppingCart,      roles: ['admin', 'manager'] },
    { id: 'expenses',         label: 'Daily Expenses',    icon: Receipt,           roles: ['admin', 'manager'] },
    { id: 'farmprojects',     label: 'Farm Projects',     icon: Hammer,            roles: ['admin', 'manager'] },
    { id: 'loans',            label: 'Loan Ledger',       icon: PiggyBank,         roles: ['admin'] },
    { id: 'payroll',          label: 'Payroll',           icon: FileText,          roles: ['admin'] },
    { id: 'workers',          label: 'Workers',           icon: Users,             roles: ['admin'] },
    { id: 'settings',         label: 'Settings',          icon: SettingsIcon,      roles: ['admin', 'manager'] },
  ];

  // Filter items by current user's role
  const visibleNavItems = navItems.filter(item => item.roles.includes(role || 'staff'));

  const handleNavClick = (id) => {
    setActivePage(id);
    setMobileDrawerOpen(false);
  };

  const getPageTitle = () => {
    const item = navItems.find(n => n.id === activePage);
    return item ? item.label : 'Fazky Farm';
  };

  return (
    <div className="flex h-screen bg-bg-farm overflow-hidden">
      {/* ── Mobile Overlay Backdrop ── */}
      {mobileDrawerOpen && (
        <div 
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      {/* ── Sidebar (Desktop Fixed + Mobile Slide-out Drawer) ── */}
      <aside 
        className={`bg-dark-green text-white flex flex-col justify-between transition-all duration-300 border-r border-border-farm shrink-0 z-50
          fixed md:static inset-y-0 left-0
          ${mobileDrawerOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-16' : 'md:w-[220px]'}
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo / Branding */}
          <div className="p-4 flex items-center justify-between border-b border-white/10 h-16 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">🌾</span>
              {(!collapsed || mobileDrawerOpen) && (
                <span className="font-serif text-lg font-bold tracking-wider text-white">
                  FAZKY FARM
                </span>
              )}
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden text-white/70 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-1 flex-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-accent text-dark-green font-bold shadow-md'
                      : 'text-light-green hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {(!collapsed || mobileDrawerOpen) && (
                    <span className="font-sans text-left truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout Panel */}
          <div className="p-3 border-t border-white/10 bg-black/10 shrink-0">
            {(!collapsed || mobileDrawerOpen) && (
              <div className="mb-2 p-2 bg-white/5 rounded-xl flex items-center gap-2.5">
                {worker?.avatar ? (
                  <img 
                    src={worker.avatar} 
                    alt={worker.name || 'User'} 
                    className="w-8 h-8 rounded-full object-cover border border-accent/40 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center border border-accent/30 shrink-0">
                    {(worker?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-white truncate">
                    {worker?.name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-[10px] text-light-green uppercase font-mono tracking-wider font-bold">
                    {role || 'staff'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={logout}
                className={`flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg text-xs font-medium transition-colors ${
                  collapsed && !mobileDrawerOpen ? 'w-full justify-center' : 'flex-1'
                }`}
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-300" />
                {(!collapsed || mobileDrawerOpen) && <span>Sign Out</span>}
              </button>

              <button
                onClick={toggleTheme}
                className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-200" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main App Container ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-border-farm h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl text-dark-green hover:bg-bg-farm active:bg-emerald-50 transition-colors"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
            </button>

            <h1 className="text-base sm:text-xl font-serif font-bold text-dark-green truncate">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NetworkStatus />

            {/* Theme Toggle in Header */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-text-muted hover:text-dark-green hover:bg-bg-farm transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-dark-green" />}
            </button>

            {/* User Avatar Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-border-farm">
              {worker?.avatar ? (
                <img 
                  src={worker.avatar} 
                  alt={worker.name || 'User'} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-primary/30"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-dark-green text-white font-bold text-xs flex items-center justify-center">
                  {(worker?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-bold text-dark-green hidden lg:inline truncate max-w-[120px]">
                {worker?.name || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-bg-farm scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
