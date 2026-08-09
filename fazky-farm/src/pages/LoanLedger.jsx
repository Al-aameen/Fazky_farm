import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { Plus, PiggyBank, History, User, Percent, HelpCircle } from 'lucide-react';

export default function LoanLedger() {
  const { data, insertRecord } = useData();
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  // Modals visibility
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddRepayment, setShowAddRepayment] = useState(false);

  // New Loan Form Inputs
  const [loanWorkerId, setLoanWorkerId] = useState('');
  const [loanTotal, setLoanTotal] = useState('');
  const [loanMonths, setLoanMonths] = useState(12);

  // New Repayment Form Inputs
  const [repDate, setRepDate] = useState(new Date().toISOString().split('T')[0]);
  const [repAmount, setRepAmount] = useState('');
  const [repComments, setRepComments] = useState('');

  // Calculate stats for each loan
  const getLoanStats = (loan) => {
    const repayments = (data.loan_repayments || []).filter(r => r.loan_id === loan.id);
    const totalPaid = repayments.reduce((sum, r) => sum + (Number(r.repayment_made) || 0), 0);
    const balance = Math.max(0, Number(loan.total_borrowed) - totalPaid);
    const percentPaid = Math.min(100, (totalPaid / (Number(loan.total_borrowed) || 1)) * 100);

    return {
      totalPaid,
      balance,
      percentPaid,
      repayments
    };
  };

  const handleAddLoanSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(loanTotal);
    const months = parseInt(loanMonths, 10);
    if (!loanWorkerId || isNaN(total) || isNaN(months) || months <= 0) return;

    try {
      const monthlyAmt = Math.round((total / months) * 100) / 100;
      await insertRecord('loans', {
        worker_id: loanWorkerId,
        total_borrowed: total,
        duration_months: months,
        monthly_amount: monthlyAmt
      });

      setShowAddLoan(false);
      setLoanWorkerId('');
      setLoanTotal('');
      setLoanMonths(12);
    } catch (err) {
      console.error('Failed to issue loan:', err);
    }
  };

  const handleAddRepaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(repAmount);
    if (isNaN(amt) || amt <= 0 || !selectedLoanId) return;

    try {
      const loan = (data.loans || []).find(l => l.id === selectedLoanId);
      if (!loan) return;

      const { balance } = getLoanStats(loan);
      const nextBalance = Math.max(0, balance - amt);

      await insertRecord('loan_repayments', {
        loan_id: selectedLoanId,
        date: repDate,
        amount_repayable: loan.monthly_amount, // standard monthly base
        repayment_made: amt,
        balance: nextBalance,
        comments: repComments || 'Manual payment receipt'
      });

      setShowAddRepayment(false);
      setRepAmount('');
      setRepComments('');
    } catch (err) {
      console.error('Failed to record repayment:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">Worker Loan Ledger</h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Admin payroll advances management
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddLoan(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Issue Worker Advance
        </button>
      </div>

      {/* Loans Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data.loans || []).length === 0 ? (
          <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm col-span-3">
            <PiggyBank className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <h4 className="font-serif text-lg text-dark-green font-bold">No active worker loans</h4>
            <p className="text-xs text-text-muted mt-1 font-sans">
              All staff members currently have a zero advance balance.
            </p>
          </div>
        ) : (
          (data.loans || []).map(loan => {
            const workerInfo = (data.workers || []).find(w => w.id === loan.worker_id);
            const { totalPaid, balance, percentPaid } = getLoanStats(loan);
            const isSelected = selectedLoanId === loan.id;

            return (
              <div
                key={loan.id}
                onClick={() => setSelectedLoanId(isSelected ? null : loan.id)}
                className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'border-primary border-2 ring-2 ring-accent/20' : 'border-border-farm'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <h4 className="font-serif text-dark-green font-bold text-base">{workerInfo ? workerInfo.name : 'Unknown Worker'}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-text-muted font-sans font-semibold uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      <span>{workerInfo ? workerInfo.role : 'Staff'}</span>
                    </div>
                  </div>
                  <span className="bg-amber-50 text-amber-accent border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {loan.duration_months} Months
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wide">Borrowed</span>
                    <div className="text-lg font-serif font-black text-text-primary">₦{loan.total_borrowed.toLocaleString()}</div>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wide">Remaining</span>
                    <div className="text-lg font-serif font-black text-red-accent">₦{balance.toLocaleString()}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-sans font-bold">
                    <span className="text-primary">{percentPaid.toFixed(0)}% Repaid</span>
                    <span className="text-text-muted">₦{totalPaid.toLocaleString()} paid</span>
                  </div>
                  <div className="w-full bg-bg-farm rounded-full h-1.5 overflow-hidden border border-border-farm/50">
                    <div 
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-farm/50 flex justify-between items-center text-[10px]">
                  <span className="text-text-muted font-bold">Deduction: ₦{loan.monthly_amount.toLocaleString()} / month</span>
                  <span className="text-primary font-bold hover:underline">
                    {isSelected ? 'Collapse History' : 'View Schedule'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Loan Repayments Schedule */}
      {selectedLoanId && (
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <div className="flex items-center gap-1.5">
              <History className="w-4.5 h-4.5 text-primary" />
              <h3 className="font-serif text-dark-green font-bold text-base">
                Repayment Schedule & History
              </h3>
            </div>
            
            <button
              onClick={() => setShowAddRepayment(true)}
              className="bg-white border border-border-farm hover:bg-bg-farm text-primary font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all"
            >
              Log Manual Payment
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Expected Installment</th>
                  <th className="p-3 text-right bg-green-50/50 text-primary font-black">Repayment Made</th>
                  <th className="p-3 text-right">New Balance</th>
                  <th className="p-3">Reference / Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {getLoanStats((data.loans || []).find(l => l.id === selectedLoanId)).repayments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-text-muted font-sans text-xs">
                      No repayment entries recorded yet. Repayments will show here when Payroll is run or a manual payment is logged.
                    </td>
                  </tr>
                ) : (
                  getLoanStats((data.loans || []).find(l => l.id === selectedLoanId)).repayments
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(rep => (
                      <tr key={rep.id} className="hover:bg-bg-farm/20">
                        <td className="p-3 font-mono font-bold text-text-primary">{rep.date}</td>
                        <td className="p-3 text-right font-mono">₦{rep.amount_repayable.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-black text-primary bg-green-50/20">
                          ₦{rep.repayment_made.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-red-accent">₦{rep.balance.toLocaleString()}</td>
                        <td className="p-3 text-text-muted italic">{rep.comments || '—'}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Issue Loan Modal */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[380px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Issue Salary Advance</span>
              <button 
                onClick={() => setShowAddLoan(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddLoanSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Select Staff Worker
                </label>
                <select
                  required
                  value={loanWorkerId}
                  onChange={(e) => setLoanWorkerId(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                >
                  <option value="">Select staff</option>
                  {(data.workers || []).filter(w => w.role !== 'admin').map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Principal Amount (₦)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={loanTotal}
                  onChange={(e) => setLoanTotal(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="60"
                    value={loanMonths}
                    onChange={(e) => setLoanMonths(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Monthly Deduction</div>
                  <div className="bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-bold text-primary font-mono text-center">
                    ₦{loanTotal && loanMonths ? Math.round(parseFloat(loanTotal) / parseInt(loanMonths)).toLocaleString() : '0'}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddLoan(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Approve advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Record Repayment Modal */}
      {showAddRepayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[360px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Record Loan Repayment</span>
              <button 
                onClick={() => setShowAddRepayment(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddRepaymentSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Repayment Date
                </label>
                <input
                  type="date"
                  required
                  value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Amount Received (₦)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={repAmount}
                  onChange={(e) => setRepAmount(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Comments / Reference
                </label>
                <input
                  type="text"
                  value={repComments}
                  onChange={(e) => setRepComments(e.target.value)}
                  placeholder="e.g. Bank transfer reference or cash receipt"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddRepayment(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
