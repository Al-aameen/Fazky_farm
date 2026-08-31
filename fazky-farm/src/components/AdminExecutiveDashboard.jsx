import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { 
  ShieldCheck, 
  ShoppingCart, 
  CircleDollarSign, 
  Hammer, 
  Bird, 
  Boxes, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  ArrowUpRight, 
  Sparkles, 
  TrendingUp,
  Receipt,
  Plus,
  Coins,
  FileText
} from 'lucide-react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminExecutiveDashboard({ setActivePage }) {
  const { user, worker } = useAuth();
  const { data, insertRecord, updateRecord } = useData();

  const todayIso = new Date().toISOString().split('T')[0];
  const todayDayName = WEEKDAYS[new Date().getDay()];
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // Compensation Modal State
  const [showCompModal, setShowCompModal] = useState(false);
  const [selectedWorkerForComp, setSelectedWorkerForComp] = useState(null);
  const [compAmount, setCompAmount] = useState('');
  const [compPaymentMode, setCompPaymentMode] = useState('immediate'); // 'immediate' | 'payroll'
  const [compNotes, setCompNotes] = useState('');
  const [compSubmitting, setCompSubmitting] = useState(false);
  const [compMessage, setCompMessage] = useState(null);

  // ── 1. Debtors & Outstanding Receivables ─────────────────────────────────
  const salesLog = data.sales_log || [];
  const customerDebts = {};
  salesLog.forEach(s => {
    const name = s.customer_name?.trim() || 'Anonymous';
    if (!customerDebts[name]) {
      customerDebts[name] = { name, totalBilled: 0, totalPaid: 0, lastDate: s.date };
    }
    const crates = parseInt(s.crates) || 0;
    // Estimate unit price if not explicitly stored
    const estimatedPrice = 4400; 
    customerDebts[name].totalBilled += crates * estimatedPrice;
    customerDebts[name].totalPaid += (parseFloat(s.cash_paid) || 0) + (parseFloat(s.transfer_amount) || 0) + (parseFloat(s.deposit_amount) || 0);
  });

  const debtorsList = Object.values(customerDebts)
    .map(c => ({
      ...c,
      debt: Math.max(0, c.totalBilled - c.totalPaid)
    }))
    .filter(c => c.debt > 0)
    .sort((a, b) => b.debt - a.debt);

  const totalOutstandingDebt = debtorsList.reduce((sum, d) => sum + d.debt, 0);

  // ── 2. Active Growing Batches ─────────────────────────────────────────────
  const batches = data.batches || [];
  const growingBatches = batches.filter(b => b.status === 'growing');
  const totalGrowingBirds = growingBatches.reduce((sum, b) => sum + (Number(b.quantity_arrived) || 0), 0);
  const totalGrowingCost = growingBatches.reduce((sum, b) => sum + ((Number(b.cost_per_bird) || 0) * (Number(b.quantity_arrived) || 0)), 0);

  // ── 3. Capital Farm Projects ─────────────────────────────────────────────
  const projects = data.farm_projects || [];
  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'planning');
  const totalProjectBudget = activeProjects.reduce((sum, p) => sum + (Number(p.budget_allocated) || 0), 0);
  const totalProjectSpent = activeProjects.reduce((sum, p) => sum + (Number(p.spent_amount) || 0), 0);

  // ── 4. Feed & Grain Stock Alerts ─────────────────────────────────────────
  const feedInventory = data.feed_inventory || [];
  const lowStockItems = feedInventory.filter(fi => Number(fi.current_stock || 0) <= Number(fi.low_stock_threshold || 10));

  // ── 5. General Livestock ─────────────────────────────────────────────────
  const generalList = data.general_livestock_detailed || [];
  const totalGeneralAnimals = generalList.reduce(
    (sum, item) => sum + (Number(item.count_male || 0) + Number(item.count_female || 0) + Number(item.count_young || 0)), 
    0
  );

  // ── 6. Staff Attendance & Off-Day Roster ──────────────────────────────────
  const activeWorkers = (data.workers || []).filter(w => w.status === 'active' && w.role !== 'admin');
  const attendanceRecords = data.staff_attendance_roster || [];
  const offPaysList = data.off_pays || [];

  const getWorkerAttendance = (workerId) => {
    return attendanceRecords.find(a => a.worker_id === workerId && a.date === selectedDate);
  };

  const handleUpdateAttendanceStatus = async (workerId, newStatus) => {
    const existing = getWorkerAttendance(workerId);
    try {
      if (existing) {
        await updateRecord('staff_attendance_roster', {
          id: existing.id,
          status: newStatus
        });
      } else {
        await insertRecord('staff_attendance_roster', {
          worker_id: workerId,
          date: selectedDate,
          status: newStatus,
          payment_mode: 'none',
          compensation_amount: 0
        });
      }
    } catch (err) {
      console.error('Failed to update attendance:', err);
    }
  };

  const handleOpenCompModal = (w) => {
    const dailyRate = Math.round((Number(w.base_salary) || 0) / 30);
    setSelectedWorkerForComp(w);
    setCompAmount(dailyRate > 0 ? dailyRate.toString() : '2000');
    setCompPaymentMode('immediate');
    setCompNotes(`Worked on scheduled off-day (${w.off_day || todayDayName})`);
    setShowCompModal(true);
    setCompMessage(null);
  };

  const handleSaveCompensation = async (e) => {
    e.preventDefault();
    if (!selectedWorkerForComp) return;
    const amt = parseFloat(compAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid compensation amount.');
      return;
    }

    setCompSubmitting(true);
    try {
      let expenseId = null;

      // Option 1: Pay Immediately -> Record in Daily Expenses Log
      if (compPaymentMode === 'immediate') {
        const expResult = await insertRecord('expenses_log', {
          date: selectedDate,
          day_of_week: todayDayName,
          category: 'Labor / Bonus',
          description: `Off-day allowance for ${selectedWorkerForComp.name} (${compNotes || 'Worked on scheduled off-day'})`,
          amount: amt,
          remarks: `Direct off-day compensation`,
          created_by: worker?.id || 'admin'
        });
        expenseId = expResult?.id || null;
      }

      // Record in off_pays
      await insertRecord('off_pays', {
        worker_id: selectedWorkerForComp.id,
        date: selectedDate,
        amount: amt,
        payment_mode: compPaymentMode,
        expense_id: expenseId,
        remarks: compPaymentMode === 'immediate' 
          ? `Paid immediately (Daily Expense) - ${compNotes}` 
          : `Accrued for monthly payroll - ${compNotes}`
      });

      // Update Attendance Roster record
      const existing = getWorkerAttendance(selectedWorkerForComp.id);
      if (existing) {
        await updateRecord('staff_attendance_roster', {
          id: existing.id,
          status: 'worked_off_day',
          payment_mode: compPaymentMode,
          compensation_amount: amt,
          notes: compNotes
        });
      } else {
        await insertRecord('staff_attendance_roster', {
          worker_id: selectedWorkerForComp.id,
          date: selectedDate,
          status: 'worked_off_day',
          payment_mode: compPaymentMode,
          compensation_amount: amt,
          notes: compNotes
        });
      }

      setCompMessage({
        type: 'success',
        text: `✅ Off-day compensation (₦${amt.toLocaleString()}) recorded for ${selectedWorkerForComp.name} via ${compPaymentMode === 'immediate' ? 'Immediate Expense' : 'Monthly Payroll'}!`
      });
      setTimeout(() => {
        setShowCompModal(false);
        setSelectedWorkerForComp(null);
        setCompMessage(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to log compensation:', err);
      setCompMessage({ type: 'error', text: err.message || 'Failed to record compensation.' });
    } finally {
      setCompSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Executive Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-dark-green via-emerald-900 to-teal-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl overflow-hidden border border-emerald-800/40">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-accent">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Executive Command Center • Administrator Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight">
              Fazky Farm Executive Operations
            </h1>
            <p className="text-xs text-light-green/90 max-w-2xl">
              High-level strategic overview of revenue, receivables, active capital projects, flock lifecycle investments, and daily staff attendance.
            </p>
          </div>

          {/* Quick Action Pill Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActivePage && setActivePage('customerorders')}
              className="bg-accent hover:bg-yellow-400 text-dark-green font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>+ New Sales Order</span>
            </button>

            <button
              onClick={() => setActivePage && setActivePage('procurement')}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs px-3.5 py-2.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4 text-accent" />
              <span>+ Buy Feed / Grain</span>
            </button>

            <button
              onClick={() => setActivePage && setActivePage('farmprojects')}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs px-3.5 py-2.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <Hammer className="w-4 h-4 text-accent" />
              <span>+ Log Project</span>
            </button>

            <button
              onClick={() => setActivePage && setActivePage('payroll')}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs px-3.5 py-2.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-accent" />
              <span>Payroll</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Cards Grid (6 Modules) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Card 1: Debtors & Receivables */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">Customer Receivables</h3>
                  <span className="text-[10.5px] text-text-muted">{debtorsList.length} outstanding accounts</span>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full">
                Debt Ledger
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Uncollected Debt</span>
                <span className="text-2xl font-serif font-black text-amber-700 font-mono">
                  ₦{totalOutstandingDebt.toLocaleString()}
                </span>
              </div>

              <div className="bg-bg-farm rounded-2xl p-3 border border-border-farm space-y-1.5">
                <span className="text-[10px] text-text-muted font-bold block">Top Outstanding Debtors:</span>
                {debtorsList.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-dark-green truncate max-w-[140px]">{d.name}</span>
                    <span className="font-mono font-bold text-amber-800">₦{d.debt.toLocaleString()}</span>
                  </div>
                ))}
                {debtorsList.length === 0 && (
                  <span className="text-xs text-text-muted italic">All customer accounts are fully paid!</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('customerorders')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Open Orders & Debt Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Growing Batches & Investments */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-dark-green rounded-xl">
                  <Bird className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">Growing Batches</h3>
                  <span className="text-[10.5px] text-text-muted">{growingBatches.length} active chick batches</span>
                </div>
              </div>
              <span className="bg-emerald-100 text-dark-green text-[10px] font-black px-2.5 py-1 rounded-full">
                Flock Growth
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Live Growing Birds</span>
                  <span className="text-2xl font-serif font-black text-dark-green font-mono">
                    {totalGrowingBirds.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Initial Capital Spent</span>
                  <span className="text-lg font-serif font-bold text-primary font-mono">
                    ₦{totalGrowingCost.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-bg-farm rounded-2xl p-3 border border-border-farm space-y-1.5">
                <span className="text-[10px] text-text-muted font-bold block">Active Batches:</span>
                {growingBatches.map(b => (
                  <div key={b.id} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-dark-green truncate max-w-[130px]">{b.batch_name}</span>
                    <span className="font-mono text-[11px] text-text-muted font-bold">{b.quantity_arrived} birds</span>
                  </div>
                ))}
                {growingBatches.length === 0 && (
                  <span className="text-xs text-text-muted italic">No active growing batches currently.</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('flocklifecycle')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Open Flock Lifecycle & Growth Grid</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Capital Projects */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Hammer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">Farm Capital Projects</h3>
                  <span className="text-[10.5px] text-text-muted">{activeProjects.length} infrastructure projects</span>
                </div>
              </div>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full">
                Projects
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Spent to Date</span>
                  <span className="text-2xl font-serif font-black text-dark-green font-mono">
                    ₦{totalProjectSpent.toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-text-muted font-bold">
                  of ₦{totalProjectBudget.toLocaleString()} budget
                </span>
              </div>

              <div className="bg-bg-farm rounded-2xl p-3 border border-border-farm space-y-2">
                {activeProjects.slice(0, 2).map(p => {
                  const pct = p.budget_allocated > 0 ? Math.min(100, Math.round((p.spent_amount / p.budget_allocated) * 100)) : 0;
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-dark-green truncate max-w-[150px]">{p.project_name}</span>
                        <span className="text-primary">{pct}%</span>
                      </div>
                      <div className="w-full bg-border-farm/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {activeProjects.length === 0 && (
                  <span className="text-xs text-text-muted italic">No active capital projects currently.</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('farmprojects')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Open Farm Projects Tracker</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Feed & Grain Inventory Health */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-dark-green rounded-xl">
                  <Boxes className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">Feed Stock & Grain</h3>
                  <span className="text-[10.5px] text-text-muted">In-house milling & ready-made</span>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                lowStockItems.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-dark-green'
              }`}>
                {lowStockItems.length > 0 ? `${lowStockItems.length} Low Stock` : 'Stock Healthy'}
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {feedInventory.slice(0, 4).map(item => (
                <div key={item.id} className="p-2.5 bg-bg-farm rounded-2xl border border-border-farm">
                  <span className="text-[10px] text-text-muted font-bold truncate block">{item.item_name}</span>
                  <span className="text-base font-bold font-mono text-dark-green">
                    {Number(item.current_stock || 0).toLocaleString()} <span className="text-[10px] text-text-muted font-sans">{item.unit || 'bags'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('procurement')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Procure Grain & Finished Feed</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 5: General Livestock */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 text-teal-800 rounded-xl">
                  <Sparkles className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">General Livestock</h3>
                  <span className="text-[10.5px] text-text-muted">Turkeys, Goats, Sheep, Cattle</span>
                </div>
              </div>
              <span className="bg-teal-100 text-teal-900 text-[10px] font-black px-2.5 py-1 rounded-full">
                Diversified
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Headcount</span>
                <span className="text-2xl font-serif font-black text-dark-green font-mono">
                  {totalGeneralAnimals.toLocaleString()} <span className="text-xs text-text-muted font-sans">animals</span>
                </span>
              </div>

              <div className="bg-bg-farm rounded-2xl p-3 border border-border-farm grid grid-cols-2 gap-2 text-xs">
                {['Turkeys', 'Goats', 'Sheep', 'Ducks'].map(cat => {
                  const count = generalList
                    .filter(i => i.category === cat)
                    .reduce((sum, i) => sum + (Number(i.count_male || 0) + Number(i.count_female || 0) + Number(i.count_young || 0)), 0);
                  return (
                    <div key={cat} className="flex justify-between">
                      <span className="text-text-muted font-semibold">{cat}:</span>
                      <span className="font-mono font-bold text-dark-green">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('generallivestock')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Open General Livestock Registry</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 6: Operations & Payroll */}
        <div className="bg-white rounded-3xl border border-border-farm p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base leading-tight">Workforce & Operations</h3>
                  <span className="text-[10.5px] text-text-muted">{activeWorkers.length} active staff on roster</span>
                </div>
              </div>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-full">
                Payroll
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              <div>
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Today's Scheduled Off-Days</span>
                <span className="text-lg font-serif font-bold text-amber-800">
                  {activeWorkers.filter(w => (w.off_day || 'Sunday') === todayDayName).length} workers scheduled OFF today ({todayDayName})
                </span>
              </div>

              <div className="bg-bg-farm rounded-2xl p-3 border border-border-farm space-y-1 text-xs">
                <span className="text-[10px] text-text-muted font-bold block">Quick Roster Status:</span>
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Monthly Wage Bill:</span>
                  <span className="font-mono font-bold text-dark-green">
                    ₦{activeWorkers.reduce((sum, w) => sum + Number(w.base_salary || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActivePage && setActivePage('payroll')}
            className="w-full bg-bg-farm hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Open Payroll Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Daily Staff Attendance & Off-Day Compensation Manager ── */}
      <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-dark-green">
                Daily Staff Attendance & Off-Day Monetization
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Track present staff, honor scheduled weekly off-days, and seamlessly compensate workers who worked on their off-day without double-billing.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-bg-farm p-2 rounded-2xl border border-border-farm">
            <Calendar className="w-4 h-4 text-primary" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-dark-green focus:outline-none"
            />
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto rounded-2xl border border-border-farm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-black tracking-wider">
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Fixed Off-Day</th>
                <th className="p-3.5">Daily Rate (₦)</th>
                <th className="p-3.5 text-center">Attendance Status</th>
                <th className="p-3.5 text-right">Off-Day Allowance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-farm/50">
              {activeWorkers.map((w) => {
                const att = getWorkerAttendance(w.id);
                const currentStatus = att?.status || (w.off_day === todayDayName ? 'scheduled_off' : 'present');
                const isScheduledOffToday = (w.off_day || 'Sunday') === todayDayName;
                const dailyRate = Math.round((Number(w.base_salary) || 0) / 30);
                const isCompensated = att?.payment_mode && att.payment_mode !== 'none';

                return (
                  <tr key={w.id} className="hover:bg-bg-farm/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-dark-green">{w.name}</div>
                      <div className="text-[10.5px] text-text-muted capitalize">{w.worker_type || w.role}</div>
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        isScheduledOffToday 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : 'bg-bg-farm text-text-muted border border-border-farm'
                      }`}>
                        {w.off_day || 'Sunday'} {isScheduledOffToday ? '(Today!)' : ''}
                      </span>
                    </td>

                    <td className="p-3.5 font-mono font-bold text-dark-green">
                      ₦{dailyRate.toLocaleString()} <span className="text-[10px] text-text-muted font-sans">/day</span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1 bg-bg-farm p-1 rounded-xl border border-border-farm">
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(w.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            currentStatus === 'present' 
                              ? 'bg-emerald-600 text-white shadow-2xs' 
                              : 'text-text-muted hover:text-dark-green'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(w.id, 'scheduled_off')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            currentStatus === 'scheduled_off' 
                              ? 'bg-amber-500 text-white shadow-2xs' 
                              : 'text-text-muted hover:text-amber-800'
                          }`}
                        >
                          Off (Rested)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(w.id, 'worked_off_day')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            currentStatus === 'worked_off_day' 
                              ? 'bg-purple-600 text-white shadow-2xs' 
                              : 'text-text-muted hover:text-purple-800'
                          }`}
                        >
                          Worked Off-Day
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(w.id, 'absent')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            currentStatus === 'absent' 
                              ? 'bg-red-600 text-white shadow-2xs' 
                              : 'text-text-muted hover:text-red-700'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5 text-right">
                      {currentStatus === 'worked_off_day' ? (
                        isCompensated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Compensated (₦{att.compensation_amount?.toLocaleString()} • {att.payment_mode})</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenCompModal(w)}
                            className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-transform active:scale-95 inline-flex items-center gap-1.5"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>Compensate (₦{dailyRate.toLocaleString()})</span>
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-text-muted italic">Standard Duty</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Compensate Off-Day Worker ── */}
      {showCompModal && selectedWorkerForComp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Coins className="w-5 h-5 text-accent" />
                <span>Compensate Off-Day: {selectedWorkerForComp.name}</span>
              </div>
              <button 
                onClick={() => setShowCompModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompensation} className="p-6 space-y-4 text-xs font-sans">
              {compMessage && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  compMessage.type === 'success' ? 'bg-emerald-50 text-dark-green border-emerald-300' : 'bg-red-50 text-red-800 border-red-300'
                }`}>
                  {compMessage.text}
                </div>
              )}

              <div className="bg-bg-farm p-3.5 rounded-2xl border border-border-farm space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-muted">Staff Monthly Salary:</span>
                  <span className="font-mono font-bold text-dark-green">₦{Number(selectedWorkerForComp.base_salary || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Scheduled Weekly Off:</span>
                  <span className="font-bold text-amber-800">{selectedWorkerForComp.off_day || 'Sunday'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Allowance / Bonus Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={compAmount}
                  onChange={(e) => setCompAmount(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              {/* Payment Mode Selection */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  Payment Processing Mode *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    compPaymentMode === 'immediate'
                      ? 'bg-emerald-50/70 border-primary text-dark-green shadow-2xs'
                      : 'bg-bg-farm border-border-farm text-text-muted hover:border-primary/40'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <input
                        type="radio"
                        name="compMode"
                        value="immediate"
                        checked={compPaymentMode === 'immediate'}
                        onChange={() => setCompPaymentMode('immediate')}
                        className="text-primary focus:ring-primary"
                      />
                      <span>Pay Immediately</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 leading-snug">
                      Logs instantly in Daily Expenses Log (Cash/Transfer).
                    </span>
                  </label>

                  <label className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    compPaymentMode === 'payroll'
                      ? 'bg-emerald-50/70 border-primary text-dark-green shadow-2xs'
                      : 'bg-bg-farm border-border-farm text-text-muted hover:border-primary/40'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <input
                        type="radio"
                        name="compMode"
                        value="payroll"
                        checked={compPaymentMode === 'payroll'}
                        onChange={() => setCompPaymentMode('payroll')}
                        className="text-primary focus:ring-primary"
                      />
                      <span>Add to Payroll</span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 leading-snug">
                      Accrues as off-pay bonus in monthly payroll.
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  placeholder="e.g. Covered evening egg collection on off-day"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compSubmitting}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {compSubmitting ? 'Saving...' : 'Confirm & Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
