import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { Plus, Receipt, Calendar, CreditCard, ChevronRight } from 'lucide-react';

export default function ExpensesLog() {
  const { data, insertRecord } = useData();
  const { worker } = useAuth();
  
  // Set month filter state (defaults to latest recorded month, e.g. "2026-08")
  const getLatestExpensesMonth = () => {
    const dates = (data.expenses_log || []).map(e => e.date).filter(Boolean);
    if (dates.length > 0) {
      const sorted = dates.sort((a, b) => new Date(b) - new Date(a));
      return sorted[0].substring(0, 7); // YYYY-MM
    }
    return new Date().toISOString().substring(0, 7);
  };

  const [selectedMonth, setSelectedMonth] = useState(getLatestExpensesMonth());
  const [showAddExpense, setShowAddExpense] = useState(false);

  // New Expense form inputs
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expRemarks, setExpRemarks] = useState('');

  // Filter expenses by selectedMonth (YYYY-MM)
  const getFilteredExpenses = () => {
    return (data.expenses_log || [])
      .filter(e => e.date && e.date.substring(0, 7) === selectedMonth)
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at));
  };

  const filteredExpenses = getFilteredExpenses();

  // Group by date
  const getGroupedExpenses = () => {
    const groups = {};
    filteredExpenses.forEach(exp => {
      const d = exp.date;
      if (!groups[d]) {
        groups[d] = {
          date: d,
          items: [],
          subtotal: 0
        };
      }
      groups[d].items.push(exp);
      groups[d].subtotal += (Number(exp.amount) || 0);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const groupedExpenses = getGroupedExpenses();

  // Monthly total
  const getMonthlyTotal = () => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expAmt);
    if (!expDesc || isNaN(amt) || amt <= 0) return;

    try {
      const dayOfWeekStr = new Date(expDate).toLocaleDateString('en-US', { weekday: 'long' });
      await insertRecord('expenses_log', {
        date: expDate,
        day_of_week: dayOfWeekStr,
        description: expDesc,
        amount: amt,
        remarks: expRemarks || '',
        created_by: worker?.id || null
      });

      setShowAddExpense(false);
      setExpDesc('');
      setExpAmt('');
      setExpRemarks('');
    } catch (err) {
      console.error('Failed to log expense:', err);
    }
  };

  // Generate Month list helper
  const getMonthsList = () => {
    const list = new Set();
    // Default current month
    list.add(new Date().toISOString().substring(0, 7));
    
    // Add existing
    (data.expenses_log || []).forEach(e => {
      if (e.date) list.add(e.date.substring(0, 7));
    });

    return Array.from(list).sort((a, b) => new Date(b) - new Date(a));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Metrics Card & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Monthly Summary Card */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between md:col-span-1">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Monthly Outflow</span>
            <div className="text-3xl font-serif font-black text-red-accent">
              ₦{getMonthlyTotal().toLocaleString()}
            </div>
            <p className="text-[10px] text-text-muted">Total expenses in {selectedMonth}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-xl text-red-accent font-bold">💳</div>
        </div>

        {/* Filter and Action Panel */}
        <div className="bg-white border border-border-farm rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between md:col-span-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-5 h-5 text-primary" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-bg-farm border border-border-farm rounded-lg px-3 py-1.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-accent font-bold text-text-primary w-full sm:w-auto"
            >
              {getMonthsList().map(m => {
                const dateObj = new Date(m + "-02"); // Add offset
                const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </div>

          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Log Farm Expense
          </button>
        </div>
      </div>

      {/* Main Expenses List */}
      <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5 border-b border-border-farm pb-3">
          <Receipt className="w-4.5 h-4.5 text-primary" />
          <span>Expenditure Records</span>
        </h3>

        <div className="space-y-6">
          {groupedExpenses.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8 font-sans">
              No expenses logged for this month.
            </p>
          ) : (
            groupedExpenses.map(group => (
              <div key={group.date} className="space-y-2">
                {/* Date header */}
                <div className="flex justify-between items-center text-xs font-bold bg-bg-farm/70 border border-border-farm/60 px-3 py-2 rounded-lg">
                  <span className="text-dark-green font-serif">{group.date}</span>
                  <span className="text-red-accent font-mono">Subtotal: -₦{group.subtotal.toLocaleString()}</span>
                </div>

                {/* Expense Items list */}
                <div className="divide-y divide-border-farm/40 pl-2">
                  {group.items.map(item => (
                    <div key={item.id} className="py-3 flex justify-between items-start text-xs font-sans">
                      <div className="space-y-1 max-w-[70%]">
                        <div className="font-bold text-text-primary text-sm">{item.description}</div>
                        {item.remarks && (
                          <div className="text-[10px] text-text-muted italic flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span>{item.remarks}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono font-black text-red-accent text-sm py-1">
                        -₦{item.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADD EXPENSE MODAL */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Farm Expense</span>
              <button 
                onClick={() => setShowAddExpense(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddExpenseSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Expense Date
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Description / Item Purchased
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. diesel generator repair, layer bags purchase"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Amount Spent (₦)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expAmt}
                  onChange={(e) => setExpAmt(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  value={expRemarks}
                  onChange={(e) => setExpRemarks(e.target.value)}
                  placeholder="Additional notes about purchase..."
                  rows="2"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
