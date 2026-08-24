import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { 
  UserCheck, 
  Grid, 
  Egg, 
  Package, 
  Activity, 
  Syringe, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  PiggyBank, 
  ArrowRight,
  TrendingUp,
  Layers,
  HeartPulse
} from 'lucide-react';

export default function WorkerDashboard({ setActivePage }) {
  const { user, worker, role } = useAuth();
  const { data, insertRecord, isOnline, ensureDateLoaded } = useData();

  const todayStr = new Date().toISOString().split('T')[0];

  // Advance Request Modal States
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePurpose, setAdvancePurpose] = useState('');
  const [advanceDuration, setAdvanceDuration] = useState(1);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [advanceSuccess, setAdvanceSuccess] = useState('');
  const [advanceError, setAdvanceError] = useState('');

  // Ensure current month production and census are loaded
  useEffect(() => {
    if (ensureDateLoaded) {
      ensureDateLoaded('production_log', todayStr);
      ensureDateLoaded('census_counts', todayStr);
    }
  }, [todayStr, ensureDateLoaded]);

  // 1. My Assigned Pens
  const myPens = (data.pens || []).filter(pen => pen.worker_id === worker?.id);

  // 2. Latest Census count for my pens
  const censusCounts = data.census_counts || [];
  const latestCensusDate = censusCounts.length > 0
    ? [...censusCounts].map(c => c.date).sort((a, b) => new Date(b) - new Date(a))[0]
    : todayStr;

  const myBirdCount = myPens.reduce((total, pen) => {
    const penCounts = censusCounts.filter(c => c.pen_id === pen.id && c.date === latestCensusDate);
    const count = penCounts.reduce((sum, c) => sum + (Number(c.bird_count) || 0), 0);
    return total + (count || 0);
  }, 0);

  // 3. Today's Production Log for my pens
  const todayLogs = (data.production_log || []).filter(
    log => log.date === todayStr && myPens.some(p => p.id === log.pen_id)
  );

  const todayEggs = todayLogs.reduce((sum, l) => sum + (Number(l.total_eggs) || 0), 0);
  const todayFeedBags = todayLogs.reduce((sum, l) => sum + (Number(l.morning_feed || 0) + Number(l.evening_feed || 0)), 0);
  const todayMortality = todayLogs.reduce((sum, l) => sum + (Number(l.mortality) || 0), 0);

  const isTodayLogged = myPens.length > 0 && myPens.every(pen => todayLogs.some(l => l.pen_id === pen.id));

  // 4. Upcoming Vaccinations for my birds or all pens
  const myPenNames = myPens.map(p => p.name.toLowerCase());
  const upcomingVaccines = (data.vaccination_schedules || []).filter(v => {
    if (v.status === 'Completed') return false;
    const target = (v.target || '').toLowerCase();
    if (target.includes('all') || target.includes('general')) return true;
    return myPenNames.some(pName => target.includes(pName));
  }).slice(0, 4);

  // 5. Read-only feed inventory stock
  const feedStock = data.feed_inventory || [];

  // 6. My Loan & Advance Requests
  const myRequests = (data.loan_requests || []).filter(r => r.worker_id === worker?.id);

  // Handle Advance Request Submission
  const handleSubmitAdvance = async (e) => {
    e.preventDefault();
    const amount = parseFloat(advanceAmount);
    if (!amount || amount <= 0 || !advancePurpose.trim()) {
      setAdvanceError('Please provide a valid requested amount and purpose.');
      return;
    }

    setSubmittingAdvance(true);
    setAdvanceError('');
    setAdvanceSuccess('');

    try {
      await insertRecord('loan_requests', {
        worker_id: worker.id,
        requested_amount: amount,
        purpose: advancePurpose.trim(),
        duration_months: Number(advanceDuration) || 1,
        status: 'pending',
        date_requested: todayStr
      });

      setAdvanceSuccess('Advance request submitted to Admin successfully!');
      setAdvanceAmount('');
      setAdvancePurpose('');
      setAdvanceDuration(1);
      setTimeout(() => {
        setShowAdvanceModal(false);
        setAdvanceSuccess('');
      }, 2500);
    } catch (err) {
      console.error('Error submitting advance request:', err);
      setAdvanceError(err.message || 'Failed to submit request.');
    } finally {
      setSubmittingAdvance(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Top Worker Banner ── */}
      <div className="bg-gradient-to-br from-dark-green via-dark-green to-emerald-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 text-white/5 pointer-events-none">
          <Egg className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-accent">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Worker Station • {worker?.name || user?.email?.split('@')[0]}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
              Daily Flock & Pen Command
            </h2>
            <p className="text-xs text-light-green/90">
              Overview of your assigned birds, daily log status, feed levels, and health schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActivePage && setActivePage('production')}
              className="bg-accent hover:bg-yellow-400 text-dark-green font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <Egg className="w-4 h-4" />
              <span>Log Today's Eggs & Feed</span>
            </button>

            <button
              onClick={() => setShowAdvanceModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-3.5 py-2.5 rounded-xl backdrop-blur-md transition-colors flex items-center gap-1.5"
            >
              <PiggyBank className="w-4 h-4 text-accent" />
              <span>Request Advance</span>
            </button>
          </div>
        </div>

        {/* Assigned Pens Chips */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-light-green/80 uppercase tracking-wider">
            Assigned Pens:
          </span>
          {myPens.length > 0 ? (
            myPens.map(p => (
              <span 
                key={p.id} 
                className="px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg text-xs font-bold text-white border border-white/10"
              >
                {p.name} {p.generation ? `(${p.generation})` : ''}
              </span>
            ))
          ) : (
            <span className="text-xs text-light-green italic">No pens directly assigned yet.</span>
          )}
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Birds */}
        <div className="bg-white p-4 rounded-2xl border border-border-farm shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">My Live Birds</span>
            <div className="p-2 bg-emerald-50 text-dark-green rounded-xl">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-dark-green">
            {myBirdCount.toLocaleString()}
          </div>
          <span className="text-[10px] text-text-muted mt-1">Under your care</span>
        </div>

        {/* Today's Eggs */}
        <div className="bg-white p-4 rounded-2xl border border-border-farm shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Eggs</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Egg className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-dark-green">
            {todayEggs} <span className="text-xs text-text-muted font-sans">({(todayEggs / 30).toFixed(1)} crt)</span>
          </div>
          <span className="text-[10px] text-text-muted mt-1">Morning + Evening</span>
        </div>

        {/* Today's Feed */}
        <div className="bg-white p-4 rounded-2xl border border-border-farm shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Feed Consumed</span>
            <div className="p-2 bg-emerald-50 text-dark-green rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-dark-green">
            {todayFeedBags} <span className="text-xs text-text-muted font-sans">bags</span>
          </div>
          <span className="text-[10px] text-text-muted mt-1">{(todayFeedBags * 25).toFixed(0)} kg total</span>
        </div>

        {/* Daily Logging Status */}
        <div className="bg-white p-4 rounded-2xl border border-border-farm shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Log</span>
            <div className={`p-2 rounded-xl ${isTodayLogged ? 'bg-emerald-50 text-dark-green' : 'bg-amber-50 text-amber-700'}`}>
              {isTodayLogged ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-base font-bold">
            {isTodayLogged ? (
              <span className="text-dark-green flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Logged
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Pending
              </span>
            )}
          </div>
          <button
            onClick={() => setActivePage && setActivePage('production')}
            className="text-[10px] font-bold text-primary hover:underline text-left mt-1"
          >
            {isTodayLogged ? 'View / Edit Record' : 'Record for Today →'}
          </button>
        </div>
      </div>

      {/* ── Main Content Two-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upcoming Health & Vaccinations */}
        <div className="bg-white rounded-2xl border border-border-farm p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-base text-dark-green">
              <Syringe className="w-5 h-5 text-primary" />
              <span>Upcoming Health & Vaccines</span>
            </div>
            <button
              onClick={() => setActivePage && setActivePage('flockhealth')}
              className="text-xs font-bold text-primary hover:underline"
            >
              Full Schedule →
            </button>
          </div>

          {upcomingVaccines.length > 0 ? (
            <div className="space-y-2.5">
              {upcomingVaccines.map((v) => (
                <div 
                  key={v.id} 
                  className="p-3.5 bg-bg-farm rounded-xl border border-border-farm flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-dark-green">{v.name}</div>
                    <div className="text-[11px] text-text-muted flex items-center gap-2">
                      <span>Target: <strong className="text-text-primary">{v.target || 'All Pens'}</strong></span>
                      <span>•</span>
                      <span>Date: <strong className="text-dark-green">{v.date}</strong></span>
                    </div>
                    {v.notes && (
                      <p className="text-[10px] text-text-muted italic">{v.notes}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                    {v.status || 'Upcoming'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-text-muted text-xs">
              <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2 opacity-50" />
              No pending vaccinations for your flock at this moment.
            </div>
          )}
        </div>

        {/* Right Column: Read-Only Farm Feed Inventory (Item XIX) */}
        <div className="bg-white rounded-2xl border border-border-farm p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-base text-dark-green">
              <Package className="w-5 h-5 text-primary" />
              <span>Farm Feed Stock Level</span>
            </div>
            <span className="text-[11px] text-text-muted italic">Read-Only Balance</span>
          </div>

          <p className="text-xs text-text-muted">
            Current finished bird feed and formulation stock remaining in the farm feed store:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {feedStock.length > 0 ? (
              feedStock.map((item) => {
                const stock = Number(item.current_stock) || 0;
                const isLow = stock <= (Number(item.low_stock_threshold) || 10);
                return (
                  <div 
                    key={item.id}
                    className="p-3 bg-bg-farm rounded-xl border border-border-farm flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-dark-green">{item.item_name}</div>
                      <div className="text-[10px] text-text-muted">{item.unit || 'bags'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold font-mono text-dark-green">
                        {stock.toLocaleString()}
                      </div>
                      {isLow && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                          Low Stock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 p-6 text-center text-xs text-text-muted">
                Feed inventory records loading or empty.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── My Salary Advance Requests ── */}
      <div className="bg-white rounded-2xl border border-border-farm p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-farm pb-3">
          <div className="flex items-center gap-2 font-serif font-bold text-base text-dark-green">
            <PiggyBank className="w-5 h-5 text-primary" />
            <span>My Advance & Loan Requests</span>
          </div>
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>
        </div>

        {myRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5">Purpose</th>
                  <th className="p-2.5">Duration</th>
                  <th className="p-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/50">
                {myRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-bg-farm/50">
                    <td className="p-2.5 font-mono">{req.date_requested || req.created_at?.slice(0, 10)}</td>
                    <td className="p-2.5 font-bold font-mono text-dark-green">₦{Number(req.requested_amount).toLocaleString()}</td>
                    <td className="p-2.5 text-text-muted">{req.purpose}</td>
                    <td className="p-2.5">{req.duration_months || 1} month(s)</td>
                    <td className="p-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'approved' 
                          ? 'bg-emerald-100 text-dark-green' 
                          : req.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-text-muted">
            You have not submitted any salary advance requests yet.
          </div>
        )}
      </div>

      {/* ── Modal: Request Advance / Loan (Item XII) ── */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 sm:p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <PiggyBank className="w-5 h-5 text-accent" />
                <span>Request Salary Advance</span>
              </div>
              <button 
                onClick={() => setShowAdvanceModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdvance} className="p-5 sm:p-6 space-y-4 text-xs">
              {advanceError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{advanceError}</span>
                </div>
              )}

              {advanceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-dark-green rounded-xl flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{advanceSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Requested Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  step="500"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Purpose / Reason for Advance *
                </label>
                <textarea
                  required
                  rows={3}
                  value={advancePurpose}
                  onChange={(e) => setAdvancePurpose(e.target.value)}
                  placeholder="Explain brief reason for advance (e.g. family medical, transport, emergency)..."
                  className="w-full bg-bg-farm border border-border-farm rounded-xl p-3 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Repayment Duration (Months)
                </label>
                <select
                  value={advanceDuration}
                  onChange={(e) => setAdvanceDuration(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  <option value={1}>1 Month (Deduct next payroll)</option>
                  <option value={2}>2 Months (Split evenly over 2 months)</option>
                  <option value={3}>3 Months (Split evenly over 3 months)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvance || !isOnline}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {submittingAdvance ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
