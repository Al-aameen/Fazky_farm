import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { 
  Activity, 
  Syringe, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Download, 
  Plus, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';

export default function FlockHealth() {
  const { data, insertRecord, bulkInsertRecords } = useData();
  const { role, worker } = useAuth();
  const importRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState('2026-08-05');
  const [showVacModal, setShowVacModal] = useState(false);

  // New Vaccination Form State
  const [vacName, setVacName] = useState('');
  const [vacDate, setVacDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetPen, setTargetPen] = useState('All Pens');
  const [vacNotes, setVacNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Calculate Active Bird Count
  const calculateTotalBirds = () => {
    const counts = data.census_counts || [];
    const dateCounts = counts.filter(c => c.date === selectedDate);
    if (dateCounts.length === 0) return 360; // default total seed count
    return dateCounts.reduce((sum, c) => sum + (parseInt(c.bird_count) || 0), 0);
  };

  const totalBirds = calculateTotalBirds();

  // 2. Calculate Today's Egg Production
  const calculateTodayEggs = () => {
    const logs = data.production_log || [];
    const dateLogs = logs.filter(l => l.date === selectedDate);
    return dateLogs.reduce((sum, l) => sum + (parseInt(l.total_eggs) || 0), 0);
  };

  const todayEggs = calculateTodayEggs();

  // 3. Calculate Laying Percentage Rate
  const layingPercentage = totalBirds > 0 ? ((todayEggs / totalBirds) * 100).toFixed(1) : '0.0';

  // 4. Calculate Today's Mortality
  const calculateTodayMortality = () => {
    const logs = data.production_log || [];
    const dateLogs = logs.filter(l => l.date === selectedDate);
    return dateLogs.reduce((sum, l) => sum + (parseInt(l.mortality) || 0), 0);
  };

  const todayMortality = calculateTodayMortality();
  const mortalityPct = totalBirds > 0 ? ((todayMortality / totalBirds) * 100).toFixed(2) : '0.00';

  // Handle Add Vaccination Schedule
  const handleAddVaccination = async (e) => {
    e.preventDefault();
    if (!vacName) return;

    setSubmitting(true);
    try {
      await insertRecord('expenses_log', {
        date: vacDate,
        day_of_week: new Date(vacDate).toLocaleDateString('en-US', { weekday: 'long' }),
        description: `Vaccination/Medication: ${vacName} (${targetPen})`,
        amount: 0,
        remarks: vacNotes || 'Scheduled health treatment',
        created_by: worker?.id || 'admin'
      });

      setShowVacModal(false);
      setVacName('');
      setVacNotes('');
    } catch (err) {
      console.error('Error logging vaccination schedule:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-dark-green rounded-xl shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">Flock Health & Laying Analytics</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              Monitor flock mortality rates, laying percentage efficiency index, and vaccination schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DatePicker
            label="Target Date"
            value={selectedDate}
            onChange={setSelectedDate}
          />
          {/* Hidden import file input */}
          <input
            type="file"
            ref={importRef}
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = await parseImportFile(file);
                const result = await bulkInsertRecords('production_log', rows);
                alert(`✅ Imported ${result?.count ?? rows.length} health/production records.`);
              } catch (err) {
                alert('❌ Import failed: ' + err.message);
              } finally {
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
          >
            <span className="text-blue-600 font-bold text-base leading-none">↑</span>
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => exportToExcel(`fazky_flock_health_${selectedDate}`, 'Flock Health', data.production_log || [])}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Export Analytics</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Laying Efficiency</span>
            <div className="text-3xl font-serif font-black text-dark-green mt-1">{layingPercentage}%</div>
            <p className="text-[10px] text-text-muted mt-0.5 font-semibold">({todayEggs} eggs / {totalBirds} birds)</p>
          </div>
          <div className="p-3 bg-emerald-50 text-primary rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Active Flock Count</span>
            <div className="text-3xl font-serif font-black text-dark-green mt-1">{totalBirds}</div>
            <p className="text-[10px] text-text-muted mt-0.5 font-semibold">Total birds across all pens</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Daily Mortality</span>
            <div className="text-3xl font-serif font-black text-red-accent mt-1">{todayMortality}</div>
            <p className="text-[10px] text-text-muted mt-0.5 font-semibold">Mortality Rate: {mortalityPct}%</p>
          </div>
          <div className="p-3 bg-red-50 text-red-accent rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Flock Status</span>
            <div className="text-lg font-serif font-bold text-dark-green mt-1 flex items-center gap-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Healthy</span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5 font-semibold">Vaccine schedule up to date</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Syringe className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Section: Pen Block Performance Table & Vaccination Scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pen Block Laying Efficiency Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border-farm p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <h3 className="font-serif font-bold text-dark-green text-base">Pen Block Laying Performance</h3>
            <span className="text-xs font-semibold text-text-muted">Target: {selectedDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-bg-farm text-text-muted uppercase text-[10px] font-bold border-y border-border-farm">
                <tr>
                  <th className="p-3">Pen Name</th>
                  <th className="p-3 text-center">Active Birds</th>
                  <th className="p-3 text-center">Eggs Collected</th>
                  <th className="p-3 text-center">Feed (kg)</th>
                  <th className="p-3 text-center">Mortality</th>
                  <th className="p-3 text-right">Laying %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm">
                {(data.pens || []).map((pen) => {
                  const prodLog = (data.production_log || []).find(l => l.pen_id === pen.id && l.date === selectedDate) || {};
                  const censusCount = (data.census_counts || [])
                    .filter(c => c.pen_id === pen.id && c.date === selectedDate)
                    .reduce((s, c) => s + (parseInt(c.bird_count) || 0), 0) || 40;

                  const eggs = prodLog.total_eggs || 0;
                  const feed = prodLog.total_feed || 0;
                  const mortality = prodLog.mortality || 0;
                  const rate = censusCount > 0 ? ((eggs / censusCount) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={pen.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-3 font-serif font-bold text-dark-green">{pen.name}</td>
                      <td className="p-3 text-center font-bold">{censusCount}</td>
                      <td className="p-3 text-center font-bold text-primary">{eggs}</td>
                      <td className="p-3 text-center font-medium">{feed}</td>
                      <td className="p-3 text-center font-bold text-red-accent">{mortality}</td>
                      <td className="p-3 text-right font-bold text-dark-green font-serif">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vaccination & Medication Schedule Panel */}
        <div className="bg-white rounded-2xl border border-border-farm p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2 font-serif font-bold text-dark-green text-base">
                <Syringe className="w-5 h-5 text-amber-500" />
                <span>Vaccination Schedule</span>
              </div>
              <button
                onClick={() => setShowVacModal(true)}
                className="p-1.5 bg-emerald-100 text-dark-green rounded-lg hover:bg-emerald-200 transition-colors"
                title="Add Vaccine"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {[
                { name: 'Newcastle Disease (Lasota)', date: '2026-08-15', status: 'Upcoming', target: 'Batch 1 & 2' },
                { name: 'Gumboro IBD Booster', date: '2026-08-22', status: 'Upcoming', target: 'Batch 3' },
                { name: 'Fowl Pox Vaccine', date: '2026-08-01', status: 'Completed', target: 'All Pens' }
              ].map((v, idx) => (
                <div key={idx} className="p-3 bg-bg-farm rounded-xl border border-border-farm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-dark-green">{v.name}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      v.status === 'Completed' ? 'bg-emerald-100 text-dark-green' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Due: {v.date}</span>
                    <span className="font-bold">{v.target}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowVacModal(true)}
            className="w-full py-2.5 bg-dark-green hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Vaccine / Medication</span>
          </button>
        </div>
      </div>

      {/* Vaccination Modal Form */}
      {showVacModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-border-farm shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <h3 className="font-serif font-bold text-dark-green text-lg">Schedule Vaccination</h3>
              <button 
                onClick={() => setShowVacModal(false)}
                className="text-text-muted hover:text-dark-green font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVaccination} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Vaccine / Medicine Name
                </label>
                <input
                  type="text"
                  value={vacName}
                  onChange={(e) => setVacName(e.target.value)}
                  placeholder="e.g. Newcastle Lasota Booster"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <DatePicker
                  label="Scheduled Date"
                  value={vacDate}
                  onChange={setVacDate}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Target Flock / Pen Block
                </label>
                <input
                  type="text"
                  value={targetPen}
                  onChange={(e) => setTargetPen(e.target.value)}
                  placeholder="e.g. Pen Block A (Batch 1)"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Dosage / Notes
                </label>
                <input
                  type="text"
                  value={vacNotes}
                  onChange={(e) => setVacNotes(e.target.value)}
                  placeholder="e.g. Administer via drinking water"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVacModal(false)}
                  className="flex-1 py-2 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-dark-green text-white font-bold text-xs rounded-xl hover:bg-emerald-900 shadow-sm"
                >
                  {submitting ? 'Scheduling...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
