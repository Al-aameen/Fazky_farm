import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { 
  TrendingUp, 
  Coins, 
  User, 
  Plus, 
  DollarSign, 
  History,
  Download,
  Upload,
  BookOpen, 
  Wallet,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

export default function SalesLog() {
  const { data, insertRecord, bulkInsertRecords, ensureDateLoaded } = useData();
  const { role, worker } = useAuth();
  const salesImportRef = useRef(null);
  
  const [selectedDate, setSelectedDate] = useState('2026-08-05'); // Default seed date
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'debtors', 'history'

  // Auto-fetch historical month sales data if not cached
  React.useEffect(() => {
    if (selectedDate && ensureDateLoaded) {
      ensureDateLoaded('sales_log', selectedDate);
    }
  }, [selectedDate, ensureDateLoaded]);

  // Input states for new sale
  const [showAddSale, setShowAddSale] = useState(false);
  const [custName, setCustName] = useState('');
  const [crates, setCrates] = useState(0);
  const [cashPaid, setCashPaid] = useState(0);
  const [transferAmt, setTransferAmt] = useState(0);
  const [depositAmt, setDepositAmt] = useState(0);
  const [remarks, setRemarks] = useState('');

  // Payment states for carried forward debtors
  const [payExpandedId, setPayExpandedId] = useState(null); // customerName
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash'); // 'cash', 'transfer', 'deposit'
  const [payNotes, setPayNotes] = useState('');

  // Setting price state
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [newCratePrice, setNewCratePrice] = useState('');
  const [priceEffectiveDate, setPriceEffectiveDate] = useState('2026-08-05');

  // Error state (shared across all save operations on this page)
  const [errorMessage, setErrorMessage] = useState(null);

  // Helper: Get Egg Price active on a date
  const getEggPriceForDate = (dateStr) => {
    const priceSettings = [...(data.egg_price_settings || [])]
      .sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
    
    const priceRecord = priceSettings.find(p => new Date(p.effective_date) <= new Date(dateStr));
    return priceRecord ? priceRecord.price_per_crate : 4400; // Default seed price
  };

  const currentPrice = getEggPriceForDate(selectedDate);

  // Group transactions by customer and calculate full all-time balance ledger
  const getCustomerBalances = () => {
    const sales = data.sales_log || [];
    const ledger = {};

    sales.forEach(sale => {
      const name = sale.customer_name;
      if (!ledger[name]) {
        ledger[name] = { 
          name, 
          totalInvoiced: 0, 
          totalPaid: 0, 
          balance: 0, 
          history: [] 
        };
      }

      const price = getEggPriceForDate(sale.date);
      const invoiceAmt = sale.is_payment ? 0 : (sale.crates || 0) * price;
      const payVal = (Number(sale.cash_paid) || 0) + 
                     (Number(sale.transfer_amount) || 0) + 
                     (Number(sale.deposit_amount) || 0);

      ledger[name].totalInvoiced += invoiceAmt;
      ledger[name].totalPaid += payVal;
      ledger[name].history.push(sale);
    });

    // Compute balance and sort history
    Object.keys(ledger).forEach(name => {
      ledger[name].balance = ledger[name].totalInvoiced - ledger[name].totalPaid;
      ledger[name].history.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return ledger;
  };

  const customerBalances = getCustomerBalances();
  const debtorsList = Object.values(customerBalances).filter(c => c.balance > 0);

  // Today's Sales list
  const getTodaySales = () => {
    return (data.sales_log || [])
      .filter(s => s.date === selectedDate)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const todaySales = getTodaySales();

  // Debt Banner Statistics
  const getDebtBannerStats = () => {
    // 1. Total outstanding debt across all customers
    const totalOutstanding = debtorsList.reduce((sum, c) => sum + c.balance, 0);

    // 2. Today's revenue (total invoiced today)
    const todayRevenue = todaySales
      .filter(s => !s.is_payment)
      .reduce((sum, s) => sum + (s.crates * getEggPriceForDate(s.date)), 0);

    // 3. Collected today (payments received today)
    const todayCollected = todaySales.reduce((sum, s) => {
      return sum + (Number(s.cash_paid) || 0) + 
                   (Number(s.transfer_amount) || 0) + 
                   (Number(s.deposit_amount) || 0);
    }, 0);

    // 4. New debt created today
    const todayNewDebt = todaySales
      .filter(s => !s.is_payment)
      .reduce((sum, s) => {
        const price = getEggPriceForDate(s.date);
        const inv = s.crates * price;
        const paid = (Number(s.cash_paid) || 0) + 
                     (Number(s.transfer_amount) || 0) + 
                     (Number(s.deposit_amount) || 0);
        const rem = inv - paid;
        return sum + (rem > 0 ? rem : 0);
      }, 0);

    return {
      totalOutstanding,
      todayRevenue,
      todayCollected,
      todayNewDebt
    };
  };

  const stats = getDebtBannerStats();

  const handleAddSaleSubmit = async (e) => {
    e.preventDefault();
    if (!custName || crates <= 0) return;
    setErrorMessage(null);

    try {
      const dayOfWeekStr = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
      await insertRecord('sales_log', {
        date: selectedDate,
        day_of_week: dayOfWeekStr,
        customer_name: custName,
        crates: Number(crates),
        cash_paid: Number(cashPaid),
        transfer_amount: Number(transferAmt),
        deposit_amount: Number(depositAmt),
        is_payment: false,
        remarks: remarks || '',
        created_by: worker?.id || null
      });

      // Only clear form on success
      setShowAddSale(false);
      setCustName('');
      setCrates(0);
      setCashPaid(0);
      setTransferAmt(0);
      setDepositAmt(0);
      setRemarks('');
    } catch (err) {
      console.error('Failed to save sale log:', err);
      setErrorMessage(err?.message || 'Failed to save sale. Your data is still on screen.');
    }
  };

  const handleRecordPayment = async (customerName) => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return;
    setErrorMessage(null);

    try {
      const dayOfWeekStr = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
      const payload = {
        date: selectedDate,
        day_of_week: dayOfWeekStr,
        customer_name: customerName,
        crates: 0,
        cash_paid: payMethod === 'cash' ? amt : 0,
        transfer_amount: payMethod === 'transfer' ? amt : 0,
        deposit_amount: payMethod === 'deposit' ? amt : 0,
        is_payment: true,
        remarks: payNotes || 'Debtor payment entry',
        created_by: worker?.id || null
      };

      await insertRecord('sales_log', payload);
      // Only clear on success
      setPayExpandedId(null);
      setPayAmount('');
      setPayNotes('');
    } catch (err) {
      console.error('Failed to save debtor payment:', err);
      setErrorMessage(err?.message || 'Failed to record payment. Your data is still on screen.');
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    const price = parseFloat(newCratePrice);
    if (isNaN(price) || price <= 0) return;
    setErrorMessage(null);

    try {
      await insertRecord('egg_price_settings', {
        price_per_crate: price,
        effective_date: priceEffectiveDate,
        set_by: worker?.id || null
      });
      // Only clear on success
      setShowPriceSettings(false);
      setNewCratePrice('');
    } catch (err) {
      console.error('Failed to set price:', err);
      setErrorMessage(err?.message || 'Failed to update crate price.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Error Banner */}
      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-xs text-red-800 font-sans shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">Error — your data is still on screen</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="shrink-0 text-red-500 hover:text-red-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* 1. Debt Banner (Section 6.4.2) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-accent" />
            <span className="font-serif text-dark-green font-bold text-base">Sales Credit Summary</span>
          </div>
          <div className="text-sm font-bold text-text-muted flex items-center gap-1.5 bg-white border border-border-farm px-3 py-1 rounded-full shadow-sm">
            <span>Current Egg Price:</span>
            <span className="text-primary font-black">₦{currentPrice.toLocaleString()} / crate</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div>
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Outstanding Debt</div>
            <div className="text-2xl font-serif font-black text-red-accent mt-0.5">
              ₦{stats.totalOutstanding.toLocaleString()}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Across all client ledgers</p>
          </div>
          <div>
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Today's Revenue</div>
            <div className="text-2xl font-serif font-black text-dark-green mt-0.5">
              ₦{stats.todayRevenue.toLocaleString()}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Egg sales value invoiced today</p>
          </div>
          <div>
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Collected Today</div>
            <div className="text-2xl font-serif font-black text-primary mt-0.5">
              ₦{stats.todayCollected.toLocaleString()}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Total cash/transfers received today</p>
          </div>
          <div>
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">New Debt Created Today</div>
            <div className="text-2xl font-serif font-black text-red-accent mt-0.5 font-bold">
              ₦{stats.todayNewDebt.toLocaleString()}
            </div>
            <p className="text-[9px] text-text-muted mt-0.5">Unpaid invoice portions today</p>
          </div>
        </div>
      </div>

      {/* Tabs Menu & Quick Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-border-farm pb-3">
        <div className="flex bg-white p-1 rounded-xl border border-border-farm shadow-sm">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'today'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Today's Sales
          </button>
          <button
            onClick={() => setActiveTab('debtors')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'debtors'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Debtors Ledger
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Full History
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Target Date Picker */}
          {activeTab === 'today' && (
            <DatePicker
              label="Date"
              value={selectedDate}
              onChange={setSelectedDate}
            />
          )}

          {/* Import CSV/Excel Button */}
          <input
            type="file"
            ref={salesImportRef}
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = await parseImportFile(file);
                const result = await bulkInsertRecords('sales_log', rows);
                alert(`✅ Imported ${result?.count ?? rows.length} sales records successfully.`);
              } catch (err) {
                alert('❌ Import failed: ' + err.message);
              } finally {
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => salesImportRef.current?.click()}
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Import Sales Log from CSV or Excel file"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Import CSV/Excel</span>
          </button>

          {/* Export Action Button */}
          <button
            type="button"
            onClick={() => exportToExcel(`fazky_sales_log_${selectedDate}`, 'Sales', data.sales_log || [])}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Export Sales Log to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Pricing settings (Admin only) */}
          {role === 'admin' && (
            <button
              onClick={() => setShowPriceSettings(true)}
              className="bg-white border border-border-farm hover:bg-bg-farm text-text-primary p-2 rounded-lg transition-colors shadow-sm"
              title="Crate Pricing Settings"
            >
              <Settings className="w-4 h-4 text-text-muted" />
            </button>
          )}

          <button
            onClick={() => setShowAddSale(true)}
            className="flex items-center gap-1 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all w-full md:w-auto justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Egg Sale
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'today' && (
        <div className="space-y-6 animate-fade-in">
          {/* Daily Sales Ledger */}
          <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-serif text-dark-green font-bold text-base">Sales Records for {selectedDate}</h3>
            
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                    <th className="p-3 w-12 text-center">S/N</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-center">Crates</th>
                    <th className="p-3 text-right">Cash Paid</th>
                    <th className="p-3 text-right">Transfer</th>
                    <th className="p-3 text-right">Deposit</th>
                    <th className="p-3 text-right font-bold text-dark-green">Remaining</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-farm/60">
                  {todaySales.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-text-muted font-sans text-xs">
                        No sales transactions recorded for this date. Click "Record Egg Sale" to write a row.
                      </td>
                    </tr>
                  ) : (
                    todaySales.map((sale, idx) => {
                      const price = getEggPriceForDate(sale.date);
                      const inv = sale.is_payment ? 0 : (sale.crates || 0) * price;
                      const paid = (Number(sale.cash_paid) || 0) + 
                                   (Number(sale.transfer_amount) || 0) + 
                                   (Number(sale.deposit_amount) || 0);
                      const remaining = inv - paid;
                      const isDebtor = remaining > 0;

                      return (
                        <tr key={sale.id} className="hover:bg-bg-farm/20">
                          <td className="p-3 text-center font-mono font-bold text-text-muted">{idx + 1}</td>
                          <td className="p-3 font-bold text-text-primary">
                            {sale.customer_name}
                            {sale.is_payment && (
                              <span className="ml-2 text-[9px] bg-green-50 text-primary border border-green-200 font-bold px-1.5 py-0.5 rounded font-sans uppercase">
                                Payment Entry
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">{sale.is_payment ? '—' : sale.crates}</td>
                          <td className="p-3 text-right font-mono">₦{sale.cash_paid.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">₦{sale.transfer_amount.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">₦{sale.deposit_amount.toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-bold ${isDebtor ? 'text-red-accent' : 'text-primary'}`}>
                            {sale.is_payment ? '—' : `₦${remaining.toLocaleString()}`}
                          </td>
                          <td className="p-3 text-center">
                            {sale.is_payment ? (
                              <span className="bg-green-50 text-primary border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Settlement
                              </span>
                            ) : isDebtor ? (
                              <span className="bg-red-50 text-red-accent border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Debtor
                              </span>
                            ) : (
                              <span className="bg-green-50 text-primary border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Cleared
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-text-muted italic">{sale.remarks || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Carried-Forward Debtors (Section 6.4.4) */}
          <div className="bg-red-50/40 border border-red-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-red-200 pb-3">
              <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-accent" />
                <span>Carried-Forward Debtors</span>
              </h3>
              <span className="text-[10px] text-red-accent font-bold uppercase tracking-wider">
                Accounts with outstanding credit
              </span>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-red-50 border-b border-red-200 font-bold text-red-700 uppercase tracking-wider">
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-right">Total Invoiced (All-Time)</th>
                    <th className="p-3 text-right">Total Paid (All-Time)</th>
                    <th className="p-3 text-right font-black text-red-800">Current Balance</th>
                    <th className="p-3 text-center">Settlement Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-200/50">
                  {debtorsList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-text-muted font-sans text-xs italic">
                        No carried-forward debtor accounts. All client balances are fully cleared!
                      </td>
                    </tr>
                  ) : (
                    debtorsList.map((debtor) => {
                      const isExpanded = payExpandedId === debtor.name;
                      return (
                        <React.Fragment key={debtor.name}>
                          <tr className="hover:bg-red-50/60 font-medium">
                            <td className="p-3 font-bold text-text-primary">{debtor.name}</td>
                            <td className="p-3 text-right font-mono">₦{debtor.totalInvoiced.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">₦{debtor.totalPaid.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono font-black text-red-accent text-sm">
                              ₦{debtor.balance.toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => {
                                  setPayExpandedId(isExpanded ? null : debtor.name);
                                  setPayAmount(debtor.balance.toString());
                                }}
                                className="bg-white hover:bg-red-50 border border-red-300 text-red-accent font-bold px-3 py-1 rounded-lg text-xs shadow-sm transition-all"
                              >
                                {isExpanded ? 'Hide' : 'Pay'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Pay Drawer */}
                          {isExpanded && (
                            <tr className="bg-red-50/20">
                              <td colSpan="5" className="p-4 border-t border-red-200/40">
                                <div className="max-w-xl bg-white border border-red-200 rounded-xl p-4 shadow-md space-y-4">
                                  <div className="text-xs font-serif font-bold text-dark-green">
                                    Record Payment Receipt for {debtor.name}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                                        Amount (₦)
                                      </label>
                                      <input
                                        type="number"
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                        className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-semibold font-mono"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                                        Payment Method
                                      </label>
                                      <select
                                        value={payMethod}
                                        onChange={(e) => setPayMethod(e.target.value)}
                                        className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none font-bold text-text-primary"
                                      >
                                        <option value="cash">Cash</option>
                                        <option value="transfer">Bank Transfer</option>
                                        <option value="deposit">Deposit</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                                        Notes / Reference
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Cash paid to manager"
                                        value={payNotes}
                                        onChange={(e) => setPayNotes(e.target.value)}
                                        className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => setPayExpandedId(null)}
                                      className="px-3 py-1.5 border border-border-farm rounded-lg hover:bg-bg-farm font-bold"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRecordPayment(debtor.name)}
                                      className="px-3.5 py-1.5 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                                    >
                                      Confirm Settlement
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'debtors' && (
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-serif text-dark-green font-bold text-base">Full Debtor Ledgers</h3>
          <div className="space-y-4">
            {debtorsList.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">No outstanding client debts.</p>
            ) : (
              debtorsList.map(debtor => (
                <div key={debtor.name} className="border border-border-farm rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-bg-farm p-3 flex justify-between items-center text-xs font-bold border-b border-border-farm">
                    <span className="font-serif text-dark-green font-bold text-sm">{debtor.name}</span>
                    <span className="text-red-accent font-black font-mono">Current Balance: ₦{debtor.balance.toLocaleString()}</span>
                  </div>
                  
                  <div className="p-4 space-y-2">
                    <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2">Transaction History</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                      {debtor.history.map(tx => {
                        const isPay = tx.is_payment;
                        const price = getEggPriceForDate(tx.date);
                        const invVal = isPay ? 0 : (tx.crates * price);
                        const paidVal = (Number(tx.cash_paid) || 0) + (Number(tx.transfer_amount) || 0) + (Number(tx.deposit_amount) || 0);

                        return (
                          <div key={tx.id} className="bg-bg-farm/40 rounded p-2 text-xs flex justify-between items-center font-sans border border-border-farm/30">
                            <div>
                              <div className="font-bold text-text-primary">
                                {isPay ? 'Debt Settlement Payment' : `Egg Sale (${tx.crates} Crates)`}
                              </div>
                              <div className="text-[9px] text-text-muted mt-0.5">{tx.date} • {tx.remarks || 'No notes'}</div>
                            </div>
                            <div className="text-right font-mono text-[11px]">
                              {!isPay && <div className="text-text-primary">Invoiced: ₦{invVal.toLocaleString()}</div>}
                              <div className="text-primary font-bold">Paid: ₦{paidVal.toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-serif text-dark-green font-bold text-base">All Historical Transactions</h3>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">Crates</th>
                  <th className="p-3 text-right">Cash Received</th>
                  <th className="p-3 text-right">Transfer Received</th>
                  <th className="p-3 text-right">Deposit Received</th>
                  <th className="p-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {[...(data.sales_log || [])]
                  .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))
                  .map(row => (
                    <tr key={row.id} className="hover:bg-bg-farm/20">
                      <td className="p-3 font-mono font-bold text-text-primary">{row.date}</td>
                      <td className="p-3 font-bold text-text-primary">{row.customer_name}</td>
                      <td className="p-3 text-center">
                        {row.is_payment ? (
                          <span className="bg-green-50 border border-green-200 text-primary font-bold px-2 py-0.5 rounded text-[10px]">
                            Payment
                          </span>
                        ) : (
                          <span className="bg-blue-50 border border-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                            Sale
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">{row.is_payment ? '—' : row.crates}</td>
                      <td className="p-3 text-right font-mono">₦{row.cash_paid.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">₦{row.transfer_amount.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">₦{row.deposit_amount.toLocaleString()}</td>
                      <td className="p-3 text-text-muted italic">{row.remarks || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Record Egg Sale Modal */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[480px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Record Egg Sale Transaction</span>
              <button 
                onClick={() => setShowAddSale(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSaleSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Alhaji Ibrahim"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Crates Sold
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={crates}
                    onChange={(e) => setCrates(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Calculated Price</div>
                  <div className="bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-bold text-primary font-mono text-center">
                    ₦{(crates * currentPrice).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-border-farm/50 pt-3">
                <div>
                  <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Cash Paid (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Transfer (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={transferAmt}
                    onChange={(e) => setTransferAmt(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Deposit (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={depositAmt}
                    onChange={(e) => setDepositAmt(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Partly paid, balance next week"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddSale(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Price Settings Modal */}
      {showPriceSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[360px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Egg Crate Price Settings</span>
              <button 
                onClick={() => setShowPriceSettings(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePrice} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Price per Crate (₦)
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  value={newCratePrice}
                  onChange={(e) => setNewCratePrice(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  required
                  value={priceEffectiveDate}
                  onChange={(e) => setPriceEffectiveDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowPriceSettings(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Set New Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
