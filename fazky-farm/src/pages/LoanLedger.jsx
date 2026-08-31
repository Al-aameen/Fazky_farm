import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  PiggyBank, 
  History, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Download, 
  TrendingDown, 
  Percent,
  Clock
} from 'lucide-react';
import { exportToExcel } from '../lib/csvExportImport';

export default function LoanLedger() {
  const { data, insertRecord, updateRecord } = useData();
  const { role } = useAuth();
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  // Modals visibility
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddRepayment, setShowAddRepayment] = useState(false);

  // New Loan Form Inputs
  const [loanWorkerId, setLoanWorkerId] = useState('');
  const [loanDateIssued, setLoanDateIssued] = useState(new Date().toISOString().split('T')[0]);
  const [loanTotal, setLoanTotal] = useState('');
  const [loanMonths, setLoanMonths] = useState(1);
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // New Repayment Form Inputs
  const [repDate, setRepDate] = useState(new Date().toISOString().split('T')[0]);
  const [repAmount, setRepAmount] = useState('');
  const [repComments, setRepComments] = useState('');
  const [submittingRep, setSubmittingRep] = useState(false);

  // Advance requests list
  const pendingRequests = (data.loan_requests || []).filter(r => r.status === 'pending');

  // Shared error banner state
  const [errorMessage, setErrorMessage] = useState(null);

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

  // Issue Direct Loan
  const handleAddLoanSubmit = async (e) => {
    e.preventDefault();
    const total = parseFloat(loanTotal);
    const months = parseInt(loanMonths, 10);
    if (!loanWorkerId || isNaN(total) || isNaN(months) || months <= 0) return;

    setSubmittingLoan(true);
    setErrorMessage(null);
    try {
      const monthlyAmt = Math.round((total / months) * 100) / 100;
      await insertRecord('loans', {
        worker_id: loanWorkerId,
        date_issued: loanDateIssued,
        total_borrowed: total,
        duration_months: months,
        monthly_amount: monthlyAmt
      });

      // Only clear on success
      setShowAddLoan(false);
      setLoanWorkerId('');
      setLoanTotal('');
      setLoanMonths(1);
    } catch (err) {
      console.error('Failed to issue loan:', err);
      setErrorMessage(err?.message || 'Failed to issue loan.');
    } finally {
      setSubmittingLoan(false);
    }
  };

  // Approve Pending Advance Request (Item XII)
  const handleApproveRequest = async (request) => {
    const workerInfo = (data.workers || []).find(w => w.id === request.worker_id);
    if (!window.confirm(`Approve salary advance of ₦${Number(request.requested_amount).toLocaleString()} for ${workerInfo?.name || 'Worker'}?`)) {
      return;
    }
    setErrorMessage(null);
    try {
      const total = Number(request.requested_amount);
      const months = Number(request.duration_months) || 1;
      const monthlyAmt = Math.round((total / months) * 100) / 100;

      // 1. Create loan record
      await insertRecord('loans', {
        worker_id: request.worker_id,
        date_issued: new Date().toISOString().split('T')[0],
        total_borrowed: total,
        duration_months: months,
        monthly_amount: monthlyAmt
      });

      // 2. Mark request as approved
      await updateRecord('loan_requests', {
        id: request.id,
        status: 'approved'
      });
    } catch (err) {
      console.error('Approval error:', err);
      setErrorMessage(err?.message || 'Approval failed.');
    }
  };

  // Reject Pending Advance Request
  const handleRejectRequest = async (request) => {
    if (!window.confirm('Reject this salary advance request?')) return;
    setErrorMessage(null);
    try {
      await updateRecord('loan_requests', {
        id: request.id,
        status: 'rejected'
      });
    } catch (err) {
      console.error('Reject error:', err);
      setErrorMessage(err?.message || 'Failed to reject request.');
    }
  };

  // Record Repayment
  const handleAddRepaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(repAmount);
    if (isNaN(amt) || amt <= 0 || !selectedLoanId) return;

    setSubmittingRep(true);
    setErrorMessage(null);
    try {
      const loan = (data.loans || []).find(l => l.id === selectedLoanId);
      if (!loan) return;

      const { balance } = getLoanStats(loan);
      const nextBalance = Math.max(0, balance - amt);

      await insertRecord('loan_repayments', {
        loan_id: selectedLoanId,
        date: repDate,
        amount_repayable: loan.monthly_amount,
        repayment_made: amt,
        balance: nextBalance,
        comments: repComments || 'Payroll advance repayment'
      });

      // Only clear on success
      setShowAddRepayment(false);
      setRepAmount('');
      setRepComments('');
    } catch (err) {
      console.error('Failed to record repayment:', err);
      setErrorMessage(err?.message || 'Failed to record repayment.');
    } finally {
      setSubmittingRep(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Error Banner */}
      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-xs text-red-800 font-sans shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">Save failed — your data is still on screen</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="shrink-0 text-red-500 hover:text-red-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border-farm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-dark-green">
            <PiggyBank className="w-6 h-6 text-primary" />
            <span>Worker Loan & Salary Advance Ledger</span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Track worker advances with issuance dates, repayment schedules, and staff self-service advance request queues.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportToExcel('fazky_worker_loans', 'Loans', data.loans || [])}
            className="bg-bg-farm hover:bg-border-farm/40 text-dark-green font-bold text-xs px-3.5 py-2.5 rounded-xl border border-border-farm flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Ledger</span>
          </button>

          <button
            onClick={() => setShowAddLoan(true)}
            className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Issue New Advance</span>
          </button>
        </div>
      </div>

      {/* ── Pending Worker Advance Requests Queue (Item XII) ── */}
      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-3xl border border-amber-300 p-5 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-serif font-bold text-sm text-amber-900">
              <Clock className="w-4 h-4 text-amber-700 animate-spin-slow" />
              <span>Pending Worker Advance Requests ({pendingRequests.length})</span>
            </div>
            <span className="text-[11px] text-amber-800 font-bold">Action Required by Admin</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map(req => {
              const workerInfo = (data.workers || []).find(w => w.id === req.worker_id);
              return (
                <div key={req.id} className="p-4 bg-white rounded-2xl border border-amber-200 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-serif font-bold text-dark-green text-sm">{workerInfo?.name || 'Worker'}</div>
                      <div className="text-[10px] text-text-muted">Requested on {req.date_requested || req.created_at?.slice(0, 10)}</div>
                    </div>
                    <span className="text-sm font-bold font-mono text-dark-green bg-amber-100 px-2 py-0.5 rounded-lg">
                      ₦{Number(req.requested_amount).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-text-primary italic bg-bg-farm p-2 rounded-xl">
                    "{req.purpose}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>Duration: <strong>{req.duration_months || 1} month(s)</strong></span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleRejectRequest(req)}
                      className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req)}
                      className="flex-1 py-1.5 bg-dark-green hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                    >
                      Approve Advance
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Loans Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(data.loans || []).length === 0 ? (
          <div className="bg-white border border-border-farm rounded-3xl p-12 text-center shadow-sm col-span-3">
            <PiggyBank className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
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
                className={`bg-white border rounded-3xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'border-primary border-2 ring-4 ring-emerald-50' : 'border-border-farm'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <h4 className="font-serif text-dark-green font-bold text-base">{workerInfo ? workerInfo.name : 'Unknown Worker'}</h4>
                    <span className="text-[10px] text-text-muted font-bold block">
                      Issued: {loan.date_issued || loan.created_at?.slice(0, 10) || '—'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    balance === 0 ? 'bg-emerald-100 text-dark-green' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {balance === 0 ? 'Fully Paid' : 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border-farm/60 text-xs">
                  <div>
                    <span className="text-[10px] text-text-muted font-bold block">Total Advance</span>
                    <span className="font-bold font-mono text-dark-green text-sm">
                      ₦{Number(loan.total_borrowed).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-muted font-bold block">Remaining Balance</span>
                    <span className="font-bold font-mono text-red-600 text-sm">
                      ₦{balance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-text-muted font-bold mb-1">
                    <span>Repaid: ₦{totalPaid.toLocaleString()}</span>
                    <span>{percentPaid.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-bg-farm rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-farm/60 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Monthly Deduction: <strong>₦{Number(loan.monthly_amount || 0).toLocaleString()}</strong></span>
                  <span className="text-primary font-bold">{isSelected ? 'Hide Details ▲' : 'View History ▼'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Selected Loan Repayment Details & Form ── */}
      {selectedLoanId && (
        <div className="bg-white rounded-3xl border border-border-farm p-6 shadow-sm space-y-4 animate-fade-in">
          {(() => {
            const loan = (data.loans || []).find(l => l.id === selectedLoanId);
            if (!loan) return null;
            const workerInfo = (data.workers || []).find(w => w.id === loan.worker_id);
            const { totalPaid, balance, repayments } = getLoanStats(loan);

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-4">
                  <div>
                    <h3 className="font-serif font-bold text-dark-green text-lg">
                      Repayment History — {workerInfo?.name}
                    </h3>
                    <p className="text-xs text-text-muted">
                      Original advance ₦{Number(loan.total_borrowed).toLocaleString()} issued on {loan.date_issued || loan.created_at?.slice(0, 10)}.
                    </p>
                  </div>

                  {balance > 0 && (
                    <button
                      onClick={() => setShowAddRepayment(true)}
                      className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
                    >
                      + Record Repayment
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border-farm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Repayment Made</th>
                        <th className="p-3 text-right">Balance Remaining</th>
                        <th className="p-3">Comments / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-farm/50">
                      {repayments.length > 0 ? (
                        repayments.map(r => (
                          <tr key={r.id} className="hover:bg-bg-farm/40">
                            <td className="p-3 font-mono font-bold">{r.date}</td>
                            <td className="p-3 text-right font-mono font-bold text-dark-green">
                              ₦{Number(r.repayment_made).toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-red-600">
                              ₦{Number(r.balance).toLocaleString()}
                            </td>
                            <td className="p-3 text-text-muted">{r.comments || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-text-muted">
                            No repayments logged for this loan yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Modal: Issue New Advance (Item XII) ── */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <PiggyBank className="w-5 h-5 text-accent" />
                <span>Issue Worker Advance / Loan</span>
              </div>
              <button onClick={() => setShowAddLoan(false)} className="text-white/70 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleAddLoanSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Worker *
                </label>
                <select
                  required
                  value={loanWorkerId}
                  onChange={(e) => setLoanWorkerId(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold text-dark-green focus:outline-none"
                >
                  <option value="">— Select Worker —</option>
                  {(data.workers || []).map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.role || 'Staff'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Date Issued *
                  </label>
                  <input
                    type="date"
                    required
                    value={loanDateIssued}
                    onChange={(e) => setLoanDateIssued(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={loanMonths}
                    onChange={(e) => setLoanMonths(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Total Loan Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  step="500"
                  placeholder="e.g. 50000"
                  value={loanTotal}
                  onChange={(e) => setLoanTotal(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono focus:outline-none"
                />
              </div>

              {loanTotal && loanMonths && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-dark-green font-bold">
                  <span>Monthly Payroll Deduction:</span>
                  <span className="font-mono text-sm">
                    ₦{Math.round(Number(loanTotal) / Number(loanMonths)).toLocaleString()}/mo
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLoan(false)}
                  className="flex-1 bg-bg-farm text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLoan}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {submittingLoan ? 'Issuing...' : 'Issue Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Record Repayment ── */}
      {showAddRepayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span>Record Loan Repayment</span>
              </div>
              <button onClick={() => setShowAddRepayment(false)} className="text-white/70 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleAddRepaymentSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Repayment Date *
                </label>
                <input
                  type="date"
                  required
                  value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Amount Paid (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  step="100"
                  placeholder="e.g. 10000"
                  value={repAmount}
                  onChange={(e) => setRepAmount(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Comments / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deducted from August salary"
                  value={repComments}
                  onChange={(e) => setRepComments(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRepayment(false)}
                  className="flex-1 bg-bg-farm text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRep}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {submittingRep ? 'Saving...' : 'Save Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
