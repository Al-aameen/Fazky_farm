import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import WeatherWidget from '../components/WeatherWidget';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronRight, 
  AlertTriangle, 
  DollarSign, 
  Layers, 
  Calendar,
  Activity,
  User,
  ShoppingBag,
  CreditCard
} from 'lucide-react';

export default function Dashboard() {
  const { data } = useData();
  const { role } = useAuth();
  
  // Date state - defaults to the latest date available in logs, or today if empty
  const getLatestLogDate = () => {
    const dates = [
      ...(data.production_log || []).map(p => p.date),
      ...(data.sales_log || []).map(s => s.date),
      ...(data.expenses_log || []).map(e => e.date),
    ].filter(Boolean);
    
    if (dates.length > 0) {
      // Sort descending and get first
      return dates.sort((a, b) => new Date(b) - new Date(a))[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getLatestLogDate());

  const getYesterdayDate = (dateStr) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const yesterdayDate = getYesterdayDate(selectedDate);

  // 1. Total live laying birds (sum of census_counts for most recent date across all active pens)
  const getLayingBirdsCount = () => {
    const counts = data.census_counts || [];
    if (counts.length === 0) return 0;
    
    // Find latest date in census_counts
    const latestCensusDate = counts
      .map(c => c.date)
      .sort((a, b) => new Date(b) - new Date(a))[0];
      
    // Sum counts for that date
    return counts
      .filter(c => c.date === latestCensusDate)
      .reduce((sum, item) => sum + (item.bird_count || 0), 0);
  };

  // 2. Total other livestock count (from general_census) — exclude corrupt nan rows
  const getOtherLivestockCount = () => {
    return (data.general_census || [])
      .filter(item => item.category && item.category !== 'nan' && item.category !== 'NaN' && item.category !== 'undefined')
      .reduce((sum, item) => sum + (item.total || 0), 0);
  };

  // Helper: Get Egg Price for a date
  const getEggPriceForDate = (dateStr) => {
    const priceSettings = [...(data.egg_price_settings || [])]
      .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    
    // Find price active on dateStr
    const priceRecord = priceSettings.find(p => new Date(p.effective_date) <= new Date(dateStr));
    return priceRecord ? priceRecord.price_per_crate : 4400; // Default seed price
  };

  // 3. Today's egg production vs yesterday (with percentage trend arrow)
  const getEggProductionStats = () => {
    const logs = data.production_log || [];
    
    const todayLogs = logs.filter(l => l.date === selectedDate);
    const todayTotal = todayLogs.reduce((sum, l) => sum + (l.total_eggs || 0), 0);
    
    const yesterdayLogs = logs.filter(l => l.date === yesterdayDate);
    const yesterdayTotal = yesterdayLogs.reduce((sum, l) => sum + (l.total_eggs || 0), 0);
    
    let percentChange = 0;
    let trend = 'flat';
    
    if (yesterdayTotal > 0) {
      percentChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
      if (percentChange > 0) trend = 'up';
      else if (percentChange < 0) trend = 'down';
    } else if (todayTotal > 0) {
      trend = 'up';
      percentChange = 100;
    }
    
    return {
      today: todayTotal,
      yesterday: yesterdayTotal,
      percent: Math.abs(percentChange).toFixed(1),
      trend
    };
  };

  // 4. Today's total feed consumed
  const getTodayFeedConsumed = () => {
    return (data.production_log || [])
      .filter(l => l.date === selectedDate)
      .reduce((sum, l) => sum + (Number(l.total_feed) || 0), 0);
  };

  // 5. Total outstanding customer debt (computed from full sales_log history: invoiced minus payments)
  const getOutstandingCustomerDebt = () => {
    const sales = data.sales_log || [];
    const priceSettings = data.egg_price_settings || [];
    
    // Group transactions by customer
    const customerLedger = {};
    
    sales.forEach(sale => {
      const name = sale.customer_name;
      if (!customerLedger[name]) {
        customerLedger[name] = { invoiced: 0, paid: 0 };
      }
      
      if (!sale.is_payment) {
        // Invoice amount = crates * price_per_crate
        const price = getEggPriceForDate(sale.date);
        customerLedger[name].invoiced += (sale.crates || 0) * price;
      }
      
      // Payments received (cash, transfer, deposit)
      const payVal = (Number(sale.cash_paid) || 0) + 
                     (Number(sale.transfer_amount) || 0) + 
                     (Number(sale.deposit_amount) || 0);
      customerLedger[name].paid += payVal;
    });

    // Sum balances > 0
    return Object.values(customerLedger).reduce((totalDebt, cust) => {
      const balance = cust.invoiced - cust.paid;
      return totalDebt + (balance > 0 ? balance : 0);
    }, 0);
  };

  // 6. Admin Only Metrics: Revenue, Expenses, Profit, Worker Loans
  const getTodayRevenue = () => {
    // Sum all payments collected today
    return (data.sales_log || [])
      .filter(s => s.date === selectedDate)
      .reduce((sum, s) => {
        const amt = (Number(s.cash_paid) || 0) + 
                    (Number(s.transfer_amount) || 0) + 
                    (Number(s.deposit_amount) || 0);
        return sum + amt;
      }, 0);
  };

  const getTodayExpenses = () => {
    return (data.expenses_log || [])
      .filter(e => e.date === selectedDate)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  const getOutstandingWorkerLoans = () => {
    const loans = data.loans || [];
    const repayments = data.loan_repayments || [];
    
    let totalBorrowed = loans.reduce((sum, l) => sum + (Number(l.total_borrowed) || 0), 0);
    let totalRepaid = repayments.reduce((sum, r) => sum + (Number(r.repayment_made) || 0), 0);
    
    return Math.max(0, totalBorrowed - totalRepaid);
  };

  // Recent logs
  const getRecentSales = () => {
    return [...(data.sales_log || [])]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  };

  const getRecentExpenses = () => {
    return [...(data.expenses_log || [])]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  };

  // Flock summary grid (one card per pen showing pen name, worker name, current bird count)
  const getFlockSummary = () => {
    const pens = data.pens || [];
    const workers = data.workers || [];
    const census = data.census_counts || [];
    
    // Find latest census date
    const latestCensusDate = census
      .map(c => c.date)
      .sort((a, b) => new Date(b) - new Date(a))[0] || selectedDate;

    return pens.map(pen => {
      const worker = workers.find(w => w.id === pen.worker_id);
      
      // Calculate bird count for this pen on latestCensusDate
      const penCounts = census.filter(c => c.pen_id === pen.id && c.date === latestCensusDate);
      const totalBirds = penCounts.reduce((sum, c) => sum + (c.bird_count || 0), 0);

      return {
        id: pen.id,
        name: pen.name,
        generation: pen.generation,
        workerName: worker ? worker.name : 'Unassigned',
        birdCount: totalBirds
      };
    });
  };

  const eggStats = getEggProductionStats();
  const flockSummary = getFlockSummary();
  const recentSales = getRecentSales();
  const recentExpenses = getRecentExpenses();

  return (
    <div className="p-6 space-y-6">
      {/* Date Select Panel */}
      <div className="flex items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div>
            <span className="font-serif text-dark-green font-bold text-lg">Dashboard Overview</span>
            <div className="text-[10px] text-text-muted font-sans mt-0.5">
              Today: {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        <DatePicker 
          label="Record Date"
          value={selectedDate}
          onChange={setSelectedDate}
        />
      </div>

      {/* Farm Weather & Microclimate Telemetry */}
      <WeatherWidget />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Laying Poultry Card */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Live Laying Birds</span>
            <div className="text-3xl font-serif font-black text-dark-green">{getLayingBirdsCount().toLocaleString()}</div>
            <p className="text-[10px] text-text-muted">Total counted birds in pens</p>
          </div>
          <div className="bg-light-green p-2 rounded-xl text-primary font-bold">🐣</div>
        </div>

        {/* Other Livestock Card */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Other Livestock</span>
            <div className="text-3xl font-serif font-black text-dark-green">{getOtherLivestockCount().toLocaleString()}</div>
            <p className="text-[10px] text-text-muted">Rabbits, Turkeys, Broilers, etc.</p>
          </div>
          <div className="bg-light-green p-2 rounded-xl text-primary font-bold">🐰</div>
        </div>

        {/* Today's Egg Production */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Today's Egg Output</span>
            <div className="text-3xl font-serif font-black text-dark-green">{eggStats.today.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-[10px] font-bold">
              {eggStats.trend === 'up' && (
                <span className="text-primary flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded border border-green-150">
                  <TrendingUp className="w-3 h-3" /> +{eggStats.percent}% vs yesterday
                </span>
              )}
              {eggStats.trend === 'down' && (
                <span className="text-red-accent flex items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-150">
                  <TrendingDown className="w-3 h-3" /> -{eggStats.percent}% vs yesterday
                </span>
              )}
              {eggStats.trend === 'flat' && eggStats.today === 0 && eggStats.yesterday === 0 && (
                <span className="text-text-muted bg-bg-farm px-1.5 py-0.5 rounded border border-border-farm">No data yet today</span>
              )}
              {eggStats.trend === 'flat' && (eggStats.today > 0 || eggStats.yesterday > 0) && (
                <span className="text-text-muted bg-bg-farm px-1.5 py-0.5 rounded border border-border-farm">No change vs yesterday</span>
              )}
            </div>
          </div>
          <div className="bg-light-green p-2 rounded-xl text-primary font-bold">🪺</div>
        </div>

        {/* Customer Outstanding Debt */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Outstanding Debt</span>
            <div className="text-3xl font-serif font-black text-red-accent">₦{getOutstandingCustomerDebt().toLocaleString()}</div>
            <p className="text-[10px] text-text-muted">Total unpaid sales credit balance</p>
          </div>
          <div className="bg-red-50 p-2 rounded-xl text-red-accent font-bold">📊</div>
        </div>
      </div>

      {/* Admin Only Dashboard Widget */}
      {role === 'admin' && (
        <div className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-dark-green px-5 py-3.5 text-white font-serif font-bold text-sm tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <span>Admin-Only Financial Dashboard</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-5">
            <div className="border-r border-border-farm/60 pr-4 space-y-1.5">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Today's Revenue</span>
              <div className="text-2xl font-serif font-black text-primary">₦{getTodayRevenue().toLocaleString()}</div>
              <p className="text-[10px] text-text-muted font-sans">Payments received today</p>
            </div>
            
            <div className="border-r border-border-farm/60 pr-4 space-y-1.5">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Today's Expenses</span>
              <div className="text-2xl font-serif font-black text-red-accent">₦{getTodayExpenses().toLocaleString()}</div>
              <p className="text-[10px] text-text-muted font-sans">Purchases & costs today</p>
            </div>
            
            <div className="border-r border-border-farm/60 pr-4 space-y-1.5">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Net Profit</span>
              <div className="text-2xl font-serif font-black text-dark-green">
                ₦{(getTodayRevenue() - getTodayExpenses()).toLocaleString()}
              </div>
              <p className="text-[10px] text-text-muted font-sans">Net margin for today</p>
            </div>
            
            <div className="space-y-1.5">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Outstanding Worker Loans</span>
              <div className="text-2xl font-serif font-black text-amber-accent">₦{getOutstandingWorkerLoans().toLocaleString()}</div>
              <p className="text-[10px] text-text-muted font-sans">Outstanding staff advances</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed Inventory Warning Module - Phase 2 */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5 border-b border-border-farm pb-3">
            <Layers className="w-4 h-4 text-primary" />
            <span>Feed Stock Status</span>
          </h3>
          <div className="space-y-3">
            {(data.feed_inventory || []).map((feed) => {
              const pct = (feed.current_stock / (feed.low_stock_threshold * 2)) * 100;
              const isLow = feed.current_stock <= feed.low_stock_threshold;
              
              return (
                <div key={feed.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-primary">{feed.item_name}</span>
                    <span className={`font-mono font-bold ${isLow ? 'text-red-accent' : 'text-text-primary'}`}>
                      {feed.current_stock.toLocaleString()} {feed.unit}
                    </span>
                  </div>
                  <div className="w-full bg-bg-farm rounded-full h-2 overflow-hidden border border-border-farm/50">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLow ? 'bg-red-accent animate-pulse' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                    />
                  </div>
                  {isLow && (
                    <div className="flex items-center gap-1 text-[10px] text-red-accent font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Low Stock! Restock immediately (Threshold: {feed.low_stock_threshold})</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5 border-b border-border-farm pb-3">
            <Activity className="w-4 h-4 text-primary" />
            <span>Recent Activities</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                <span>Recent Egg Sales</span>
              </h4>
              <div className="space-y-2">
                {recentSales.length === 0 ? (
                  <p className="text-xs text-text-muted font-sans py-4 text-center">No sales recorded.</p>
                ) : (
                  recentSales.map(sale => (
                    <div key={sale.id} className="bg-bg-farm rounded-lg p-2.5 flex items-center justify-between text-xs border border-border-farm/50 hover:shadow-sm transition-all">
                      <div>
                        <div className="font-bold text-text-primary">{sale.customer_name}</div>
                        <div className="text-[10px] text-text-muted">{sale.date}</div>
                      </div>
                      <div className="text-right">
                        {sale.is_payment ? (
                          <span className="text-primary font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            +₦{((Number(sale.cash_paid) || 0) + (Number(sale.transfer_amount) || 0) + (Number(sale.deposit_amount) || 0)).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-text-primary font-bold">
                            {sale.crates} Crates
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expenses */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-red-accent" />
                <span>Recent Expenses</span>
              </h4>
              <div className="space-y-2">
                {recentExpenses.length === 0 ? (
                  <p className="text-xs text-text-muted font-sans py-4 text-center">No expenses recorded.</p>
                ) : (
                  recentExpenses.map(exp => (
                    <div key={exp.id} className="bg-bg-farm rounded-lg p-2.5 flex items-center justify-between text-xs border border-border-farm/50 hover:shadow-sm transition-all">
                      <div className="max-w-[70%]">
                        <div className="font-bold text-text-primary truncate">{exp.description}</div>
                        <div className="text-[10px] text-text-muted">{exp.date}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-red-accent font-bold">
                          -₦{exp.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flock Summary Grid */}
      <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5 border-b border-border-farm pb-3">
          <Layers className="w-4 h-4 text-primary" />
          <span>Flock & Pen Status</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {flockSummary.map((flock) => (
            <div key={flock.id} className="bg-bg-farm border border-border-farm/70 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="font-serif text-dark-green font-bold text-sm">{flock.name}</div>
                <div className="flex items-center gap-1 text-[10px] text-text-muted">
                  <User className="w-3 h-3" />
                  <span>{flock.workerName}</span>
                </div>
                {flock.generation && (
                  <div className="text-[9px] bg-accent/20 text-dark-green font-bold px-1.5 py-0.5 rounded w-max">
                    {flock.generation}
                  </div>
                )}
              </div>
              <div className="flex items-baseline justify-between border-t border-border-farm/50 pt-2">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Birds Count</span>
                <span className="text-base font-serif font-black text-primary">{flock.birdCount.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
