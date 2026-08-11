import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { Plus, Save, Edit3, Settings, ShieldAlert, Check, Download, Search, Upload } from 'lucide-react';

export default function CensusMatrix() {
  const { data, insertRecord, updateRecord, isOnline, bulkInsertRecords } = useData();
  const { role, worker } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState('2026-08-05'); // Seed starting date
  const [gridData, setGridData] = useState({}); // Stores cell values: { 'penId-side-slot': count }
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const censusImportRef = useRef(null);

  // Modal states for Add Pen
  const [showAddPen, setShowAddPen] = useState(false);
  const [newPenName, setNewPenName] = useState('');
  const [newPenBlockId, setNewPenBlockId] = useState('');
  const [newPenWorkerId, setNewPenWorkerId] = useState('');
  const [newPenHasSides, setNewPenHasSides] = useState(false);
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

  // Filter columns based on user assignment
  const getVisiblePens = () => {
    const allPens = [...(data.pens || [])].sort((a, b) => a.display_order - b.display_order);
    if (role === 'staff') {
      // Staff only sees their assigned pens
      return allPens.filter(pen => pen.worker_id === worker?.id);
    }
    return allPens;
  };

  const visiblePens = getVisiblePens();

  // Worker name map for search
  const workerMap = Object.fromEntries((data.workers || []).map(w => [w.id, w.name]));

  // Group visible pens by pen block, filtered by search term
  const getGroupedPens = () => {
    const blocks = data.pen_blocks || [];
    const lc = searchTerm.toLowerCase();
    const grouped = [];

    blocks.forEach(block => {
      const pensInBlock = visiblePens.filter(p => {
        if (!lc) return p.pen_block_id === block.id;
        const workerName = (workerMap[p.worker_id] || '').toLowerCase();
        const penName = (p.name || '').toLowerCase();
        const blockName = (block.name || '').toLowerCase();
        return p.pen_block_id === block.id &&
          (penName.includes(lc) || workerName.includes(lc) || blockName.includes(lc));
      });
      if (pensInBlock.length > 0) {
        grouped.push({ blockId: block.id, blockName: block.name, pens: pensInBlock });
      }
    });

    return grouped;
  };

  const groupedPens = getGroupedPens();

  // Flattened columns for cells: array of { pen, side, key }
  const gridColumns = [];
  groupedPens.forEach(g => {
    g.pens.forEach(pen => {
      if (pen.has_sides) {
        gridColumns.push({ pen, side: 'left', key: `${pen.id}-left` });
        gridColumns.push({ pen, side: 'right', key: `${pen.id}-right` });
      } else {
        gridColumns.push({ pen, side: 'single', key: `${pen.id}-single` });
      }
    });
  });

  const maxSlots = visiblePens.length > 0 ? Math.max(...visiblePens.map(p => p.slot_count || 15)) : 15;

  // Initialize local grid cells state when selectedDate or census changes
  useEffect(() => {
    const counts = data.census_counts || [];
    const newGrid = {};
    
    counts.forEach(c => {
      if (c.date === selectedDate) {
        const key = `${c.pen_id}-${c.side}-${c.slot_number}`;
        newGrid[key] = c.bird_count;
      }
    });

    // Populate missing items as default
    gridColumns.forEach(col => {
      for (let slot = 1; slot <= col.pen.slot_count; slot++) {
        const key = `${col.pen.id}-${col.side}-${slot}`;
        if (newGrid[key] === undefined) {
          // If no count, search for previous values or default to seed defaults (let's default to 0 if not found)
          newGrid[key] = '';
        }
      }
    });

    setGridData(newGrid);
  }, [selectedDate, data.census_counts, data.pens]);

  const handleCellChange = (penId, side, slot, val) => {
    const key = `${penId}-${side}-${slot}`;
    // Accept only integers
    const num = val === '' ? '' : parseInt(val, 10);
    if (isNaN(num) && val !== '') return;
    
    setGridData(prev => ({
      ...prev,
      [key]: num
    }));
  };

  // Calculates pen subtotal (sum of all slots)
  const getPenTotal = (penId, side) => {
    let total = 0;
    const pen = visiblePens.find(p => p.id === penId);
    if (!pen) return 0;

    for (let slot = 1; slot <= pen.slot_count; slot++) {
      const key = `${penId}-${side}-${slot}`;
      total += Number(gridData[key]) || 0;
    }
    return total;
  };

  const handleSaveGrid = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const existingCounts = data.census_counts || [];
      
      // Save all modified / filled cells
      for (const col of gridColumns) {
        for (let slot = 1; slot <= col.pen.slot_count; slot++) {
          const key = `${col.pen.id}-${col.side}-${slot}`;
          const currentCount = Number(gridData[key]) || 0;

          // Check if there is already a record in cache
          const existing = existingCounts.find(c => 
            c.pen_id === col.pen.id && 
            c.side === col.side && 
            c.slot_number === slot && 
            c.date === selectedDate
          );

          if (existing) {
            // Update if value changed
            if (existing.bird_count !== currentCount) {
              await updateRecord('census_counts', {
                id: existing.id,
                bird_count: currentCount,
                updated_at: new Date().toISOString()
              });
            }
          } else {
            // Insert new record
            await insertRecord('census_counts', {
              pen_id: col.pen.id,
              side: col.side,
              slot_number: slot,
              bird_count: currentCount,
              date: selectedDate
            });
          }
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save census matrix:', err);
    } finally {
      setSaving(false);
    }
  };

  // Add new pen (Admin action)
  const handleAddPenSubmit = async (e) => {
    e.preventDefault();
    if (!newPenName || !newPenBlockId) return;

    try {
      const order = (data.pens || []).length + 1;
      await insertRecord('pens', {
        name: newPenName,
        pen_block_id: newPenBlockId,
        worker_id: newPenWorkerId || null,
        has_sides: newPenHasSides,
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
  };

  // Add general livestock (Admin/Manager action)
  const handleAddLivestockSubmit = async (e) => {
    e.preventDefault();
    if (!lsBreed) return;

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
  };

  return (
    <div className="p-6 space-y-6">
      {/* Action Header bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">Laying Poultry Census</h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Daily cage slot ledger rows
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Formatted DatePicker */}
          <DatePicker
            label="Census Date"
            value={selectedDate}
            onChange={setSelectedDate}
          />

          {/* Export Action Button */}
          <button
            type="button"
            onClick={() => exportToExcel(`fazky_bird_census_${selectedDate}`, 'Census', data.census_counts || [])}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Export Bird Census to Excel"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Import Census Button */}
          <input
            type="file"
            ref={censusImportRef}
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const rows = await parseImportFile(file);
                const result = await bulkInsertRecords('census_counts', rows);
                alert(`✅ Imported ${result?.count ?? rows.length} census records successfully.`);
              } catch (err) {
                alert('❌ Import failed: ' + err.message);
              } finally {
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => censusImportRef.current?.click()}
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Import Census Data from CSV/Excel"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Add Pen (Admin only) */}

          {role === 'admin' && (
            <button
              onClick={() => setShowAddPen(true)}
              className="flex items-center gap-1 bg-white hover:bg-bg-farm border border-border-farm text-primary font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Pen
            </button>
          )}

          {/* Save All */}
          <button
            onClick={handleSaveGrid}
            disabled={saving}
            className={`flex items-center gap-1.5 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-md transition-all ${
              saveSuccess 
                ? 'bg-primary' 
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
                {saving ? 'Saving...' : 'Save Census Grid'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Smart Search / Filter Bar */}
      <div className="flex items-center gap-3 bg-white border border-border-farm rounded-xl px-4 py-2.5 shadow-sm">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter by pen name, worker, or block…"
          className="flex-1 bg-transparent text-sm font-sans focus:outline-none text-text-primary placeholder:text-text-muted"
        />
        {searchTerm && (
          <span className="text-[10px] font-bold text-primary bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {groupedPens.reduce((n, g) => n + g.pens.length, 0)} column{groupedPens.reduce((n, g) => n + g.pens.length, 0) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Main Census Matrix Container */}
      {visiblePens.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm">
          <ShieldAlert className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h4 className="font-serif text-lg text-dark-green font-bold">No assigned pens found</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Staff can only see their assigned pens. Ask the Admin to assign pens to your profile.
          </p>
        </div>
      ) : groupedPens.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm">
          <Search className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h4 className="font-serif text-lg text-dark-green font-bold">No matching pens</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">
            No pens match "<strong>{searchTerm}</strong>". Try a different search term.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Scrollable grid wrapper */}
          <div className="overflow-auto max-h-[500px] scrollbar-thin">
            <table className="w-full border-collapse border-spacing-0 text-left">
              <thead>
                {/* Block headers - Row 1 */}
                <tr className="bg-dark-green text-white text-xs font-serif sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                  <th className="p-3 border-r border-white/10 w-20 sticky left-0 bg-dark-green z-20">Slot</th>
                  {groupedPens.map((g, idx) => {
                    // Calculate colspan for this block
                    const colSpan = g.pens.reduce((sum, pen) => sum + (pen.has_sides ? 2 : 1), 0);
                    return (
                      <th
                        key={g.blockId}
                        colSpan={colSpan}
                        className={`p-3 text-center border-r border-white/10 uppercase tracking-widest font-black ${
                          idx % 2 === 0 ? 'bg-dark-green' : 'bg-[#1e421a]'
                        }`}
                      >
                        {g.blockName}
                      </th>
                    );
                  })}
                </tr>

                {/* Pen headers - Row 2 */}
                <tr className="bg-primary text-white text-[11px] font-sans sticky top-[39px] z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.15)]">
                  <th className="p-3 border-r border-white/10 sticky left-0 bg-primary z-20">No.</th>
                  {groupedPens.map(g => 
                    g.pens.map(pen => (
                      <th
                        key={pen.id}
                        colSpan={pen.has_sides ? 2 : 1}
                        className="p-2.5 text-center border-r border-white/10 font-bold tracking-tight truncate max-w-[120px]"
                        title={`${pen.name} (${pen.generation || 'No Batch'})`}
                      >
                        <div>{pen.name}</div>
                        {pen.generation && (
                          <div className="text-[9px] text-accent/90 font-medium font-sans lowercase mt-0.5">
                            {pen.generation}
                          </div>
                        )}
                      </th>
                    ))
                  )}
                </tr>

                {/* Sub-column designations - Row 3 */}
                <tr className="bg-light-green text-dark-green text-[10px] font-bold uppercase tracking-wider sticky top-[79px] z-10 border-b border-border-farm">
                  <th className="p-2 border-r border-border-farm sticky left-0 bg-light-green z-20">Index</th>
                  {gridColumns.map(col => (
                    <th key={col.key} className="p-2 text-center border-r border-border-farm font-mono">
                      {col.side === 'single' ? 'Single' : col.side}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Matrix cells */}
              <tbody className="divide-y divide-border-farm text-sm">
                {/* Generates rows up to maxSlots */}
                {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slotNumber) => (
                  <tr key={slotNumber} className="hover:bg-bg-farm/40 transition-colors">
                    {/* Sticky row label */}
                    <td className="p-2 font-mono font-bold text-center border-r border-border-farm sticky left-0 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-20 z-10">
                      {slotNumber}
                    </td>

                    {/* Column inputs */}
                    {gridColumns.map((col) => {
                      const isCellValid = slotNumber <= col.pen.slot_count;
                      const cellKey = `${col.pen.id}-${col.side}-${slotNumber}`;
                      const val = gridData[cellKey] ?? '';

                      if (!isCellValid) {
                        return (
                          <td key={col.key} className="bg-bg-farm/50 border-r border-border-farm text-center text-[10px] text-text-muted/40 font-bold select-none py-1">
                            N/A
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="p-0 border-r border-border-farm align-middle">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={val}
                            onFocus={e => e.target.select()}
                            onChange={(e) => handleCellChange(col.pen.id, col.side, slotNumber, e.target.value)}
                            style={{ minHeight: '44px' }}
                            className="w-full text-center py-2.5 px-1 font-mono text-sm border-0 bg-transparent text-text-primary focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Subtotals Row */}
                <tr className="bg-green-50/70 border-t-2 border-border-farm font-bold">
                  <td className="p-3 font-serif font-black text-dark-green text-center sticky left-0 bg-green-50 z-10 border-r border-border-farm">
                    Total
                  </td>
                  {gridColumns.map((col) => {
                    const penTotal = getPenTotal(col.pen.id, col.side);
                    return (
                      <td key={col.key} className="p-3 text-center border-r border-border-farm font-mono text-dark-green font-black">
                        {penTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. General Livestock Census Module */}
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
              {(data.general_census || []).length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-text-muted font-sans text-xs">
                    No general livestock recorded.
                  </td>
                </tr>
              ) : (
                [...(data.general_census || [])]
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
        </div>
      </div>

      {/* MODALS */}
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
            <form onSubmit={handleAddPenSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Pen Name
                </label>
                <input
                  type="text"
                  required
                  value={newPenName}
                  onChange={(e) => setNewPenName(e.target.value)}
                  placeholder="e.g. Muslimat Pen 2"
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
                    Assign Worker Staff
                  </label>
                  <select
                    value={newPenWorkerId}
                    onChange={(e) => setNewPenWorkerId(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-semibold text-text-primary"
                  >
                    <option value="">Unassigned</option>
                    {(data.workers || []).filter(w => w.role === 'staff').map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Bird Generation/Batch
                  </label>
                  <input
                    type="text"
                    value={newPenGeneration}
                    onChange={(e) => setNewPenGeneration(e.target.value)}
                    placeholder="e.g. Batch 2026A"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="hasSides"
                  checked={newPenHasSides}
                  onChange={(e) => setNewPenHasSides(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="hasSides" className="text-text-primary font-bold select-none cursor-pointer">
                  Divided into Left & Right sides
                </label>
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
            <form onSubmit={handleAddLivestockSubmit} className="p-6 space-y-4 font-sans text-xs">
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
    </div>
  );
}
