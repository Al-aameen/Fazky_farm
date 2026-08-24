import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { Save, Check, ShieldAlert, Download, Search, Upload } from 'lucide-react';

export default function ProductionLog() {
  const { data, insertRecord, updateRecord, bulkInsertRecords, ensureDateLoaded } = useData();
  const { role, worker } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState('2026-08-05'); // Default seed date
  const [productionData, setProductionData] = useState({}); // { penId: { morning_eggs, evening_eggs, morning_feed, evening_feed, mortality } }
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const importRef = useRef(null);

  // Auto-fetch historical month data on date selection if not cached
  useEffect(() => {
    if (selectedDate && ensureDateLoaded) {
      ensureDateLoaded('production_log', selectedDate);
    }
  }, [selectedDate, ensureDateLoaded]);

  // Filter pens by role
  const getVisiblePens = () => {
    const allPens = [...(data.pens || [])].sort((a, b) => a.display_order - b.display_order);
    if (role === 'staff') {
      return allPens.filter(pen => pen.worker_id === worker?.id);
    }
    return allPens;
  };

  const visiblePens = getVisiblePens();

  // Workers reference for search by worker name
  const workerMap = Object.fromEntries((data.workers || []).map(w => [w.id, w.name]));

  // Group visible pens by block, filtered by search
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

  // Initialize production data for the selected date
  useEffect(() => {
    const logs = data.production_log || [];
    const newProd = {};

    // 1. Pre-fill from existing records for this date
    logs.forEach(log => {
      if (log.date === selectedDate) {
        newProd[log.pen_id] = {
          id: log.id,
          morning_eggs: log.morning_eggs,
          evening_eggs: log.evening_eggs,
          morning_feed: log.morning_feed,
          evening_feed: log.evening_feed,
          mortality: log.mortality
        };
      }
    });

    // 2. Pre-fill empty slots
    visiblePens.forEach(pen => {
      if (!newProd[pen.id]) {
        newProd[pen.id] = {
          morning_eggs: '',
          evening_eggs: '',
          morning_feed: '',
          evening_feed: '',
          mortality: ''
        };
      }
    });

    setProductionData(newProd);
  }, [selectedDate, data.production_log, data.pens]);

  const handleCellChange = (penId, field, value) => {
    // Only accept numeric inputs (integers for counts, decimals for feeds)
    const isDecimal = field.includes('feed');
    let parsed = value;
    
    if (value !== '') {
      parsed = isDecimal ? parseFloat(value) : parseInt(value, 10);
      if (isNaN(parsed)) return;
    }

    setProductionData(prev => ({
      ...prev,
      [penId]: {
        ...prev[penId],
        [field]: parsed
      }
    }));
  };

  // Subtotal calculations for a pen block
  const getBlockSubtotals = (blockPens) => {
    const totals = {
      morning_eggs: 0,
      evening_eggs: 0,
      total_eggs: 0,
      morning_feed: 0,
      evening_feed: 0,
      total_feed: 0,
      mortality: 0
    };

    blockPens.forEach(pen => {
      const p = productionData[pen.id] || {};
      const mEggs = Number(p.morning_eggs) || 0;
      const eEggs = Number(p.evening_eggs) || 0;
      const mFeed = Number(p.morning_feed) || 0;
      const eFeed = Number(p.evening_feed) || 0;
      const mort = Number(p.mortality) || 0;

      totals.morning_eggs += mEggs;
      totals.evening_eggs += eEggs;
      totals.total_eggs += (mEggs + eEggs);
      totals.morning_feed += mFeed;
      totals.evening_feed += eFeed;
      totals.total_feed += (mFeed + eFeed);
      totals.mortality += mort;
    });

    return totals;
  };

  // Grand totals calculation
  const getGrandTotals = () => {
    return getBlockSubtotals(visiblePens);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const logs = data.production_log || [];
      const dayOfWeekStr = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

      for (const pen of visiblePens) {
        const item = productionData[pen.id] || {};
        
        // Clean values to numeric or 0
        const morning_eggs = Number(item.morning_eggs) || 0;
        const evening_eggs = Number(item.evening_eggs) || 0;
        const morning_feed = Number(item.morning_feed) || 0;
        const evening_feed = Number(item.evening_feed) || 0;
        const mortality = Number(item.mortality) || 0;

        const payload = {
          pen_id: pen.id,
          date: selectedDate,
          day_of_week: dayOfWeekStr,
          morning_eggs,
          evening_eggs,
          morning_feed,
          evening_feed,
          mortality
        };

        if (item.id) {
          // Update existing log
          await updateRecord('production_log', {
            id: item.id,
            ...payload
          });
        } else {
          // Insert new log
          await insertRecord('production_log', payload);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save production records:', err);
    } finally {
      setSaving(false);
    }
  };

  const grandTotals = getGrandTotals();

  return (
    <div className="p-6 space-y-6">
      {/* Top action header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">Daily Production Log</h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Egg counts and feed weight records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Formatted DatePicker with Day Navigation */}
          <DatePicker 
            label="Record Date"
            value={selectedDate}
            onChange={setSelectedDate}
          />

          {/* Import CSV/Excel Button */}
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
                alert(`✅ Imported ${result?.count ?? rows.length} production records successfully.`);
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
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Import from CSV or Excel (.xlsx) — columns: date, pen_name, morning_eggs, evening_eggs, morning_feed, evening_feed, mortality"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Export Action Button */}
          <button
            type="button"
            onClick={() => exportToExcel(`fazky_production_log_${selectedDate}`, 'Production', data.production_log || [])}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-1.5 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
            title="Export as Excel (.xlsx) or CSV"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Save All Button */}
          <button
            onClick={handleSaveAll}
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
                Saved Records!
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
            {groupedPens.reduce((n, g) => n + g.pens.length, 0)} result{groupedPens.reduce((n, g) => n + g.pens.length, 0) !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {visiblePens.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm">
          <ShieldAlert className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h4 className="font-serif text-lg text-dark-green font-bold">No assigned pens found</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Staff can only see their own assigned pens. Ask the Admin to assign pens to your profile.
          </p>
        </div>
      ) : groupedPens.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm">
          <Search className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h4 className="font-serif text-lg text-dark-green font-bold">No matching pens</h4>
          <p className="text-xs text-text-muted mt-1 font-sans">
            No pens match "<strong>{searchTerm}</strong>". Try searching by worker name or pen block.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-dark-green text-white font-serif text-[11px] shadow-[0_1px_0_0_rgba(0,0,0,0.15)] uppercase tracking-wide">
                  <th className="p-3 border-r border-white/10 sticky left-0 bg-dark-green w-40 z-10">Pen Name</th>
                  <th className="p-3 border-r border-white/10 text-center">Morning Eggs</th>
                  <th className="p-3 border-r border-white/10 text-center">Evening Eggs</th>
                  <th className="p-3 border-r border-white/10 text-center font-bold bg-[#1e421a]/70">Total Eggs</th>
                  <th className="p-3 border-r border-white/10 text-center">Morn Feed (kg)</th>
                  <th className="p-3 border-r border-white/10 text-center">Eve Feed (kg)</th>
                  <th className="p-3 border-r border-white/10 text-center font-bold bg-[#1e421a]/70">Total Feed (kg)</th>
                  <th className="p-3 text-center">Mortality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm">
                {groupedPens.map(group => {
                  const sub = getBlockSubtotals(group.pens);

                  return (
                    <React.Fragment key={group.blockId}>
                      {/* Section Header */}
                      <tr className="bg-light-green text-dark-green font-serif font-bold text-xs border-y border-border-farm">
                        <td colSpan="8" className="p-2.5 pl-4 uppercase tracking-wider">
                          {group.blockName}
                        </td>
                      </tr>

                      {/* Pen Rows */}
                      {group.pens.map(pen => {
                        const row = productionData[pen.id] || {};
                        const mEggs = Number(row.morning_eggs) || 0;
                        const eEggs = Number(row.evening_eggs) || 0;
                        const mFeed = Number(row.morning_feed) || 0;
                        const eFeed = Number(row.evening_feed) || 0;

                        const isMortalityPositive = (Number(row.mortality) || 0) > 0;

                        return (
                          <tr key={pen.id} className="hover:bg-bg-farm/30 transition-colors">
                            {/* Sticky Left Column */}
                            <td className="p-3 border-r border-border-farm sticky left-0 bg-white font-bold text-text-primary shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-40">
                              {pen.name}
                            </td>

                            {/* Morning Eggs — onFocus auto-selects for dirty-hand tap-and-type */}
                            <td className="p-0 border-r border-border-farm">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={row.morning_eggs ?? ''}
                                onFocus={e => e.target.select()}
                                onChange={e => handleCellChange(pen.id, 'morning_eggs', e.target.value)}
                                style={{ minHeight: '44px' }}
                                className="w-full text-center py-3.5 font-mono border border-border-farm/40 bg-bg-farm/60 text-text-primary placeholder:text-text-muted/40 focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm transition-colors rounded-sm"
                                placeholder="0"
                              />
                            </td>

                            {/* Evening Eggs */}
                            <td className="p-0 border-r border-border-farm">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={row.evening_eggs ?? ''}
                                onFocus={e => e.target.select()}
                                onChange={e => handleCellChange(pen.id, 'evening_eggs', e.target.value)}
                                style={{ minHeight: '44px' }}
                                className="w-full text-center py-3.5 font-mono border border-border-farm/40 bg-bg-farm/60 text-text-primary placeholder:text-text-muted/40 focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm transition-colors rounded-sm"
                                placeholder="0"
                              />
                            </td>

                            {/* Total Eggs (auto) */}
                            <td className="p-3 border-r border-border-farm text-center font-mono font-bold bg-green-50/20 text-dark-green text-sm select-none">
                              {(mEggs + eEggs).toLocaleString()}
                            </td>

                            {/* Morn Feed */}
                            <td className="p-0 border-r border-border-farm">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.morning_feed ?? ''}
                                onFocus={e => e.target.select()}
                                onChange={e => handleCellChange(pen.id, 'morning_feed', e.target.value)}
                                style={{ minHeight: '44px' }}
                                className="w-full text-center py-3.5 font-mono border border-border-farm/40 bg-bg-farm/60 text-text-primary placeholder:text-text-muted/40 focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm transition-colors rounded-sm"
                                placeholder="0"
                              />
                            </td>

                            {/* Eve Feed */}
                            <td className="p-0 border-r border-border-farm">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.evening_feed ?? ''}
                                onFocus={e => e.target.select()}
                                onChange={e => handleCellChange(pen.id, 'evening_feed', e.target.value)}
                                style={{ minHeight: '44px' }}
                                className="w-full text-center py-3.5 font-mono border border-border-farm/40 bg-bg-farm/60 text-text-primary placeholder:text-text-muted/40 focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm transition-colors rounded-sm"
                                placeholder="0"
                              />
                            </td>

                            {/* Total Feed (auto) */}
                            <td className="p-3 border-r border-border-farm text-center font-mono font-bold bg-green-50/20 text-dark-green text-sm select-none">
                              {(mFeed + eFeed).toLocaleString()}
                            </td>

                            {/* Mortality */}
                            <td className={`p-0 align-middle transition-colors ${isMortalityPositive ? 'bg-red-50' : ''}`}>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={row.mortality ?? ''}
                                onFocus={e => e.target.select()}
                                placeholder="0"
                                onChange={e => handleCellChange(pen.id, 'mortality', e.target.value)}
                                style={{ minHeight: '44px' }}
                                className={`w-full text-center py-3.5 font-mono font-bold border border-border-farm/40 bg-bg-farm/60 placeholder:text-text-muted/40 focus:bg-yellow-50 focus:ring-1 focus:ring-primary focus:outline-none hover:bg-bg-farm transition-colors rounded-sm ${
                                  isMortalityPositive ? 'text-red-accent bg-red-50/60' : 'text-text-primary'
                                }`}
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {/* Pen Block Subtotal row */}
                      <tr className="bg-green-50/30 border-b border-border-farm font-bold text-text-primary italic">
                        <td className="p-2.5 sticky left-0 bg-green-50/50 border-r border-border-farm pl-4">
                          {group.blockName} Subtotal
                        </td>
                        <td className="p-2 text-center font-mono">{sub.morning_eggs.toLocaleString()}</td>
                        <td className="p-2 text-center font-mono">{sub.evening_eggs.toLocaleString()}</td>
                        <td className="p-2 text-center font-mono font-bold text-dark-green bg-green-50/40 text-sm">
                          {sub.total_eggs.toLocaleString()}
                        </td>
                        <td className="p-2 text-center font-mono">{sub.morning_feed.toLocaleString()}</td>
                        <td className="p-2 text-center font-mono">{sub.evening_feed.toLocaleString()}</td>
                        <td className="p-2 text-center font-mono font-bold text-dark-green bg-green-50/40 text-sm">
                          {sub.total_feed.toLocaleString()}
                        </td>
                        <td className={`p-2 text-center font-mono ${sub.mortality > 0 ? 'text-red-accent' : ''}`}>
                          {sub.mortality.toLocaleString()}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Farm Grand Total */}
                <tr className="bg-green-100/50 border-t-2 border-border-farm text-sm font-serif font-black text-dark-green">
                  <td className="p-3 sticky left-0 bg-green-100/70 border-r border-border-farm pl-4">
                    Grand Total
                  </td>
                  <td className="p-3 text-center font-mono">{grandTotals.morning_eggs.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono">{grandTotals.evening_eggs.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono font-black text-primary bg-green-150/20 text-base">
                    {grandTotals.total_eggs.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono">{grandTotals.morning_feed.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono">{grandTotals.evening_feed.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono font-black text-primary bg-green-150/20 text-base">
                    {grandTotals.total_feed.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono text-red-accent">{grandTotals.mortality.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Production History */}
      <div className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden">
        <details>
          <summary className="p-4 cursor-pointer font-serif text-dark-green font-bold text-base flex items-center gap-2 select-none hover:bg-bg-farm transition-colors">
            📋 Recent Production History (last 14 days)
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Total Eggs</th>
                  <th className="p-3 text-center">Total Feed (kg)</th>
                  <th className="p-3 text-center">Mortality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {(() => {
                  const recentDates = [...new Set(
                    (data.production_log || [])
                      .map(p => p.date)
                      .sort((a, b) => new Date(b) - new Date(a))
                  )].slice(0, 14);

                  if (recentDates.length === 0) {
                    return (
                      <tr>
                        <td colSpan="4" className="p-6 text-center text-text-muted italic">
                          No production history yet. Start entering daily records above.
                        </td>
                      </tr>
                    );
                  }

                  return recentDates.map(date => {
                    const dayLogs = (data.production_log || []).filter(p => p.date === date);
                    const totalEggs = dayLogs.reduce((s, p) => s + (p.morning_eggs || 0) + (p.evening_eggs || 0), 0);
                    const totalFeed = dayLogs.reduce((s, p) => s + (Number(p.morning_feed) || 0) + (Number(p.evening_feed) || 0), 0);
                    const totalMort = dayLogs.reduce((s, p) => s + (p.mortality || 0), 0);
                    const isSelected = date === selectedDate;

                    return (
                      <tr
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`cursor-pointer hover:bg-light-green transition-colors ${isSelected ? 'bg-light-green font-bold' : ''}`}
                      >
                        <td className="p-3 font-mono font-bold text-text-primary">
                          {date}
                          {isSelected && <span className="ml-2 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded">Viewing</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-dark-green font-bold">{totalEggs.toLocaleString()}</td>
                        <td className="p-3 text-center font-mono">{totalFeed.toFixed(1)}</td>
                        <td className={`p-3 text-center font-mono ${totalMort > 0 ? 'text-red-accent font-bold' : 'text-text-muted'}`}>
                          {totalMort}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}

