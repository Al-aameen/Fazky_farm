import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { Calendar, HelpCircle, Check, FileText, BadgePlus, AlertCircle } from 'lucide-react';

export default function Payroll() {
  const { data, insertRecord } = useData();
  const { role } = useAuth();
  
  const [selectedMonth, setSelectedMonth] = useState('2026-08'); // Default seed month
  const [showConfirmRun, setShowConfirmRun] = useState(false);
  const [runSuccess, setRunSuccess] = useState(false);

  // Modal for logging bonus
  const [showAddBonus, setShowAddBonus] = useState(false);
  const [bonusWorkerId, setBonusWorkerId] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusRemarks, setBonusRemarks] = useState('');

  // Get active non-admin workers
  const getActiveWorkers = () => {
    return (data.workers || []).filter(w => w.status === 'active' && w.role !== 'admin');
  };

  const activeWorkers = getActiveWorkers();

  // Helper: Get active loan and its balance for a worker
  const getWorkerLoanDetails = (workerId) => {
    const activeLoan = (data.loans || []).find(l => l.worker_id === workerId);
    if (!activeLoan) return null;

    // Calculate balance
    const repayments = (data.loan_repayments || []).filter(r => r.loan_id === activeLoan.id);
    const totalPaid = repayments.reduce((sum, r) => sum + (Number(r.repayment_made) || 0), 0);
    const remainingBalance = Math.max(0, Number(activeLoan.total_borrowed) - totalPaid);

    return {
      loan: activeLoan,
      balance: remainingBalance,
      monthlyDeduction: remainingBalance > 0 ? Math.min(remainingBalance, activeLoan.monthly_amount) : 0
    };
  };

  // Helper: Get off-pay bonuses for a worker in the selected month
  const getWorkerBonuses = (workerId) => {
    const list = (data.off_pays || []).filter(o => o.worker_id === workerId && o.date.substring(0, 7) === selectedMonth);
    // Only sum bonuses that are designated for payroll (exclude immediate cash/transfer daily expenses)
    const accruedBonuses = list.filter(o => o.payment_mode !== 'immediate');
    const immediateBonuses = list.filter(o => o.payment_mode === 'immediate');
    const sum = accruedBonuses.reduce((total, item) => total + (Number(item.amount) || 0), 0);
    return {
      list,
      accruedBonuses,
      immediateBonuses,
      sum
    };
  };

  // Calculate payroll rows
  const getPayrollRows = () => {
    return activeWorkers.map(w => {
      const base = Number(w.base_salary) || 0;
      
      // Get off-pay bonuses
      const { sum: bonusSum, list: bonusList } = getWorkerBonuses(w.id);
      
      // Get loan details
      const loanDetails = getWorkerLoanDetails(w.id);
      const loanDeduction = loanDetails ? loanDetails.monthlyDeduction : 0;
      
      const netPay = base + bonusSum - loanDeduction;

      return {
        worker: w,
        base,
        bonusSum,
        bonusList,
        loanDetails,
        loanDeduction,
        netPay
      };
    });
  };

  const payrollRows = getPayrollRows();

  const handleRunPayroll = async () => {
    setShowConfirmRun(false);
    setRunSuccess(false);

    try {
      // Record payroll entries
      const dateStr = `${selectedMonth}-28`; // Typically paid on 28th of the month
      const monthLabel = new Date(selectedMonth + "-02").toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      for (const row of payrollRows) {
        if (row.loanDetails && row.loanDeduction > 0) {
          // Record loan repayment row (deduct balance)
          await insertRecord('loan_repayments', {
            loan_id: row.loanDetails.loan.id,
            date: dateStr,
            amount_repayable: row.loanDetails.loan.monthly_amount,
            repayment_made: row.loanDeduction,
            balance: Math.max(0, row.loanDetails.balance - row.loanDeduction),
            comments: `Payroll auto-deduction for ${monthLabel}`
          });
        }
      }

      setRunSuccess(true);
      setTimeout(() => setRunSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to run payroll batch:', err);
    }
  };

  const handleAddBonusSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(bonusAmount);
    if (!bonusWorkerId || isNaN(amt) || amt <= 0) return;

    try {
      const dateStr = `${selectedMonth}-15`; // Default middle of the month
      await insertRecord('off_pays', {
        date: dateStr,
        worker_id: bonusWorkerId,
        amount: amt,
        remarks: bonusRemarks || 'Off-Pay Performance Bonus'
      });

      setShowAddBonus(false);
      setBonusWorkerId('');
      setBonusAmount('');
      setBonusRemarks('');
    } catch (err) {
      console.error('Failed to save bonus:', err);
    }
  };

  // Get full list of months
  const getMonthsList = () => {
    const list = new Set();
    list.add('2026-08');
    list.add('2026-07');
    list.add('2026-06');
    list.add(new Date().toISOString().substring(0, 7));
    return Array.from(list).sort((a, b) => new Date(b) - new Date(a));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">Payroll Management</h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Net salary calculations and loan deductions
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wide">Select Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-bg-farm border border-border-farm rounded-lg px-3 py-1.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-accent font-bold text-text-primary"
            >
              {getMonthsList().map(m => {
                const dateObj = new Date(m + "-02");
                const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </div>

          {/* Add Bonus */}
          <button
            onClick={() => setShowAddBonus(true)}
            className="flex items-center gap-1.5 bg-white border border-border-farm hover:bg-bg-farm text-primary font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition-all"
          >
            <BadgePlus className="w-4 h-4" />
            Add Bonus
          </button>

          {/* Run Payroll */}
          <button
            onClick={() => setShowConfirmRun(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-md transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Run Payroll Batch
          </button>
        </div>
      </div>

      {runSuccess && (
        <div className="bg-green-50 border border-green-200 text-primary text-sm rounded-xl p-4 flex gap-2.5 items-center animate-fade-in shadow-sm">
          <Check className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">Payroll Batch Run Succeeded!</span> Loan repayment deductions were processed and logged.
          </div>
        </div>
      )}

      {/* Main Payroll Grid */}
      <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-serif text-dark-green font-bold text-base border-b border-border-farm pb-3">
          Salary Breakdown for {new Date(selectedMonth + "-02").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                <th className="p-3">Worker Name</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Base Salary (₦)</th>
                <th className="p-3 text-right text-primary font-bold">Off-Pay Bonuses (₦)</th>
                <th className="p-3 text-right text-red-accent font-bold">Loan Deductions (₦)</th>
                <th className="p-3 text-right font-black text-dark-green bg-green-50/20 text-sm">Net Pay (₦)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-farm/60">
              {payrollRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-text-muted font-sans text-xs">
                    No active workers found.
                  </td>
                </tr>
              ) : (
                payrollRows.map(row => (
                  <tr key={row.worker.id} className="hover:bg-bg-farm/20">
                    <td className="p-3 font-bold text-text-primary">{row.worker.name}</td>
                    <td className="p-3 font-medium text-text-muted uppercase tracking-widest text-[9px]">{row.worker.role}</td>
                    <td className="p-3 text-right font-mono text-text-primary">₦{row.base.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-primary font-bold">
                      ₦{row.bonusSum.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-red-accent font-bold">
                      -₦{row.loanDeduction.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-dark-green bg-green-50/10 text-sm">
                      ₦{row.netPay.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRM PAYROLL RUN MODAL */}
      {showConfirmRun && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-red-50 p-4 text-red-800 font-serif font-bold text-base flex justify-between items-center border-b border-red-200">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-5 h-5 text-red-700 animate-pulse" />
                <span>Confirm Payroll Batch Run</span>
              </span>
              <button 
                onClick={() => setShowConfirmRun(false)}
                className="text-red-800/60 hover:text-red-800 font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 font-sans text-xs">
              <p className="text-text-primary leading-relaxed">
                Are you sure you want to run payroll for <span className="font-bold text-dark-green">
                  {new Date(selectedMonth + "-02").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>?
              </p>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-800 space-y-1">
                <div className="font-bold">Important Consequences:</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>This will generate automatic monthly advance repayments for all workers with active loans.</li>
                  <li>This action represents an official financial closing batch and cannot be undone.</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowConfirmRun(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunPayroll}
                  className="px-4 py-2 bg-red-accent hover:bg-red-800 text-white rounded-lg font-bold shadow-sm"
                >
                  Confirm Run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD BONUS MODAL */}
      {showAddBonus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[360px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Off-Pay Bonus</span>
              <button 
                onClick={() => setShowAddBonus(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddBonusSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Select Staff Worker
                </label>
                <select
                  required
                  value={bonusWorkerId}
                  onChange={(e) => setBonusWorkerId(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                >
                  <option value="">Select staff</option>
                  {activeWorkers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Bonus Amount (₦)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Reason / Remarks
                </label>
                <input
                  type="text"
                  required
                  value={bonusRemarks}
                  onChange={(e) => setBonusRemarks(e.target.value)}
                  placeholder="e.g. Sallah celebration bonus, extra production bonus"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddBonus(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Bonus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
