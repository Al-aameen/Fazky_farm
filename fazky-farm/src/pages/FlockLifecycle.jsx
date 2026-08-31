import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import {
  Egg, Plus, ArrowRight, TrendingDown, ClipboardList,
  DollarSign, ChevronDown, ChevronUp, Award, Trash2, Bird,
  Save, Calendar
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = (n) => (n ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 0 });
const currency = (n) =>
  '\u20a6' + (parseFloat(n) || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO);
  const b = new Date(toISO);
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function weekProgress(batch, selectedDate) {
  const daysOld  = daysBetween(batch.arrival_date, selectedDate);
  const weekOld  = Math.ceil(daysOld / 7) || 1;
  if (!batch.expected_lay_date) return { daysOld, weekOld, totalWeeks: null, pct: null };
  const totalDays  = daysBetween(batch.arrival_date, batch.expected_lay_date);
  const totalWeeks = Math.ceil(totalDays / 7);
  const pct        = Math.min(100, totalDays > 0 ? Math.round((daysOld / totalDays) * 100) : 0);
  return { daysOld, weekOld, totalWeeks, pct };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    growing: 'bg-amber-100 text-amber-800',
    laying:  'bg-emerald-100 text-emerald-800',
    culled:  'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-border-farm shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border-farm pb-3">
          <h3 className="font-serif font-bold text-dark-green text-lg">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-dark-green font-bold text-lg leading-none">&#x2715;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Field label wrapper ──────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls  = 'w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-accent outline-none transition-all';
const selectCls = inputCls + ' appearance-none cursor-pointer';

// ─── Inline grid cell ─────────────────────────────────────────────────────────
function GridCell({ value, onChange, type = 'number', placeholder = '0', readOnly = false, cellClass = '' }) {
  return (
    <input
      type={type}
      min={type === 'number' ? '0' : undefined}
      step={type === 'number' ? 'any' : undefined}
      value={value}
      readOnly={readOnly}
      onChange={e => !readOnly && onChange(e.target.value)}
      onFocus={e => e.target.select()}
      placeholder={placeholder}
      className={`w-full text-center text-xs font-semibold bg-white border border-border-farm rounded-lg px-2 py-1.5
        focus:ring-2 focus:ring-accent outline-none transition-all min-h-[36px]
        ${readOnly ? 'bg-bg-farm text-text-muted cursor-default border-transparent' : 'hover:border-accent/60'}
        ${cellClass}`}
    />
  );
}

// ─── 4 Verified Historical Batches (ISA Brown) ───────────────────────────────
export const HISTORICAL_BATCHES = [
  {
    batch_name: 'Batch 1 (Nov 2023)',
    arrival_date: '2023-11-23',
    expected_lay_date: '2024-03-28',
    quantity_arrived: 3060,
    cost_per_bird: 400,
    breed: 'ISA Brown',
    status: 'laying',
    notes: 'Remaining as of 06-Jan-2026: 2,382 birds'
  },
  {
    batch_name: 'Batch 2 (Aug 2024)',
    arrival_date: '2024-08-22',
    expected_lay_date: '2024-12-31',
    quantity_arrived: 3040,
    cost_per_bird: 700,
    breed: 'ISA Brown',
    status: 'laying',
    notes: 'Remaining as of 06-Jan-2026: 2,556 birds'
  },
  {
    batch_name: 'Batch 3 (May 2025)',
    arrival_date: '2025-05-18',
    expected_lay_date: '2025-09-21',
    quantity_arrived: 3060,
    cost_per_bird: 1300,
    breed: 'ISA Brown',
    status: 'laying',
    notes: 'Remaining as of 06-Jan-2026: 2,377 birds'
  },
  {
    batch_name: 'Batch 4 (Sep 2025)',
    arrival_date: '2025-09-15',
    expected_lay_date: '2026-01-16',
    quantity_arrived: 3060,
    cost_per_bird: 1500,
    breed: 'ISA Brown',
    status: 'laying',
    notes: 'Remaining as of 06-Jan-2026: 2,996 birds'
  }
];

// ─── Tab list ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'batches', label: 'Batch Registry',           icon: ClipboardList },
  { id: 'daily',   label: 'Daily Chick / Grower Logs', icon: Bird          },
  { id: 'grower',  label: 'Weekly Grower Tracker',    icon: TrendingDown  },
  { id: 'sales',   label: 'Flock Sales / Culling',    icon: DollarSign    },
];

// =============================================================================
export default function FlockLifecycle() {
  const { data, insertRecord, updateRecord, deleteRecord } = useData();
  const { role } = useAuth();

  const [activeTab,     setActiveTab]     = useState('batches');
  const [expandedBatch, setExpandedBatch] = useState(null);

  // Modals
  const [showBatchModal,    setShowBatchModal]    = useState(false);
  const [showDailyLogModal, setShowDailyLogModal] = useState(false);
  const [showSaleModal,     setShowSaleModal]     = useState(false);

  // ── Batch form ────────────────────────────────────────────────────────────
  const [batchName,   setBatchName]   = useState('');
  const [arrivalDate, setArrivalDate] = useState(todayStr());
  const [vendor,      setVendor]      = useState('');
  const [qty,         setQty]         = useState('');
  const [breed,       setBreed]       = useState('');
  const [costPerBird, setCostPerBird] = useState('');
  const [expectedLay, setExpectedLay] = useState('');

  // ── Daily Chick Log Form (Item V) ─────────────────────────────────────────
  const [dailyBatchId,    setDailyBatchId]    = useState('');
  const [dailyDate,       setDailyDate]       = useState(todayStr());
  const [dailyMortality,  setDailyMortality]  = useState(0);
  const [dailyFeedBags,   setDailyFeedBags]   = useState('');
  const [dailyWaterL,     setDailyWaterL]     = useState('');
  const [dailyTempC,      setDailyTempC]      = useState('');
  const [dailyNotes,      setDailyNotes]      = useState('');
  const [dailyVaccine,    setDailyVaccine]    = useState('');

  // ── Sale form ─────────────────────────────────────────────────────────────
  const [saleDate,      setSaleDate]      = useState(todayStr());
  const [sourceType,    setSourceType]    = useState('pen');
  const [saleBatchId,   setSaleBatchId]   = useState('');
  const [salePenId,     setSalePenId]     = useState('');
  const [quantitySold,  setQuantitySold]  = useState('');
  const [pricePerBird,  setPricePerBird]  = useState('');
  const [buyerName,     setBuyerName]     = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // ── Grower weekly grid ────────────────────────────────────────────────────
  const [growerDate, setGrowerDate] = useState(todayStr());
  const [growerGrid, setGrowerGrid] = useState({});   // { [batchId]: { headcount, avg_weight, ... } }
  const [gridSaving, setGridSaving] = useState(false);
  const [gridSaved,  setGridSaved]  = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // ── Data shortcuts ────────────────────────────────────────────────────────
  const batches          = data.batches            || [];
  const growerLogs       = data.grower_logs       || [];
  const growerDailyLogs  = data.grower_daily_logs || [];
  const flockSales       = data.flock_sales        || [];
  const pens             = data.pens              || [];
  const vaccinesList     = data.vaccination_schedules || [];

  const growingBatches = useMemo(
    () => batches.filter(b => b.status === 'growing'),
    [batches]
  );

  // ── Grid helpers ──────────────────────────────────────────────────────────
  const existingLog = useCallback(
    (batchId) => growerLogs.find(l => l.batch_id === batchId && l.date === growerDate),
    [growerLogs, growerDate]
  );

  const getGridRow = useCallback((batchId) => {
    const ex = existingLog(batchId);
    const ed = growerGrid[batchId] || {};
    return {
      headcount:     ed.headcount     !== undefined ? ed.headcount     : (ex?.headcount     ?? ''),
      avg_weight:    ed.avg_weight    !== undefined ? ed.avg_weight    : (ex?.avg_weight    ?? ''),
      feed_consumed: ed.feed_consumed !== undefined ? ed.feed_consumed : (ex?.feed_consumed ?? ''),
      mortality:     ed.mortality     !== undefined ? ed.mortality     : (ex?.mortality     ?? ''),
      health_notes:  ed.health_notes  !== undefined ? ed.health_notes  : (ex?.health_notes  ?? ''),
    };
  }, [existingLog, growerGrid]);

  const updateGridCell = (batchId, field, val) => {
    setGrowerGrid(prev => ({
      ...prev,
      [batchId]: {
        ...(prev[batchId] || {}),
        [field]: val,
      },
    }));
    setGridSaved(false);
  };

  const getCumulativeMortality = useCallback((batchId, beforeDate) => {
    return growerLogs
      .filter(l => l.batch_id === batchId && l.date < beforeDate)
      .reduce((sum, l) => sum + (Number(l.mortality) || 0), 0);
  }, [growerLogs]);

  const handleSaveAllGrowth = async () => {
    setGridSaving(true);
    try {
      for (const batch of growingBatches) {
        const row = getGridRow(batch.id);
        const prevMort = getCumulativeMortality(batch.id, growerDate);
        const curMort = row.mortality !== '' ? (parseInt(row.mortality) || 0) : 0;
        const initialCount = Number(batch.quantity_arrived) || 0;
        const computedHeadcount = Math.max(0, initialCount - (prevMort + curMort));

        const ex = existingLog(batch.id);
        const payload = {
          batch_id:      batch.id,
          date:          growerDate,
          headcount:     computedHeadcount,
          avg_weight:    row.avg_weight    !== '' ? parseFloat(row.avg_weight)    : null,
          feed_consumed: row.feed_consumed !== '' ? parseFloat(row.feed_consumed) : null,
          mortality:     curMort,
          health_notes:  row.health_notes  || null,
        };
        if (ex) {
          await updateRecord('grower_logs', { id: ex.id, ...payload });
        } else {
          await insertRecord('grower_logs', payload);
        }
      }
      setGrowerGrid({});
      setGridSaved(true);
      setTimeout(() => setGridSaved(false), 3000);
    } finally {
      setGridSaving(false);
    }
  };

  // ── Batch form submit ─────────────────────────────────────────────────────
  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!batchName || !qty) return;
    setSubmitting(true);
    try {
      await insertRecord('batches', {
        batch_name:        batchName.trim(),
        arrival_date:      arrivalDate,
        vendor:            vendor.trim()    || null,
        quantity_arrived:  parseInt(qty),
        breed:             breed.trim()     || null,
        cost_per_bird:     costPerBird      ? parseFloat(costPerBird) : null,
        expected_lay_date: expectedLay      || null,
        status:            'growing',
      });
      setShowBatchModal(false);
      setBatchName(''); setQty(''); setVendor(''); setBreed(''); setCostPerBird(''); setExpectedLay('');
    } finally { setSubmitting(false); }
  };

  // ── Daily Chick Log Submit (Item V) ───────────────────────────────────────
  const handleAddDailyChickLog = async (e) => {
    e.preventDefault();
    if (!dailyBatchId || !dailyDate) return;
    setSubmitting(true);
    try {
      await insertRecord('grower_daily_logs', {
        batch_id:             dailyBatchId,
        date:                 dailyDate,
        mortality:            parseInt(dailyMortality) || 0,
        feed_consumed_kg:     dailyFeedBags ? (parseFloat(dailyFeedBags) * 25) : 0,
        water_intake_liters:  dailyWaterL ? parseFloat(dailyWaterL) : 0,
        temperature_celsius:  dailyTempC ? parseFloat(dailyTempC) : null,
        behaviour_notes:      dailyNotes.trim() || null,
        vaccine_administered: dailyVaccine.trim() || null
      });
      setShowDailyLogModal(false);
      setDailyMortality(0);
      setDailyFeedBags('');
      setDailyWaterL('');
      setDailyTempC('');
      setDailyNotes('');
      setDailyVaccine('');
    } catch (err) {
      console.error('Error saving daily chick log:', err);
      alert('Error saving log: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Graduation Guarded Strictly to Admin (Item XVI) ───────────────────────
  const handleGraduate = async (batch) => {
    if (role !== 'admin') {
      alert('🔒 Access Restricted: Only Farm Administrators are permitted to graduate batches into laying pens.');
      return;
    }

    if (!window.confirm(
      `Graduate "${batch.batch_name}" to Laying status?\n\nThis marks the batch as 'laying'. Please ensure target pens in the Bird Census are updated.`
    )) return;

    await updateRecord('batches', { id: batch.id, status: 'laying' });
  };

  // ── Sale form submit ──────────────────────────────────────────────────────
  const handleAddFlockSale = async (e) => {
    e.preventDefault();
    if (!quantitySold) return;
    setSubmitting(true);
    try {
      const q = parseInt(quantitySold);
      const p = parseFloat(pricePerBird) || 0;
      await insertRecord('flock_sales', {
        date:           saleDate,
        source_type:    sourceType,
        batch_id:       sourceType === 'batch' ? (saleBatchId || null) : null,
        pen_id:         sourceType === 'pen'   ? (salePenId   || null) : null,
        quantity_sold:  q,
        price_per_bird: p || null,
        buyer_name:     buyerName.trim() || null,
        total_revenue:  (q * p) || null,
        payment_method: paymentMethod,
      });
      setShowSaleModal(false);
      setQuantitySold(''); setPricePerBird(''); setBuyerName(''); setSaleBatchId(''); setSalePenId('');
    } finally { setSubmitting(false); }
  };

  const canEdit = role === 'admin' || role === 'manager';

  const totalBirdsGrowing = growingBatches.reduce((s, b) => s + (Number(b.initial_quantity) || 0), 0);
  const totalSold = flockSales.reduce((s, x) => s + (Number(x.quantity_sold) || 0), 0);
  const totalRevenue = flockSales.reduce((s, x) => s + (Number(x.total_revenue) || 0), 0);

  const kpis = [
    { label: 'Batches',        value: batches.length,         icon: ClipboardList, color: 'bg-blue-50 text-blue-600'   },
    { label: 'Birds Growing',  value: fmt(totalBirdsGrowing), icon: Bird,          color: 'bg-amber-50 text-amber-600' },
    { label: 'Birds Sold',     value: fmt(totalSold),         icon: TrendingDown,  color: 'bg-red-50 text-red-600'     },
    { label: 'Bird Revenue',   value: currency(totalRevenue), icon: DollarSign,    color: 'bg-emerald-50 text-primary' },
  ];

  // ============================================================================
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header — only New Batch here ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shadow-sm">
            <Egg className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">Flock Lifecycle</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              Track chicks from arrival through the grower stage to spent layer sale / culling
            </p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 bg-dark-green hover:bg-emerald-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all">
            <Plus className="w-4 h-4" /> New Batch
          </button>
        )}
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted font-black uppercase tracking-wider block">{k.label}</span>
              <div className="text-2xl font-serif font-black text-dark-green mt-1">{k.value}</div>
            </div>
            <div className={`p-3 rounded-xl ${k.color}`}><k.icon className="w-5 h-5" /></div>
          </div>
        ))}
      </div>

      {/* ── Tab selector ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg-farm p-1 rounded-xl border border-border-farm w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === t.id
                ? 'bg-white text-dark-green shadow-sm border border-border-farm'
                : 'text-text-muted hover:text-dark-green'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TAB 1 — BATCH REGISTRY                                          */}
      {/*  Compact summary table, click row to expand grower log history   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'batches' && (
        <div className="bg-white rounded-2xl border border-border-farm shadow-sm overflow-hidden">
          {/* Tab-level action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border-farm">
            <h3 className="font-serif font-bold text-dark-green text-sm">
              All Batches
              <span className="ml-2 text-[10px] font-sans font-bold text-text-muted bg-bg-farm px-2 py-0.5 rounded-full border border-border-farm">
                {batches.length}
              </span>
            </h3>
            {canEdit && (
              <div className="flex items-center gap-2">
                {batches.length < 4 && (
                  <button
                    onClick={async () => {
                      if (!confirm('Populate the 4 verified historical ISA Brown batches (Nov 2023, Aug 2024, May 2025, Sep 2025)?')) return;
                      for (const hb of HISTORICAL_BATCHES) {
                        const exists = batches.find(b => b.batch_name === hb.batch_name);
                        if (!exists) {
                          await insertRecord('batches', hb);
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-dark-green border border-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs transition-all"
                  >
                    <span>📜</span>
                    <span>Seed 4 Historical Batches</span>
                  </button>
                )}
                <button onClick={() => setShowBatchModal(true)}
                  className="flex items-center gap-1 bg-primary hover:bg-dark-green text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-sm transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Batch
                </button>
              </div>
            )}
          </div>

          {batches.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <Egg className="w-10 h-10 text-border-farm mx-auto" />
              <div>
                <p className="text-sm font-bold text-text-muted">No batches registered yet</p>
                <p className="text-xs text-text-muted mt-0.5">Click below to auto-populate the 4 verified historical batches or register a new one.</p>
              </div>
              {canEdit && (
                <button
                  onClick={async () => {
                    for (const hb of HISTORICAL_BATCHES) {
                      await insertRecord('batches', hb);
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all"
                >
                  <span>📜</span>
                  <span>Populate 4 Historical Batches (ISA Brown)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead className="bg-bg-farm text-[10px] text-text-muted uppercase font-black border-b border-border-farm">
                  <tr>
                    <th className="p-3 w-6" />
                    <th className="p-3 text-left">Batch Name</th>
                    <th className="p-3 text-center">Arrived</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-left hidden sm:table-cell">Breed</th>
                    <th className="p-3 text-left hidden md:table-cell">Vendor</th>
                    <th className="p-3 text-center hidden lg:table-cell">Cost / Bird</th>
                    <th className="p-3 text-center hidden lg:table-cell">Exp. Lay Date</th>
                    <th className="p-3 text-center">Status</th>
                    {canEdit && <th className="p-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => {
                    const logs   = growerLogs
                      .filter(l => l.batch_id === batch.id)
                      .sort((a, b) => b.date.localeCompare(a.date));
                    const isOpen = expandedBatch === batch.id;

                    return (
                      <React.Fragment key={batch.id}>
                        {/* Summary row */}
                        <tr
                          className="border-b border-border-farm hover:bg-amber-50/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedBatch(isOpen ? null : batch.id)}>
                          <td className="p-3 text-text-muted">
                            {isOpen
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                          </td>
                          <td className="p-3 font-serif font-bold text-dark-green">{batch.batch_name}</td>
                          <td className="p-3 text-center font-semibold">{batch.arrival_date}</td>
                          <td className="p-3 text-center font-bold text-dark-green">{fmt(batch.quantity_arrived)}</td>
                          <td className="p-3 text-text-muted hidden sm:table-cell">{batch.breed || '—'}</td>
                          <td className="p-3 text-text-muted hidden md:table-cell">{batch.vendor || '—'}</td>
                          <td className="p-3 text-center hidden lg:table-cell">
                            {batch.cost_per_bird ? currency(batch.cost_per_bird) : '—'}
                          </td>
                          <td className="p-3 text-center hidden lg:table-cell font-semibold">
                            {batch.expected_lay_date || '—'}
                          </td>
                          <td className="p-3 text-center"><StatusBadge status={batch.status} /></td>
                          {canEdit && (
                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                {batch.status === 'growing' && (
                                  <button
                                    onClick={() => handleGraduate(batch)}
                                    title="Graduate to Layers"
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg text-[9px] transition-all shadow-sm">
                                    <Award className="w-2.5 h-2.5" />
                                    Graduate <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteRecord('batches', batch.id)}
                                  className="text-red-400 hover:text-red-600 p-1 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expanded grower log history */}
                        {isOpen && (
                          <tr className="border-b border-border-farm">
                            <td colSpan={canEdit ? 10 : 9} className="p-0 bg-bg-farm">
                              <div className="px-6 py-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">
                                    Growth Log History — {batch.batch_name}
                                  </span>
                                  <span className="text-[10px] text-text-muted font-semibold">
                                    {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                                  </span>
                                </div>

                                {logs.length === 0 ? (
                                  <p className="text-xs text-text-muted font-semibold italic py-2">
                                    No growth logs yet — switch to the <strong>Grower Tracker</strong> tab to record weekly updates.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-border-farm bg-white">
                                    <table className="w-full text-xs font-sans">
                                      <thead className="bg-bg-farm text-[10px] text-text-muted uppercase font-black border-b border-border-farm">
                                        <tr>
                                          <th className="px-3 py-2 text-left">Date</th>
                                          <th className="px-3 py-2 text-center">Days Old</th>
                                          <th className="px-3 py-2 text-center">Headcount</th>
                                          <th className="px-3 py-2 text-center">Avg Weight</th>
                                          <th className="px-3 py-2 text-center">Feed (kg)</th>
                                          <th className="px-3 py-2 text-center">Mortality</th>
                                          <th className="px-3 py-2 text-left">Health Notes</th>
                                          {canEdit && <th className="px-3 py-2" />}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border-farm">
                                        {logs.map((lg, i) => {
                                          const dOld = daysBetween(batch.arrival_date, lg.date);
                                          return (
                                            <tr key={lg.id} className={i % 2 === 0 ? 'bg-white' : 'bg-bg-farm/40'}>
                                              <td className="px-3 py-2 font-semibold">{lg.date}</td>
                                              <td className="px-3 py-2 text-center text-text-muted font-bold">{dOld}d</td>
                                              <td className="px-3 py-2 text-center font-bold text-dark-green">{fmt(lg.headcount)}</td>
                                              <td className="px-3 py-2 text-center">{lg.avg_weight    != null ? `${lg.avg_weight} kg`    : '—'}</td>
                                              <td className="px-3 py-2 text-center">{lg.feed_consumed != null ? `${lg.feed_consumed} kg` : '—'}</td>
                                              <td className="px-3 py-2 text-center font-bold text-red-500">{lg.mortality ?? '—'}</td>
                                              <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{lg.health_notes || '—'}</td>
                                              {canEdit && (
                                                <td className="px-3 py-2 text-right">
                                                  <button onClick={() => deleteRecord('grower_logs', lg.id)}
                                                    className="text-red-400 hover:text-red-600 p-1 transition-colors">
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TAB 2 — DAILY CHICK / BROODER LOGS (Item V)                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <div className="bg-white rounded-2xl border border-border-farm shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-3">
            <div>
              <h3 className="font-serif font-bold text-dark-green text-sm flex items-center gap-2">
                <Bird className="w-4 h-4 text-primary" />
                <span>Daily Chick & Grower Logs</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Record daily chick mortality, feed consumption, water intake (Liters), behaviour, and linked vaccines.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  if (batches.length === 0) {
                    alert('Please register at least one batch first.');
                    return;
                  }
                  setDailyBatchId(batches[0].id);
                  setShowDailyLogModal(true);
                }}
                className="bg-primary hover:bg-dark-green text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Log Daily Chick Activity</span>
              </button>
            )}
          </div>

          {growerDailyLogs.length === 0 ? (
            <div className="p-8 text-center text-text-muted space-y-2">
              <Bird className="w-8 h-8 mx-auto text-border-farm" />
              <p className="text-xs font-bold">No daily chick logs recorded yet.</p>
              <p className="text-[11px]">Click "Log Daily Chick Activity" above to record daily logs for your growing chicks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-farm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-bg-farm text-[10px] text-text-muted uppercase font-black border-b border-border-farm">
                    <th className="p-3">Date</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3 text-center">Mortality</th>
                    <th className="p-3 text-center">Feed (Bags/kg)</th>
                    <th className="p-3 text-center">Water (L)</th>
                    <th className="p-3 text-center">Temp (°C)</th>
                    <th className="p-3">Vaccine / Med</th>
                    <th className="p-3">Behaviour / Notes</th>
                    {canEdit && <th className="p-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-farm/50">
                  {[...growerDailyLogs].sort((a, b) => b.date.localeCompare(a.date)).map(dLog => {
                    const batch = batches.find(b => b.id === dLog.batch_id);
                    return (
                      <tr key={dLog.id} className="hover:bg-bg-farm/40 transition-colors">
                        <td className="p-3 font-semibold font-mono">{dLog.date}</td>
                        <td className="p-3 font-bold text-dark-green">{batch?.batch_name || 'Batch'}</td>
                        <td className="p-3 text-center font-bold text-red-600">{dLog.mortality || 0}</td>
                        <td className="p-3 text-center font-mono">
                          {dLog.feed_consumed_kg ? `${(dLog.feed_consumed_kg / 25).toFixed(1)} b (${dLog.feed_consumed_kg} kg)` : '—'}
                        </td>
                        <td className="p-3 text-center font-mono">{dLog.water_intake_liters ? `${dLog.water_intake_liters} L` : '—'}</td>
                        <td className="p-3 text-center font-mono">{dLog.temperature_celsius ? `${dLog.temperature_celsius} °C` : '—'}</td>
                        <td className="p-3 text-dark-green font-semibold">{dLog.vaccine_administered || '—'}</td>
                        <td className="p-3 text-text-muted max-w-xs truncate">{dLog.behaviour_notes || '—'}</td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            <button
                              onClick={() => deleteRecord('grower_daily_logs', dLog.id)}
                              className="text-red-400 hover:text-red-600 p-1 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TAB 2 — GROWER TRACKER  (weekly inline grid)                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'grower' && (
        <div className="space-y-4">
          {/* Date picker control bar */}
          <div className="bg-white rounded-2xl border border-border-farm shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Weekly Recording Date</p>
                <p className="text-[10px] text-text-muted mt-0.5 font-semibold">
                  All rows save to this date &middot; Existing data is pre-filled automatically
                </p>
              </div>
              <DatePicker
                value={growerDate}
                onChange={(d) => { setGrowerDate(d); setGrowerGrid({}); setGridSaved(false); }}
              />
            </div>
            {canEdit && (
              <button
                onClick={handleSaveAllGrowth}
                disabled={gridSaving || growingBatches.length === 0}
                className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all whitespace-nowrap
                  ${gridSaved ? 'bg-emerald-600 text-white' : 'bg-dark-green hover:bg-emerald-900 text-white'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Save className="w-4 h-4" />
                {gridSaving ? 'Saving...' : gridSaved ? '\u2713 Saved!' : 'Save All Records'}
              </button>
            )}
          </div>

          {/* Grid table */}
          {growingBatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border-farm p-12 text-center space-y-2 shadow-sm">
              <Bird className="w-10 h-10 text-border-farm mx-auto" />
              <p className="text-sm font-bold text-text-muted">No active growing batches</p>
              <p className="text-xs text-text-muted">
                Register a batch with status <strong>growing</strong> to track weekly progress here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border-farm shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-sans" style={{ minWidth: '820px' }}>
                  <thead className="bg-bg-farm border-b border-border-farm">
                    <tr>
                      <th className="p-3 text-left text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ minWidth: 160 }}>
                        Batch
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ width: 75 }}>
                        Days Old
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ minWidth: 120 }}>
                        Progress
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ width: 100 }}>
                        Weekly Mortality *
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ width: 110 }}>
                        Est. Birds
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ width: 95 }}>
                        Avg Wt (kg)
                      </th>
                      <th className="p-3 text-center text-[10px] text-text-muted uppercase font-black tracking-wider" style={{ width: 95 }}>
                        Feed (kg)
                      </th>
                      <th className="p-3 text-left text-[10px] text-text-muted uppercase font-black tracking-wider">
                        Health Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-farm">
                    {growingBatches.map((batch, idx) => {
                      const row  = getGridRow(batch.id);
                      const prog = weekProgress(batch, growerDate);
                      const prevMort = getCumulativeMortality(batch.id, growerDate);
                      const curMort = row.mortality !== '' ? (parseInt(row.mortality) || 0) : 0;
                      const initialBirds = Number(batch.quantity_arrived) || 0;
                      const estBirds = Math.max(0, initialBirds - (prevMort + curMort));

                      return (
                        <tr key={batch.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                          {/* Batch name */}
                          <td className="p-3">
                            <div className="font-serif font-bold text-dark-green text-xs leading-tight">{batch.batch_name}</div>
                            {batch.breed && (
                              <div className="text-[10px] text-text-muted font-semibold mt-0.5">{batch.breed}</div>
                            )}
                          </td>

                          {/* Days Old — auto-calculated, never editable */}
                          <td className="p-3 text-center">
                            <span className="text-sm font-serif font-black text-dark-green">{prog.daysOld}</span>
                            <span className="text-[10px] text-text-muted font-bold block leading-none">days</span>
                          </td>

                          {/* Progress bar */}
                          <td className="p-3">
                            {prog.totalWeeks ? (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-black text-text-muted">
                                  <span>Wk {prog.weekOld}</span>
                                  <span>of ~{prog.totalWeeks}</span>
                                </div>
                                <div className="h-2 bg-border-farm rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      prog.pct >= 90 ? 'bg-emerald-500'
                                      : prog.pct >= 60 ? 'bg-amber-400'
                                      : 'bg-blue-400'
                                    }`}
                                    style={{ width: `${prog.pct}%` }}
                                  />
                                </div>
                                <div className="text-[9px] text-center text-text-muted font-bold">{prog.pct}% to lay</div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-muted italic">No lay date set</span>
                            )}
                          </td>

                          {/* Weekly Mortality — Primary Editable Input */}
                          <td className="p-2">
                            <GridCell
                              value={row.mortality}
                              onChange={v => updateGridCell(batch.id, 'mortality', v)}
                              placeholder="0"
                              cellClass={parseInt(row.mortality) > 0 ? 'text-red-600 border-red-200 bg-red-50' : ''}
                            />
                          </td>

                          {/* Est. Birds — Auto-calculated */}
                          <td className="p-3 text-center">
                            <span className="font-mono font-bold text-dark-green text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              {estBirds.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-text-muted block font-semibold mt-0.5">auto-calc</span>
                          </td>

                          {/* Avg Weight */}
                          <td className="p-2">
                            <GridCell
                              value={row.avg_weight}
                              onChange={v => updateGridCell(batch.id, 'avg_weight', v)}
                              placeholder="0.00"
                            />
                          </td>

                          {/* Feed Consumed */}
                          <td className="p-2">
                            <GridCell
                              value={row.feed_consumed}
                              onChange={v => updateGridCell(batch.id, 'feed_consumed', v)}
                              placeholder="0.0"
                            />
                          </td>

                          {/* Health Notes */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.health_notes}
                              onChange={e => updateGridCell(batch.id, 'health_notes', e.target.value)}
                              placeholder="Notes…"
                              className="w-full text-xs font-medium bg-transparent border border-border-farm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grid footer */}
              <div className="px-4 py-2.5 bg-bg-farm border-t border-border-farm flex items-center justify-between gap-3">
                <p className="text-[10px] text-text-muted font-semibold">
                  * Headcount required to save a row &nbsp;&middot;&nbsp; Tab through cells for fast entry
                </p>
                {canEdit && (
                  <button
                    onClick={handleSaveAllGrowth}
                    disabled={gridSaving || growingBatches.length === 0}
                    className={`flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all whitespace-nowrap
                      ${gridSaved ? 'bg-emerald-600 text-white' : 'bg-dark-green hover:bg-emerald-900 text-white'}
                      disabled:opacity-50`}>
                    <Save className="w-3.5 h-3.5" />
                    {gridSaving ? 'Saving...' : gridSaved ? '\u2713 Saved!' : 'Save All Records'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  TAB 3 — FLOCK SALES / CULLING  (unchanged from previous build)  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-border-farm shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border-farm flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-dark-green text-sm">Flock Sales &amp; Culling Log</h3>
              <p className="text-[10px] text-text-muted mt-0.5">
                Pen-based sales auto-deduct from the Census Matrix for the recorded date
              </p>
            </div>
            {canEdit && (
              <button onClick={() => setShowSaleModal(true)}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Record Sale
              </button>
            )}
          </div>

          {/* Revenue strip */}
          <div className="grid grid-cols-3 divide-x divide-border-farm border-b border-border-farm text-center">
            {[
              { label: 'Total Sales', value: flockSales.length },
              { label: 'Birds Sold',  value: fmt(totalSold) },
              { label: 'Revenue',     value: currency(totalRevenue), green: true },
            ].map(s => (
              <div key={s.label} className="py-3 px-4">
                <div className="text-[10px] text-text-muted font-black uppercase">{s.label}</div>
                <div className={`text-base font-serif font-black ${s.green ? 'text-primary' : 'text-dark-green'}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {flockSales.length === 0 ? (
            <div className="p-10 text-center text-sm text-text-muted font-semibold">
              No flock sales recorded yet. Click <strong>Record Sale</strong> to log a transaction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead className="bg-bg-farm text-[10px] text-text-muted uppercase font-black border-b border-border-farm">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-center">Qty Sold</th>
                    <th className="p-3 text-center">Price / Bird</th>
                    <th className="p-3 text-center">Revenue</th>
                    <th className="p-3 text-left">Buyer</th>
                    <th className="p-3 text-left">Payment</th>
                    {canEdit && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-farm">
                  {[...flockSales].sort((a, b) => b.date.localeCompare(a.date)).map(fs => {
                    const srcName = fs.source_type === 'pen'
                      ? (pens.find(p => p.id === fs.pen_id)?.name ?? 'Pen')
                      : (batches.find(b => b.id === fs.batch_id)?.batch_name ?? 'Batch');
                    return (
                      <tr key={fs.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="p-3 font-semibold">{fs.date}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                              fs.source_type === 'pen' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }`}>{fs.source_type}</span>
                            <span className="font-bold text-dark-green">{srcName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-red-600">{fmt(fs.quantity_sold)}</td>
                        <td className="p-3 text-center">{fs.price_per_bird ? currency(fs.price_per_bird) : '—'}</td>
                        <td className="p-3 text-center font-bold text-primary">{fs.total_revenue ? currency(fs.total_revenue) : '—'}</td>
                        <td className="p-3 text-text-muted">{fs.buyer_name || '—'}</td>
                        <td className="p-3">{fs.payment_method || '—'}</td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            <button onClick={() => deleteRecord('flock_sales', fs.id)}
                              className="text-red-400 hover:text-red-600 p-1 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  MODALS                                                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Register New Batch (Fixed clean date inputs) */}
      {showBatchModal && (
        <Modal title="Register New Chick Batch" onClose={() => setShowBatchModal(false)}>
          <form onSubmit={handleAddBatch} className="space-y-4 font-sans text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Batch Name *">
                  <input type="text" value={batchName} onChange={e => setBatchName(e.target.value)}
                    className={inputCls} placeholder="e.g. Batch B'26 — Aug Arrival" required />
                </Field>
              </div>
              <Field label="Arrival Date *">
                <input type="date" required value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Quantity Arrived *">
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                  className={inputCls} placeholder="500" required onFocus={e => e.target.select()} />
              </Field>
              <Field label="Vendor / Hatchery">
                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)}
                  className={inputCls} placeholder="e.g. Prime Hatchery Ltd" />
              </Field>
              <Field label="Breed">
                <input type="text" value={breed} onChange={e => setBreed(e.target.value)}
                  className={inputCls} placeholder="e.g. ISA Brown" />
              </Field>
              <Field label="Cost per Bird (₦)">
                <input type="number" min="0" value={costPerBird} onChange={e => setCostPerBird(e.target.value)}
                  className={inputCls} placeholder="650" onFocus={e => e.target.select()} />
              </Field>
              <Field label="Expected Lay Date (Target laying period)">
                <input type="date" value={expectedLay} onChange={e => setExpectedLay(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowBatchModal(false)}
                className="flex-1 py-2.5 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 bg-dark-green text-white font-bold text-xs rounded-xl hover:bg-emerald-900 shadow-sm transition-all">
                {submitting ? 'Saving...' : 'Register Batch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Daily Chick & Brooder Log Modal (Item V) */}
      {showDailyLogModal && (
        <Modal title="Log Daily Chick Activity" onClose={() => setShowDailyLogModal(false)}>
          <form onSubmit={handleAddDailyChickLog} className="space-y-3 font-sans text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Field label="Chick Batch *">
                  <select
                    value={dailyBatchId}
                    onChange={e => setDailyBatchId(e.target.value)}
                    className={selectCls}
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batch_name} ({b.status})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <Field label="Log Date *">
                  <input
                    type="date"
                    required
                    value={dailyDate}
                    onChange={e => setDailyDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-bg-farm p-3 rounded-xl border border-border-farm">
              <div>
                <Field label="Mortality (Dead)">
                  <input
                    type="number"
                    min="0"
                    value={dailyMortality}
                    onChange={e => setDailyMortality(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center text-red-600 focus:outline-none"
                  />
                </Field>
              </div>

              <div>
                <Field label="Feed (Bags)">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 0.5"
                    value={dailyFeedBags}
                    onChange={e => setDailyFeedBags(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center focus:outline-none"
                  />
                </Field>
              </div>

              <div>
                <Field label="Water (Liters)">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 20"
                    value={dailyWaterL}
                    onChange={e => setDailyWaterL(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center focus:outline-none"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Field label="Brooder Temp (°C)">
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 32.5"
                    value={dailyTempC}
                    onChange={e => setDailyTempC(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div>
                <Field label="Linked Vaccine / Med">
                  <select
                    value={dailyVaccine}
                    onChange={e => setDailyVaccine(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— None / Regular Water —</option>
                    {vaccinesList.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                    <option value="Glucose + Vitamins">Glucose + Anti-stress Vitamins</option>
                    <option value="Antibiotics Treatment">Antibiotics Treatment</option>
                    <option value="Coccidiostat">Coccidiostat</option>
                  </select>
                </Field>
              </div>
            </div>

            <div>
              <Field label="Chick Behaviour & Health Notes">
                <textarea
                  rows={2}
                  value={dailyNotes}
                  onChange={e => setDailyNotes(e.target.value)}
                  placeholder="Chicks active, huddling under heater, dropping consistency, feather development..."
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDailyLogModal(false)}
                className="flex-1 py-2.5 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 bg-primary hover:bg-dark-green text-white font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                {submitting ? 'Saving...' : 'Save Daily Log'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Flock Sale */}
      {showSaleModal && (
        <Modal title="Record Flock Sale / Culling" onClose={() => setShowSaleModal(false)}>
          <form onSubmit={handleAddFlockSale} className="space-y-4 font-sans text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sale Date *">
                <DatePicker value={saleDate} onChange={setSaleDate} />
              </Field>
              <Field label="Source Type *">
                <select value={sourceType} onChange={e => setSourceType(e.target.value)} className={selectCls}>
                  <option value="pen">Pen (deducts from Census)</option>
                  <option value="batch">Batch / Grower</option>
                </select>
              </Field>

              {sourceType === 'pen' ? (
                <div className="col-span-2">
                  <Field label="Source Pen *">
                    <select value={salePenId} onChange={e => setSalePenId(e.target.value)} className={selectCls} required>
                      <option value="">— Select pen —</option>
                      {pens.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                </div>
              ) : (
                <div className="col-span-2">
                  <Field label="Source Batch *">
                    <select value={saleBatchId} onChange={e => setSaleBatchId(e.target.value)} className={selectCls} required>
                      <option value="">— Select batch —</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.batch_name}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              <Field label="Quantity Sold *">
                <input type="number" min="1" value={quantitySold} onChange={e => setQuantitySold(e.target.value)}
                  className={inputCls} placeholder="50" required onFocus={e => e.target.select()} />
              </Field>
              <Field label="Price per Bird (&#x20a6;)">
                <input type="number" min="0" step="0.01" value={pricePerBird} onChange={e => setPricePerBird(e.target.value)}
                  className={inputCls} placeholder="2500" onFocus={e => e.target.select()} />
              </Field>

              {quantitySold && pricePerBird && (
                <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex justify-between items-center">
                  <span className="text-xs font-bold text-dark-green">Calculated Revenue</span>
                  <span className="text-sm font-serif font-black text-primary">
                    {currency(parseFloat(quantitySold || 0) * parseFloat(pricePerBird || 0))}
                  </span>
                </div>
              )}

              <Field label="Buyer Name">
                <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)}
                  className={inputCls} placeholder="e.g. Alhaji Musa" />
              </Field>
              <Field label="Payment Method">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={selectCls}>
                  <option>Cash</option>
                  <option>Transfer</option>
                  <option>Cheque</option>
                  <option>Credit (Debt)</option>
                </select>
              </Field>
            </div>

            {sourceType === 'pen' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[10px] text-amber-800 font-semibold">
                Pen-based sales automatically deduct sold birds from the Census Matrix for the sale date.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowSaleModal(false)}
                className="flex-1 py-2.5 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 shadow-sm transition-all">
                {submitting ? 'Saving...' : 'Record Sale / Cull'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
