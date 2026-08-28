import React, { useState, useEffect, useRef } from 'react';
import { useData, resolvePenDisplayName } from '../hooks/useData';
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
  ShieldCheck,
  Edit3,
  Trash2,
  Check,
  RotateCcw
} from 'lucide-react';

const DEFAULT_SCHEDULES = [
  { id: 'def-1', name: 'Newcastle Disease (Lasota)', date: '2026-08-15', status: 'Upcoming', target: 'Batch 1 & 2', notes: 'Administer via drinking water in early morning.' },
  { id: 'def-2', name: 'Gumboro IBD Booster', date: '2026-08-22', status: 'Upcoming', target: 'Batch 3', notes: 'Second booster dose.' },
  { id: 'def-3', name: 'Fowl Pox Vaccine', date: '2026-08-01', status: 'Completed', target: 'All Pens', notes: 'Wing-web puncture method.' }
];

export default function FlockHealth() {
  const { data, insertRecord, updateRecord, deleteRecord, bulkInsertRecords, ensureDateLoaded } = useData();
  const { role, worker } = useAuth();
  const importRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Auto-fetch historical month data on date selection if not cached
  useEffect(() => {
    if (selectedDate && ensureDateLoaded) {
      ensureDateLoaded('production_log', selectedDate);
      ensureDateLoaded('census_counts', selectedDate);
    }
  }, [selectedDate, ensureDateLoaded]);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVac, setEditingVac] = useState(null);

  // Form Fields
  const [vacName, setVacName] = useState('');
  const [vacDate, setVacDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetPen, setTargetPen] = useState('All Pens');
  const [vacStatus, setVacStatus] = useState('Upcoming');
  const [vacNotes, setVacNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Calculate Active Bird Count (from latest census on or before selectedDate)
  const calculateTotalBirds = () => {
    const counts = data.census_counts || [];
    if (counts.length === 0) return 0;
    const validDates = [...new Set(counts.map(c => c.date))]
      .filter(d => d <= selectedDate)
      .sort((a, b) => new Date(b) - new Date(a));
    const targetDate = validDates[0] || selectedDate;
    return counts
      .filter(c => c.date === targetDate)
      .reduce((sum, c) => sum + (parseInt(c.bird_count, 10) || 0), 0);
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

  // Vaccination Schedules list
  const schedules = (data.vaccination_schedules && data.vaccination_schedules.length > 0)
    ? data.vaccination_schedules
    : DEFAULT_SCHEDULES;

  // Handle Add Vaccination Schedule
  const handleSaveVaccination = async (e) => {
    e.preventDefault();
    if (!vacName) return;

    setSubmitting(true);
    try {
      if (editingVac) {
        // Update existing schedule
        await updateRecord('vaccination_schedules', {
          id: editingVac.id,
          name: vacName,
          date: vacDate,
          target: targetPen,
          status: vacStatus,
          notes: vacNotes
        });
      } else {
        // Insert new schedule
        await insertRecord('vaccination_schedules', {
          name: vacName,
          date: vacDate,
          target: targetPen,
          status: vacStatus,
          notes: vacNotes
        });
      }

      setShowAddModal(false);
      setEditingVac(null);
      setVacName('');
      setVacNotes('');
      setVacStatus('Upcoming');
    } catch (err) {
      console.error('Error saving vaccination schedule:', err);
      alert('Error saving schedule: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Status (Completed <-> Upcoming)
  const handleToggleStatus = async (item) => {
    try {
      const newStatus = item.status === 'Completed' ? 'Upcoming' : 'Completed';
      await updateRecord('vaccination_schedules', {
        id: item.id,
        status: newStatus
      });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Handle Delete Schedule
  const handleDeleteSchedule = async (id) => {
    if (window.confirm('Are you sure you want to remove this vaccination schedule?')) {
      try {
        await deleteRecord('vaccination_schedules', id);
      } catch (err) {
        console.error('Failed to delete schedule:', err);
      }
    }
  };

  const canEdit = role === 'admin' || role === 'manager';

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
              Monitor flock mortality rates, laying percentage efficiency index, and editable vaccination schedules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DatePicker
            label="Target Date"
            value={selectedDate}
            onChange={setSelectedDate}
          />
          
          <button
            onClick={() => {
              const tableData = (data.pens || []).map(pen => {
                const prodLog = (data.production_log || []).find(l => l.pen_id === pen.id && l.date === selectedDate) || {};
                const count = (data.census_counts || [])
                  .filter(c => c.pen_id === pen.id && c.date === selectedDate)
                  .reduce((s, c) => s + (parseInt(c.bird_count) || 0), 0) || 40;
                return {
                  pen_name: pen.name,
                  date: selectedDate,
                  active_birds: count,
                  eggs_collected: prodLog.total_eggs || 0,
                  feed_kg: prodLog.total_feed || 0,
                  mortality: prodLog.mortality || 0,
                  laying_percentage: count > 0 ? (((prodLog.total_eggs || 0) / count) * 100).toFixed(1) + '%' : '0.0%'
                };
              });
              exportToExcel(`Flock_Health_${selectedDate}`, 'Flock Health', tableData);
            }}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green border border-border-farm font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Report</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-dark-green rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Active Flock Count</span>
            <span className="text-xl font-serif font-bold text-dark-green">{totalBirds.toLocaleString()} Birds</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Laying Efficiency</span>
            <span className="text-xl font-serif font-bold text-primary">{layingPercentage}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-accent rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Today's Mortality</span>
            <span className="text-xl font-serif font-bold text-red-accent">{todayMortality} Birds ({mortalityPct}%)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Daily Egg Output</span>
            <span className="text-xl font-serif font-bold text-dark-green">{todayEggs.toLocaleString()} Eggs</span>
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
                {(() => {
                  const rawPens = data.pens || [];
                  const nameHistory = data.pen_name_history || [];
                  const prodLogs = data.production_log || [];
                  const censusCounts = data.census_counts || [];

                  let pens = rawPens;
                  if (selectedDate >= '2026-08-13') {
                    pens = pens.filter(p => p.is_active !== false && !p.name?.toLowerCase().includes('retired'));
                  }

                  const validCensusDates = [...new Set(censusCounts.map(c => c.date))]
                    .filter(d => d <= selectedDate)
                    .sort((a, b) => new Date(b) - new Date(a));
                  const targetCensusDate = validCensusDates[0] || selectedDate;

                  return pens.map((pen) => {
                    const penDisplayName = resolvePenDisplayName(pen.id, selectedDate, nameHistory, pen.name);
                    const penLogs = prodLogs.filter(l => l.pen_id === pen.id && l.date === selectedDate);
                    
                    const censusCount = censusCounts
                      .filter(c => c.pen_id === pen.id && c.date === targetCensusDate)
                      .reduce((s, c) => s + (parseInt(c.bird_count, 10) || 0), 0);

                    const eggs = penLogs.reduce((s, l) => s + (Number(l.total_eggs) || (Number(l.morning_eggs) || 0) + (Number(l.evening_eggs) || 0)), 0);
                    const feed = penLogs.reduce((s, l) => s + (Number(l.total_feed) || (Number(l.morning_feed) || 0) + (Number(l.evening_feed) || 0)), 0);
                    const mortality = penLogs.reduce((s, l) => s + (Number(l.mortality) || 0), 0);
                    const rate = censusCount > 0 ? ((eggs / censusCount) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={pen.id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-3 font-serif font-bold text-dark-green">{penDisplayName}</td>
                        <td className="p-3 text-center font-bold">{censusCount}</td>
                        <td className="p-3 text-center font-bold text-primary">{eggs}</td>
                        <td className="p-3 text-center font-medium">{feed}</td>
                        <td className="p-3 text-center font-bold text-red-accent">{mortality}</td>
                        <td className="p-3 text-right font-bold text-dark-green font-serif">{rate}%</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vaccination & Medication Schedule Panel (Fully Editable) */}
        <div className="bg-white rounded-2xl border border-border-farm p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div className="flex items-center gap-2 font-serif font-bold text-dark-green text-base">
                <Syringe className="w-5 h-5 text-amber-500" />
                <span>Vaccination Schedule</span>
              </div>
              {canEdit && (
                <button
                  onClick={() => {
                    setEditingVac(null);
                    setVacName('');
                    setVacDate(new Date().toISOString().split('T')[0]);
                    setTargetPen('All Pens');
                    setVacStatus('Upcoming');
                    setVacNotes('');
                    setShowAddModal(true);
                  }}
                  className="p-1.5 bg-emerald-100 text-dark-green rounded-lg hover:bg-emerald-200 transition-colors"
                  title="Add Vaccine Schedule"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-3 mt-4">
              {schedules.map((v) => (
                <div key={v.id} className="p-3 bg-bg-farm rounded-xl border border-border-farm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-dark-green">{v.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(v)}
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
                          v.status === 'Completed' 
                            ? 'bg-emerald-100 text-dark-green hover:bg-emerald-200' 
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {v.status === 'Completed' ? <Check className="w-2.5 h-2.5" /> : null}
                        <span>{v.status}</span>
                      </button>

                      {canEdit && (
                        <>
                          <button
                            onClick={() => {
                              setEditingVac(v);
                              setVacName(v.name);
                              setVacDate(v.date);
                              setTargetPen(v.target || 'All Pens');
                              setVacStatus(v.status || 'Upcoming');
                              setVacNotes(v.notes || '');
                              setShowAddModal(true);
                            }}
                            className="p-1 text-text-muted hover:text-dark-green hover:bg-white rounded transition-colors"
                            title="Edit Schedule"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(v.id)}
                            className="p-1 text-text-muted hover:text-red-accent hover:bg-white rounded transition-colors"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-text-muted">
                    <span>Due: <strong>{v.date}</strong></span>
                    <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-border-farm">{v.target}</span>
                  </div>

                  {v.notes && (
                    <p className="text-[10px] text-text-muted italic border-t border-border-farm/50 pt-1">
                      {v.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => {
                setEditingVac(null);
                setVacName('');
                setVacDate(new Date().toISOString().split('T')[0]);
                setTargetPen('All Pens');
                setVacStatus('Upcoming');
                setVacNotes('');
                setShowAddModal(true);
              }}
              className="w-full py-2.5 bg-dark-green hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Vaccine / Medication</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── ADD / EDIT VACCINATION MODAL ─── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[420px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>{editingVac ? 'Edit Vaccine Schedule' : 'Schedule New Vaccine / Medication'}</span>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVac(null);
                }}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVaccination} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Vaccine / Medication Name *
                </label>
                <input
                  type="text"
                  required
                  value={vacName}
                  onChange={(e) => setVacName(e.target.value)}
                  placeholder="e.g. Newcastle Disease (Lasota) or Vitamin Amino"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={vacDate}
                    onChange={(e) => setVacDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Status *
                  </label>
                  <select
                    value={vacStatus}
                    onChange={(e) => setVacStatus(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold text-text-primary focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Target Pen / Batch Dropdown (Item IV) */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Target Pen / Batch *
                </label>
                <select
                  value={targetPen}
                  onChange={(e) => setTargetPen(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2.5 text-xs font-bold text-dark-green focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  <optgroup label="General Targets">
                    <option value="All Pens & Batches">All Pens & Batches</option>
                    <option value="All Laying Pens">All Laying Pens</option>
                    <option value="All Brooder / Chick Pens">All Brooder / Chick Pens</option>
                  </optgroup>

                  {/* Active Batches (Day-Old Chicks & Growers) */}
                  {(data.batches || []).length > 0 && (
                    <optgroup label="Active Chick & Grower Batches">
                      {(data.batches || []).map(b => (
                        <option key={b.id} value={`Batch: ${b.name || b.batch_number}`}>
                          {b.name || `Batch #${b.batch_number}`} ({b.stage || 'Chicks'} • {b.initial_count || 0} birds)
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Active Pens */}
                  {(data.pens || []).length > 0 && (
                    <optgroup label="Laying Pens">
                      {(data.pens || []).map(p => (
                        <option key={p.id} value={`Pen ${p.name}`}>
                          Pen {p.name} {p.generation ? `(${p.generation})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Blocks */}
                  {(data.pen_blocks || []).length > 0 && (
                    <optgroup label="Pen Blocks">
                      {(data.pen_blocks || []).map(blk => (
                        <option key={blk.id} value={`Block: ${blk.name}`}>
                          {blk.name} (All Pens in Block)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Dosage / Treatment Notes
                </label>
                <textarea
                  rows={3}
                  value={vacNotes}
                  onChange={(e) => setVacNotes(e.target.value)}
                  placeholder="Dosage instructions, water restriction before administration, administration method (drinking water, wing-web, eye-drop)..."
                  className="w-full bg-bg-farm border border-border-farm rounded-xl p-3 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingVac(null);
                  }}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingVac ? 'Save Changes' : 'Schedule Vaccine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
