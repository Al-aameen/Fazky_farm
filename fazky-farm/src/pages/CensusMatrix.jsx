import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useData, resolvePenDisplayName } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import GridShortcutsModal from '../components/GridShortcutsModal';
import { useGridNavigation } from '../hooks/useGridNavigation';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { Plus, Save, Edit3, Settings, ShieldAlert, Check, Download, Search, Upload, Calendar, Hash, Tag, HelpCircle } from 'lucide-react';

export default function CensusMatrix() {
  const { data, insertRecord, updateRecord, bulkInsertRecords, ensureDateLoaded } = useData();
  const { role, worker } = useAuth();

  const todayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr); // Exact period date (e.g. 2026-08-28 or 2025-12-31)
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7)); // Month-first browsing (G1)
  const [countDateInput, setCountDateInput] = useState('');    // Date physically counted
  const [periodLabelInput, setPeriodLabelInput] = useState(''); // e.g. "December 2025 Closing"
  const [gridData, setGridData] = useState({});               // `${penId}-${workerId}-${side}-${slot}` -> count
  const [initialGridData, setInitialGridData] = useState({}); // Snapshot for dirty tracking (G2)
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const censusImportRef = useRef(null);

  // New Count Modal state (G1)
  const [showNewCountModal, setShowNewCountModal] = useState(false);
  const [newCountDate, setNewCountDate] = useState(todayStr());
  const [newCountPhysicalDate, setNewCountPhysicalDate] = useState(todayStr());
  const [newCountPeriodLabel, setNewCountPeriodLabel] = useState('');

  // Manage Pens Modal state (G3)
  const [showManagePens, setShowManagePens] = useState(false);
  const [renamingPenId, setRenamingPenId] = useState(null);
  const [newDisplayNameInput, setNewDisplayNameInput] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Auto-fetch historical census counts for the selected date if not cached
  useEffect(() => {
    if (selectedDate && ensureDateLoaded) {
      ensureDateLoaded('census_counts', selectedDate);
    }
  }, [selectedDate, ensureDateLoaded]);

  // Keep selectedMonth in sync if selectedDate changes
  useEffect(() => {
    if (selectedDate && selectedDate.slice(0, 7) !== selectedMonth) {
      setSelectedMonth(selectedDate.slice(0, 7));
    }
  }, [selectedDate]);

  // ── Month-First Recorded Dates List (G1) ──
  const recordedDatesInMonth = useMemo(() => {
    const counts = data.census_counts || [];
    const dateMap = new Map();
    counts.forEach(c => {
      if (c.date && c.date.startsWith(selectedMonth)) {
        if (!dateMap.has(c.date)) {
          dateMap.set(c.date, {
            date: c.date,
            countDate: c.count_date || c.date,
            periodLabel: c.period_label || '',
            totalBirds: 0
          });
        }
        dateMap.get(c.date).totalBirds += (c.bird_count || 0);
      }
    });
    return Array.from(dateMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data.census_counts, selectedMonth]);

  // ── Dirty Cells Set (G2) ──
  const dirtyKeys = useMemo(() => {
    const dirty = new Set();
    Object.keys(gridData).forEach(key => {
      const current = gridData[key] === '' ? 0 : Number(gridData[key]) || 0;
      const initial = initialGridData[key] === '' ? 0 : Number(initialGridData[key]) || 0;
      if (current !== initial) {
        dirty.add(key);
      }
    });
    return dirty;
  }, [gridData, initialGridData]);

  // Modal states for Add Pen
  const [showAddPen, setShowAddPen] = useState(false);
  const [newPenName, setNewPenName] = useState('');
  const [newPenBlockId, setNewPenBlockId] = useState('');
  const [newPenSlotCount, setNewPenSlotCount] = useState(15);
  const [newPenGeneration, setNewPenGeneration] = useState('');

  // Modal state for General Livestock Row
  const [showAddLivestock, setShowAddLivestock] = useState(false);
  const [lsCategory, setLsCategory] = useState('Turkeys');
  const [lsBreed, setLsBreed] = useState('');
  const [lsMale, setLsMale] = useState(0);
  const [lsFemale, setLsFemale] = useState(0);
  const [lsUnsexed, setLsUnsexed] = useState(0);
  const [lsVendor, setLsVendor] = useState('');
  const [lsRemarks, setLsRemarks] = useState('');

  // ── 4A. Build Worker-Based Column Structure for Selected Date ──────────────
  const { gridColumns, penGroups, hasAnyTwoSections, maxSlots } = useMemo(() => {
    const rawAssignments = data.pen_worker_history || [];
    const nameHistory = data.pen_name_history || [];
    const allPens = data.pens || [];
    const allWorkers = data.workers || [];

    const penLookup = Object.fromEntries(allPens.map(p => [p.id, p]));
    const workerLookup = Object.fromEntries(allWorkers.map(w => [w.id, w]));

    // Query active worker assignments on the EXACT selectedDate
    let dateAssignments = rawAssignments.filter(a => {
      const matchStart = a.start_date <= selectedDate;
      const matchEnd = !a.end_date || a.end_date >= selectedDate;
      return matchStart && matchEnd;
    });

    if (role === 'staff' && worker?.id) {
      dateAssignments = dateAssignments.filter(a => a.worker_id === worker.id);
    }

    // Sort assignments by pen display order, then worker name
    dateAssignments.sort((a, b) => {
      const penA = penLookup[a.pen_id] || {};
      const penB = penLookup[b.pen_id] || {};
      const ordA = penA.display_order ?? 0;
      const ordB = penB.display_order ?? 0;
      if (ordA !== ordB) return ordA - ordB;
      const nameA = workerLookup[a.worker_id]?.name || '';
      const nameB = workerLookup[b.worker_id]?.name || '';
      return nameA.localeCompare(nameB);
    });

    // Fallback if no assignments exist for this date: map active pens with unassigned staff
    if (dateAssignments.length === 0) {
      let activePens = allPens;
      if (selectedDate >= '2026-08-13') {
        activePens = activePens.filter(p => p.is_active !== false && !p.name?.toLowerCase().includes('retired'));
      }
      activePens.forEach(p => {
        dateAssignments.push({
          id: `fallback-${p.id}`,
          pen_id: p.id,
          worker_id: p.worker_id || null,
          has_two_sections: false
        });
      });
    }

    const columns = [];
    const groupsMap = new Map();
    let hasTwo = false;
    let maxSlot = 15;

    dateAssignments.forEach(a => {
      const pen = penLookup[a.pen_id] || { id: a.pen_id, name: 'Pen' };
      const wrk = workerLookup[a.worker_id] || { id: a.worker_id || 'unassigned', name: 'Unassigned' };
      const penDisplayName = resolvePenDisplayName(a.pen_id, selectedDate, nameHistory, pen.name);
      const slotCount = pen.slot_count || 15;
      if (slotCount > maxSlot) maxSlot = slotCount;

      const isTwo = !!a.has_two_sections;
      if (isTwo) hasTwo = true;
      const sections = isTwo ? ['a', 'b'] : ['a'];

      // Build group structure
      if (!groupsMap.has(a.pen_id)) {
        groupsMap.set(a.pen_id, {
          penId: a.pen_id,
          penName: penDisplayName,
          physicalLabel: pen.name,
          slotCount,
          workers: []
        });
      }

      const penGroup = groupsMap.get(a.pen_id);
      const workerCols = [];

      sections.forEach(section => {
        const colDef = {
          key: `${a.pen_id}-${a.worker_id || 'unassigned'}-${section}`,
          penId: a.pen_id,
          penName: penDisplayName,
          workerId: a.worker_id || 'unassigned',
          workerName: wrk.name || 'Staff',
          section,
          hasTwoSections: isTwo,
          slotCount
        };
        columns.push(colDef);
        workerCols.push(colDef);
      });

      penGroup.workers.push({
        workerId: a.worker_id || 'unassigned',
        workerName: wrk.name || 'Staff',
        hasTwoSections: isTwo,
        columns: workerCols
      });
    });

    const groups = Array.from(groupsMap.values()).map(g => ({
      ...g,
      totalCols: g.workers.reduce((s, w) => s + w.columns.length, 0)
    }));

    return {
      gridColumns: columns,
      penGroups: groups,
      hasAnyTwoSections: hasTwo,
      maxSlots: maxSlot
    };
  }, [data.pen_worker_history, data.pen_name_history, data.pens, data.workers, selectedDate, role, worker?.id]);

  // ── 4C. Load Existing Census Data for Selected Date ────────────────────────
  useEffect(() => {
    const counts = data.census_counts || [];
    const newGrid = {};
    let foundCountDate = '';
    let foundPeriodLabel = '';

    counts.forEach(c => {
      if (c.date === selectedDate) {
        const wId = c.worker_id || 'unassigned';
        const section = c.side || 'a';
        const key = `${c.pen_id}-${wId}-${section}-${c.slot_number}`;
        newGrid[key] = c.bird_count;

        if (c.count_date && !foundCountDate) foundCountDate = c.count_date;
        if (c.period_label && !foundPeriodLabel) foundPeriodLabel = c.period_label;
      }
    });

    setGridData(newGrid);
    setInitialGridData(newGrid); // Snapshot for dirty tracking (G2)
    if (foundCountDate) setCountDateInput(foundCountDate);
    else setCountDateInput('');
    if (foundPeriodLabel) setPeriodLabelInput(foundPeriodLabel);
    else setPeriodLabelInput('');
  }, [selectedDate, data.census_counts]);

  const handleCellChange = (penId, workerId, section, slot, val) => {
    const key = `${penId}-${workerId}-${section}-${slot}`;
    // Clean to numeric digits only
    const cleanStr = String(val).replace(/[^0-9]/g, '');
    const num = cleanStr === '' ? '' : parseInt(cleanStr, 10);

    setGridData(prev => ({
      ...prev,
      [key]: isNaN(num) ? '' : num
    }));
  };

  // ── 4E. Totals Calculations ────────────────────────────────────────────────
  const getColumnTotal = (col) => {
    let total = 0;
    for (let slot = 1; slot <= col.slotCount; slot++) {
      const key = `${col.penId}-${col.workerId}-${col.section}-${slot}`;
      total += Number(gridData[key]) || 0;
    }
    return total;
  };

  const getPenTotal = (penId) => {
    const penCols = gridColumns.filter(c => c.penId === penId);
    return penCols.reduce((sum, col) => sum + getColumnTotal(col), 0);
  };

  const getGrandTotal = () => {
    return gridColumns.reduce((sum, col) => sum + getColumnTotal(col), 0);
  };

  const {
    anchorCell,
    focusCell,
    selectionRange,
    isCellSelected,
    isCellAnchor,
    hasMultiSelection,
    selectionStats,
    registerRef,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleKeyDown
  } = useGridNavigation({
    numRows: maxSlots,
    numCols: gridColumns.length,
    getCellValue: (r, c) => {
      const col = gridColumns[c];
      if (!col) return '';
      const slotNumber = r + 1;
      const key = `${col.penId}-${col.workerId}-${col.section}-${slotNumber}`;
      return gridData[key] ?? '';
    },
    setCellValue: (r, c, val) => {
      const col = gridColumns[c];
      if (!col) return;
      const slotNumber = r + 1;
      handleCellChange(col.penId, col.workerId, col.section, slotNumber, val);
    },
    setMultipleCellValues: (updates) => {
      setGridData(prev => {
        const next = { ...prev };
        updates.forEach(({ r, c, val }) => {
          const col = gridColumns[c];
          if (!col) return;
          const slotNumber = r + 1;
          const key = `${col.penId}-${col.workerId}-${col.section}-${slotNumber}`;
          next[key] = val;
        });
        return next;
      });
    },
    isCellEditable: (r, c) => {
      const col = gridColumns[c];
      if (!col) return false;
      return (r + 1) <= col.slotCount;
    },
    isDecimalCol: () => false
  });

  // ── 4D. Save Census Grid ───────────────────────────────────────────────────
  const handleSaveGrid = async (filterKeys = null) => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      if (import.meta.env.DEV) console.log('[CensusMatrix] handleSaveGrid invoked for date:', selectedDate);
      const recordsToUpsert = [];
      const nowCountDate = countDateInput || selectedDate;
      const nowLabel = periodLabelInput.trim() || null;

      gridColumns.forEach(col => {
        const wId = col.workerId === 'unassigned' ? null : col.workerId;
        for (let slot = 1; slot <= col.slotCount; slot++) {
          const key = `${col.penId}-${col.workerId}-${col.section}-${slot}`;
          if (filterKeys && !filterKeys.has(key)) continue;

          const val = Number(gridData[key]) || 0;

          recordsToUpsert.push({
            pen_id: col.penId,
            worker_id: wId,
            side: col.section,
            slot_number: slot,
            bird_count: val,
            date: selectedDate,
            count_date: nowCountDate,
            period_label: nowLabel,
            updated_at: new Date().toISOString()
          });
        }
      });

      if (recordsToUpsert.length === 0) {
        setSaving(false);
        return;
      }

      const res = await bulkInsertRecords('census_counts', recordsToUpsert);
      if (res && res.error) {
        throw new Error(res.error);
      }

      setInitialGridData({ ...gridData });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save census matrix:', err);
      setErrorMessage(err?.message || 'Failed to save census records. Your data is still on screen.');
    } finally {
      setSaving(false);
    }
  };

  // G2: Save only dirty (changed) cells
  const handleSaveChangedCellsOnly = () => {
    if (dirtyKeys.size === 0) return;
    handleSaveGrid(dirtyKeys);
  };

  // G2: Quick save a single worker column
  const handleSaveWorkerColumn = async (col) => {
    const colKeys = new Set();
    for (let slot = 1; slot <= col.slotCount; slot++) {
      colKeys.add(`${col.penId}-${col.workerId}-${col.section}-${slot}`);
    }
    await handleSaveGrid(colKeys);
  };

  // G3: Safe Rename Pen handler (never modifies pens.name!)
  const handleRenamePen = async (penId, newDisplayName) => {
    if (!newDisplayName.trim()) return;
    setSavingRename(true);
    try {
      // 1. Close current active pen_name_history row
      const currentActive = (data.pen_name_history || []).find(h => h.pen_id === penId && !h.end_date);
      if (currentActive) {
        await updateRecord('pen_name_history', {
          id: currentActive.id,
          end_date: todayStr()
        });
      }

      // 2. Insert new pen_name_history row starting today
      await insertRecord('pen_name_history', {
        pen_id: penId,
        display_name: newDisplayName.trim(),
        start_date: todayStr(),
        is_primary: true
      });

      setRenamingPenId(null);
      setNewDisplayNameInput('');
    } catch (err) {
      console.error('Failed to rename pen:', err);
      alert('Failed to rename pen: ' + err.message);
    } finally {
      setSavingRename(false);
    }
  };

  // G1: Handler for starting a new census count
  const handleStartNewCount = () => {
    if (!newCountDate) return;
    const existing = (data.census_counts || []).some(c => c.date === newCountDate);
    if (existing) {
      if (!window.confirm(`⚠️ Records already exist for ${newCountDate}.\n\nDo you want to open and modify this existing census?`)) {
        return;
      }
    }
    setSelectedDate(newCountDate);
    setCountDateInput(newCountPhysicalDate || newCountDate);
    setPeriodLabelInput(newCountPeriodLabel || '');
    setShowNewCountModal(false);
  };

  // Filter columns by search term
  const filteredColumns = useMemo(() => {
    if (!searchTerm) return gridColumns;
    const lc = searchTerm.toLowerCase();
    return gridColumns.filter(c => 
      c.penName.toLowerCase().includes(lc) || 
      c.workerName.toLowerCase().includes(lc)
    );
  }, [gridColumns, searchTerm]);

  return (
    <div className="p-6 space-y-6">
      {/* ── G1. Month-First Navigation Bar ── */}
      <div className="bg-white border border-border-farm rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-serif font-bold text-dark-green text-sm">Census Month:</span>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-bg-farm border border-border-farm rounded-xl px-3 py-1.5 text-xs font-bold text-dark-green focus:ring-2 focus:ring-primary outline-none cursor-pointer"
          />

          {/* Recorded Census Counts in Selected Month */}
          <div className="flex flex-wrap items-center gap-2">
            {recordedDatesInMonth.length === 0 ? (
              <span className="text-xs text-text-muted italic">No counts recorded in {selectedMonth}</span>
            ) : (
              recordedDatesInMonth.map(rec => {
                const isSelected = rec.date === selectedDate;
                return (
                  <button
                    key={rec.date}
                    onClick={() => setSelectedDate(rec.date)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-bg-farm text-dark-green border-border-farm hover:bg-emerald-50'
                    }`}
                  >
                    <span>📅 {rec.date}</span>
                    {rec.periodLabel && (
                      <span className={`text-[10px] font-normal px-1 rounded ${isSelected ? 'bg-white/20' : 'bg-border-farm/50'}`}>
                        {rec.periodLabel}
                      </span>
                    )}
                    <span className="font-mono text-[10px] opacity-80">
                      ({rec.totalBirds.toLocaleString()})
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* New Count Button (G1) */}
          <button
            onClick={() => {
              setNewCountDate(todayStr());
              setNewCountPhysicalDate(todayStr());
              setNewCountPeriodLabel('');
              setShowNewCountModal(true);
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Count</span>
          </button>

          {/* Manage Pens Button (G3 - Admin & Manager) */}
          {(role === 'admin' || role === 'manager') && (
            <button
              onClick={() => setShowManagePens(true)}
              className="flex items-center gap-1.5 bg-bg-farm hover:bg-border-farm/40 text-dark-green font-bold px-3 py-2 rounded-xl text-xs border border-border-farm shadow-xs transition-all whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-primary" />
              <span>Manage Pens</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Action Header Bar ── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">
              Bird Census Matrix — <span className="font-mono text-primary font-black">{selectedDate}</span>
            </h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Worker-based slot counts ({gridColumns.length} counting section{gridColumns.length !== 1 ? 's' : ''})
              {countDateInput && ` • Counted: ${countDateInput}`}
              {periodLabelInput && ` • Label: ${periodLabelInput}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Optional: Count Performed On input */}
          <div className="flex flex-col">
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-0.5">
              Count Performed On
            </label>
            <input
              type="date"
              value={countDateInput}
              onChange={(e) => setCountDateInput(e.target.value)}
              placeholder="Physical count date"
              className="bg-bg-farm border border-border-farm rounded-xl px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-primary outline-none"
              title="The date physical counting actually occurred"
            />
          </div>

          {/* Optional: Period Label input */}
          <div className="flex flex-col">
            <label className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-0.5">
              Period Label
            </label>
            <input
              type="text"
              value={periodLabelInput}
              onChange={(e) => setPeriodLabelInput(e.target.value)}
              placeholder="e.g. Dec 2025 Closing"
              className="bg-bg-farm border border-border-farm rounded-xl px-2.5 py-1.5 text-xs font-semibold text-text-primary focus:ring-2 focus:ring-primary outline-none max-w-[150px]"
            />
          </div>

          {/* Export Action Button */}
          <button
            type="button"
            onClick={() => {
              const exportRows = [];
              gridColumns.forEach(col => {
                for (let slot = 1; slot <= col.slotCount; slot++) {
                  const key = `${col.penId}-${col.workerId}-${col.section}-${slot}`;
                  exportRows.push({
                    date: selectedDate,
                    count_date: countDateInput || selectedDate,
                    period_label: periodLabelInput || '',
                    pen_name: col.penName,
                    worker_name: col.workerName,
                    section: col.section,
                    slot_number: slot,
                    bird_count: Number(gridData[key]) || 0
                  });
                }
              });
              exportToExcel(`fazky_bird_census_${selectedDate}`, 'Census', exportRows);
            }}
            className="flex items-center gap-1 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
            title="Export current census grid as Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Keyboard Shortcuts Reference Button */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1 bg-white hover:bg-emerald-50 text-dark-green font-bold px-2.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
            title="Keyboard navigation & shortcuts cheat sheet"
          >
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">Shortcuts</span>
          </button>

          {/* G2: Save Changed Cells Only */}
          {dirtyKeys.size > 0 && (
            <button
              onClick={handleSaveChangedCellsOnly}
              disabled={saving}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-md transition-all animate-pulse"
              title="Save only cells with modifications"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changed ({dirtyKeys.size})</span>
            </button>
          )}

          {/* Save All */}
          <button
            onClick={() => handleSaveGrid()}
            disabled={saving}
            className={`flex items-center gap-1.5 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all ${
              saveSuccess
                ? 'bg-emerald-700'
                : 'bg-primary hover:bg-dark-green disabled:opacity-50'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Saved Census!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save All Records'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-xs text-red-800 font-sans shadow-sm">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">Save failed — your data is still on screen</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="shrink-0 text-red-500 hover:text-red-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* ── Summary & Search Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 flex items-center gap-3 bg-white border border-border-farm rounded-2xl px-4 py-2.5 shadow-sm">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Filter by pen name or worker..."
            className="flex-1 bg-transparent text-sm font-sans focus:outline-none text-text-primary placeholder:text-text-muted"
          />
        </div>

        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Total Live Birds</span>
            <span className="font-serif font-bold text-lg text-dark-green">{getGrandTotal().toLocaleString()} birds</span>
          </div>
          <span className="text-xl">🐣</span>
        </div>

        <div className="bg-white border border-border-farm rounded-2xl p-3 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-text-muted block">Active Sections</span>
            <span className="font-mono font-bold text-lg text-primary">{gridColumns.length} columns</span>
          </div>
          <span className="text-xl">🏠</span>
        </div>
      </div>

      {/* ── 4B. 3-Tier Census Matrix Grid ── */}
      {gridColumns.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm">
          <ShieldAlert className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h4 className="font-serif text-lg text-dark-green font-bold">No assigned workers found for {selectedDate}</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Please check the selected date or assign workers to pens in the Workers directory.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[600px] scrollbar-thin">
            <table className="w-full border-collapse border-spacing-0 text-left">
              <thead>
                {/* ── Header Tier 1: Pen Name ── */}
                <tr className="bg-dark-green text-white text-xs font-serif sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.15)]">
                  <th 
                    rowSpan={hasAnyTwoSections ? 3 : 2} 
                    className="p-3 border-r border-white/20 w-20 sticky left-0 bg-dark-green z-40 text-center font-mono font-bold uppercase tracking-wider"
                  >
                    Slot No.
                  </th>
                  {penGroups.map((g, idx) => (
                    <th
                      key={g.penId}
                      colSpan={g.totalCols}
                      className={`p-3 text-center border-r border-white/20 uppercase tracking-widest font-black ${
                        idx % 2 === 0 ? 'bg-dark-green' : 'bg-[#183a15]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>🏠 {g.penName}</span>
                        <span className="text-[10px] font-sans font-normal opacity-75">
                          ({getPenTotal(g.penId).toLocaleString()} birds)
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* ── Header Tier 2: Worker Name & Quick Save (G2) ── */}
                <tr className="bg-primary text-white text-[11px] font-sans sticky top-[41px] z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.15)]">
                  {penGroups.map(g =>
                    g.workers.map(w => (
                      <th
                        key={`${g.penId}-${w.workerId}`}
                        colSpan={w.hasTwoSections ? 2 : 1}
                        className="p-2 text-center border-r border-white/20 font-bold tracking-tight bg-primary"
                      >
                        <div className="flex items-center justify-between gap-1 max-w-[150px] mx-auto">
                          <div className="font-serif text-xs text-white truncate">
                            👤 {w.workerName}
                          </div>
                          {/* G2: Quick Save Worker Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              w.columns.forEach(col => handleSaveWorkerColumn(col));
                            }}
                            title={`Save only ${w.workerName}'s slots`}
                            className="p-1 hover:bg-white/20 rounded transition-colors text-[10px] font-bold text-white/90 hover:text-white"
                          >
                            💾
                          </button>
                        </div>
                      </th>
                    ))
                  )}
                </tr>

                {/* ── Header Tier 3: Sub-section Label (a / b) ── */}
                {hasAnyTwoSections && (
                  <tr className="bg-light-green text-dark-green text-[10px] font-bold uppercase tracking-wider sticky top-[77px] z-20 border-b border-border-farm shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    {gridColumns.map(col => (
                      <th key={col.key} className="p-1.5 text-center border-r border-border-farm font-mono">
                        {col.hasTwoSections ? `Sec ${col.section}` : 'Sec a'}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>

              {/* ── Matrix Rows (Slots 1 to maxSlots) ── */}
              <tbody className="divide-y divide-border-farm text-sm">
                {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slotNumber) => {
                  const r = slotNumber - 1;
                  return (
                    <tr key={slotNumber} className="hover:bg-emerald-50/30 transition-colors">
                      {/* Sticky left Slot Number */}
                      <td className="p-2 font-mono font-bold text-center border-r border-border-farm sticky left-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-20 z-10 text-dark-green select-none">
                        {slotNumber}
                      </td>

                      {/* Column Input Cells (C1, C2, G2) */}
                      {gridColumns.map((col, c) => {
                        const isCellValid = slotNumber <= col.slotCount;
                        const cellKey = `${col.penId}-${col.workerId}-${col.section}-${slotNumber}`;
                        const val = gridData[cellKey] ?? '';
                        const isDirty = dirtyKeys.has(cellKey);

                        if (!isCellValid) {
                          return (
                            <td key={col.key} className="bg-bg-farm/40 border-r border-border-farm text-center text-[10px] text-text-muted/40 font-bold select-none py-1">
                              —
                            </td>
                          );
                        }

                        const isSel = isCellSelected(r, c);
                        const isAnc = isCellAnchor(r, c);

                        return (
                          <td 
                            key={col.key} 
                            className={`p-0 border-r border-border-farm align-middle relative transition-colors ${
                              isDirty && !isSel ? 'border-l-4 border-l-amber-500 bg-amber-50/40' : ''
                            }`}
                          >
                            <input
                              ref={el => registerRef(r, c, el)}
                              data-row={r}
                              data-col={c}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={val}
                              onFocus={e => e.target.select()}
                              onChange={(e) => handleCellChange(col.penId, col.workerId, col.section, slotNumber, e.target.value)}
                              onMouseDown={e => handleCellMouseDown(e, r, c)}
                              onMouseEnter={() => handleCellMouseEnter(r, c)}
                              onKeyDown={e => handleKeyDown(e, r, c)}
                              style={{ minHeight: '40px', scrollMargin: '120px 0 0 90px' }}
                              className={`w-full text-center py-2 px-1 font-mono text-sm border transition-colors select-none ${
                                isSel
                                  ? 'bg-[#e0f0ff] text-dark-green border-blue-400 font-bold'
                                  : isDirty
                                  ? 'text-dark-green font-bold border-transparent bg-transparent'
                                  : 'border-transparent bg-transparent text-text-primary'
                              } ${
                                isAnc ? 'ring-2 ring-primary ring-offset-1 z-10 bg-yellow-50/90' : ''
                              } focus:bg-amber-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm/40`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* ── Subtotals Row (Bottom of Grid - skipped in navigation) ── */}
                <tr className="bg-green-50/80 border-t-2 border-border-farm font-bold sticky bottom-0 z-10 shadow-[0_-1px_0_0_rgba(0,0,0,0.1)] select-none">
                  <td className="p-3 font-serif font-black text-dark-green text-center sticky left-0 bg-green-50 z-20 border-r border-border-farm">
                    Total
                  </td>
                  {gridColumns.map((col) => {
                    const colTotal = getColumnTotal(col);
                    return (
                      <td key={col.key} className="p-2.5 text-center border-r border-border-farm font-mono text-dark-green font-black">
                        {colTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Selection Status Bar (Part 4) */}
          {selectionStats && selectionStats.count > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-emerald-50 border-t border-emerald-200 text-xs font-mono text-dark-green">
              <div className="flex items-center gap-3">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  Selected: {selectionStats.count} cell{selectionStats.count !== 1 ? 's' : ''}
                </span>
                <span>•</span>
                <span>Sum: <strong className="font-bold">{selectionStats.sum.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Avg: <strong className="font-bold">{selectionStats.avg.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-sans text-text-muted">
                <span>Tip: Press <kbd className="px-1 py-0.5 bg-white border border-border-farm rounded font-mono font-bold">Ctrl+Enter</kbd> to fill selection, <kbd className="px-1 py-0.5 bg-white border border-border-farm rounded font-mono font-bold">Esc</kbd> to clear</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. General Livestock Census Module ── */}
      <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-farm pb-3">
          <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5">
            <span>🐰</span>
            <span>General Livestock Census</span>
          </h3>

          {role !== 'staff' && (
            <button
              onClick={() => setShowAddLivestock(true)}
              className="flex items-center gap-1 bg-white hover:bg-bg-farm border border-border-farm text-primary font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Livestock Record
            </button>
          )}
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          {(() => {
            const allRows = data.general_census || [];
            const nanRows = allRows.filter(r => !r.category || r.category === 'nan' || r.category === 'NaN' || r.category === 'undefined');
            const cleanRows = allRows.filter(r => r.category && r.category !== 'nan' && r.category !== 'NaN' && r.category !== 'undefined');
            return (
              <>
                {nanRows.length > 0 && (
                  <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-xs text-amber-800 font-sans flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <span>
                      <strong>{nanRows.length} corrupted row{nanRows.length !== 1 ? 's' : ''} hidden</strong> — these rows have invalid "nan" category values.
                    </span>
                  </div>
                )}
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                      <th className="p-3">Category</th>
                      <th className="p-3">Type/Breed</th>
                      <th className="p-3 text-center">Male</th>
                      <th className="p-3 text-center">Female</th>
                      <th className="p-3 text-center">Unsexed</th>
                      <th className="p-3 text-center font-bold text-dark-green">Total</th>
                      <th className="p-3">Vendor</th>
                      <th className="p-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-farm/60">
                    {cleanRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-text-muted font-sans text-xs">
                          No general livestock recorded.
                        </td>
                      </tr>
                    ) : (
                      [...cleanRows]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(row => (
                          <tr key={row.id} className="hover:bg-bg-farm/20">
                            <td className="p-3 font-bold text-text-primary">{row.category}</td>
                            <td className="p-3 font-medium text-text-primary">{row.type_breed}</td>
                            <td className="p-3 text-center font-mono">{row.male}</td>
                            <td className="p-3 text-center font-mono">{row.female}</td>
                            <td className="p-3 text-center font-mono">{row.unsexed}</td>
                            <td className="p-3 text-center font-mono font-bold text-primary bg-green-50/30">{row.total}</td>
                            <td className="p-3 text-text-muted">{row.vendor || '—'}</td>
                            <td className="p-3 text-text-muted italic">{row.remarks || '—'}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* G1. Start New Census Count Modal */}
      {showNewCountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[440px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Start New Bird Census Count</span>
              <button
                onClick={() => setShowNewCountModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Census Period Date (Primary Key)
                </label>
                <input
                  type="date"
                  required
                  value={newCountDate}
                  onChange={(e) => setNewCountDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-bold text-dark-green"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Count Performed On (Physical Date)
                </label>
                <input
                  type="date"
                  value={newCountPhysicalDate}
                  onChange={(e) => setNewCountPhysicalDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Period Label (Optional)
                </label>
                <input
                  type="text"
                  value={newCountPeriodLabel}
                  onChange={(e) => setNewCountPeriodLabel(e.target.value)}
                  placeholder="e.g. August 2026 Closing"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowNewCountModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartNewCount}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Open Census Grid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G3. Manage Pens Modal (Admin Only — Immutable pens.name) */}
      {showManagePens && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-3xl w-full overflow-hidden animate-scale-in max-h-[85vh] flex flex-col">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <span>Manage Pens &amp; Display Names</span>
              </div>
              <button
                onClick={() => setShowManagePens(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 text-[11px]">
                💡 <strong>Historical Name Preservation:</strong> Renaming a pen adds a new entry to the historical name registry starting today. Physical labels (e.g. <code>pen_a</code>) remain permanent so past imports never break.
              </div>

              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                    <th className="p-2.5">Physical Key</th>
                    <th className="p-2.5">Current Display Name</th>
                    <th className="p-2.5 text-center">Slots</th>
                    <th className="p-2.5 text-center">Generation</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-farm">
                  {(data.pens || []).map(pen => {
                    const currentDisplayName = resolvePenDisplayName(pen.id, todayStr(), data.pen_name_history || [], pen.name);
                    const isRenaming = renamingPenId === pen.id;

                    return (
                      <tr key={pen.id} className="hover:bg-bg-farm/20">
                        <td className="p-2.5 font-mono font-bold text-text-muted">{pen.name}</td>
                        <td className="p-2.5 font-bold text-dark-green">
                          {isRenaming ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newDisplayNameInput}
                                onChange={(e) => setNewDisplayNameInput(e.target.value)}
                                placeholder="New display name"
                                className="bg-white border border-primary rounded px-2 py-1 text-xs font-bold text-dark-green focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRenamePen(pen.id, newDisplayNameInput)}
                                disabled={savingRename}
                                className="px-2 py-1 bg-primary text-white rounded font-bold text-[10px] hover:bg-dark-green"
                              >
                                {savingRename ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setRenamingPenId(null)}
                                className="px-1.5 py-1 text-text-muted hover:text-text-primary text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span>{currentDisplayName}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono">{pen.slot_count || 15}</td>
                        <td className="p-2.5 text-center font-mono">{pen.generation || '—'}</td>
                        <td className="p-2.5 text-right">
                          {!isRenaming && (
                            <button
                              onClick={() => {
                                setRenamingPenId(pen.id);
                                setNewDisplayNameInput(currentDisplayName);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-bg-farm border border-border-farm rounded-lg text-primary font-bold text-[11px] shadow-xs"
                            >
                              Rename
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-border-farm bg-bg-farm/40 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowManagePens(false);
                  setShowAddPen(true);
                }}
                className="flex items-center gap-1 text-primary font-bold text-xs hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Physical Pen
              </button>
              <button
                onClick={() => setShowManagePens(false)}
                className="px-4 py-2 bg-dark-green text-white font-bold rounded-lg text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Add Pen Modal */}
      {showAddPen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[480px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Add New Cage Pen</span>
              <button
                onClick={() => setShowAddPen(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newPenName || !newPenBlockId) return;
              try {
                const order = (data.pens || []).length + 1;
                await insertRecord('pens', {
                  name: newPenName,
                  pen_block_id: newPenBlockId,
                  slot_count: Number(newPenSlotCount),
                  generation: newPenGeneration || '',
                  display_order: order,
                  is_active: true
                });
                setShowAddPen(false);
                setNewPenName('');
                setNewPenGeneration('');
              } catch (err) {
                console.error('Failed to add pen:', err);
              }
            }} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Pen Name
                </label>
                <input
                  type="text"
                  required
                  value={newPenName}
                  onChange={(e) => setNewPenName(e.target.value)}
                  placeholder="e.g. Pen D"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Pen Block Location
                  </label>
                  <select
                    required
                    value={newPenBlockId}
                    onChange={(e) => setNewPenBlockId(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-semibold text-text-primary"
                  >
                    <option value="">Select block</option>
                    {(data.pen_blocks || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Slot Size (Cage Rows)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newPenSlotCount}
                    onChange={(e) => setNewPenSlotCount(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddPen(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Confirm Addition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add General Livestock Modal */}
      {showAddLivestock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[480px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Add Livestock Count</span>
              <button
                onClick={() => setShowAddLivestock(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!lsBreed) return;
              if (!lsCategory || lsCategory === 'nan' || !lsBreed || lsBreed === 'nan') {
                alert('Please enter valid Category and Type/Breed values before saving.');
                return;
              }
              try {
                await insertRecord('general_census', {
                  category: lsCategory,
                  type_breed: lsBreed,
                  male: Number(lsMale),
                  female: Number(lsFemale),
                  unsexed: Number(lsUnsexed),
                  date: selectedDate,
                  vendor: lsVendor || '',
                  remarks: lsRemarks || ''
                });
                setShowAddLivestock(false);
                setLsBreed('');
                setLsMale(0);
                setLsFemale(0);
                setLsUnsexed(0);
                setLsVendor('');
                setLsRemarks('');
              } catch (err) {
                console.error('Failed to add livestock:', err);
              }
            }} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={lsCategory}
                  onChange={(e) => setLsCategory(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-semibold text-text-primary"
                >
                  <option value="Turkeys">Turkeys</option>
                  <option value="Home Chickens">Home Chickens</option>
                  <option value="Rabbits">Rabbits</option>
                  <option value="Broilers">Broilers</option>
                  <option value="Noilers">Noilers</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Type / Breed Description
                </label>
                <input
                  type="text"
                  required
                  value={lsBreed}
                  onChange={(e) => setLsBreed(e.target.value)}
                  placeholder="e.g. Broody Hen, Zartech Day-old"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Male
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={lsMale}
                    onChange={(e) => setLsMale(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Female
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={lsFemale}
                    onChange={(e) => setLsFemale(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Unsexed
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={lsUnsexed}
                    onChange={(e) => setLsUnsexed(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Vendor
                </label>
                <input
                  type="text"
                  value={lsVendor}
                  onChange={(e) => setLsVendor(e.target.value)}
                  placeholder="e.g. Zartech Hatchery"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  value={lsRemarks}
                  onChange={(e) => setLsRemarks(e.target.value)}
                  placeholder="Notes about health, weights or housing..."
                  rows="2"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddLivestock(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid Keyboard Shortcuts Cheat Sheet Modal */}
      <GridShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
