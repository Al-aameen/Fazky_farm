import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  CircleDollarSign, 
  Database,
  UserCheck,
  Zap,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { exportToCSV, exportToExcel, parseImportFile, downloadCSVTemplate } from '../lib/csvExportImport';

export default function Settings() {
  const { data, insertRecord, updateRecord, bulkInsertRecords, flushQueue, forceFullSync, queuedCount, isSyncing, isOnline } = useData();
  const { user, role, worker, isSimulationMode } = useAuth();

  // Egg Price State
  const currentEggPriceObj = (data.egg_price_settings || []).sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0] || { price_per_crate: 4400, effective_date: '2026-01-01' };
  
  const [eggPrice, setEggPrice] = useState(currentEggPriceObj.price_per_crate || 4400);
  const [effectiveDate, setEffectiveDate] = useState(currentEggPriceObj.effective_date || new Date().toISOString().split('T')[0]);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceSuccess, setPriceSuccess] = useState(false);

  // Import State
  const [selectedTargetTable, setSelectedTargetTable] = useState('sales_log');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // Handle Save Egg Price
  const handleSaveEggPrice = async (e) => {
    e.preventDefault();
    setSavingPrice(true);
    setPriceSuccess(false);

    try {
      const payload = {
        price_per_crate: parseFloat(eggPrice) || 0,
        effective_date: effectiveDate,
        set_by: worker?.id || 'admin'
      };

      await insertRecord('egg_price_settings', payload);
      setPriceSuccess(true);
      setTimeout(() => setPriceSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving egg price:', err);
    } finally {
      setSavingPrice(false);
    }
  };

  // Handle Export File
  const handleExportData = (format) => {
    const tableData = data[selectedTargetTable] || [];
    if (tableData.length === 0) {
      alert(`No records found in ${selectedTargetTable} to export.`);
      return;
    }

    const filename = `fazky_${selectedTargetTable}_${new Date().toISOString().split('T')[0]}`;
    if (format === 'csv') {
      exportToCSV(filename, tableData);
    } else {
      exportToExcel(filename, selectedTargetTable, tableData);
    }
  };

  // Handle File Upload & Import
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);

    try {
      const parsedRows = await parseImportFile(file);
      if (!parsedRows || parsedRows.length === 0) {
        setImportStatus({ type: 'error', message: 'The uploaded file is empty or invalid.' });
        setImporting(false);
        return;
      }

      const res = await bulkInsertRecords(selectedTargetTable, parsedRows);
      if (res.success) {
        setImportStatus({ 
          type: 'success', 
          message: `Successfully imported ${res.count} records into ${selectedTargetTable}!` 
        });
      } else {
        setImportStatus({ type: 'error', message: res.error || 'Import failed.' });
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: err.message });
    } finally {
      setImporting(false);
      e.target.value = null; // reset file input
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-dark-green rounded-xl shadow-sm">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">System Settings & Data Hub</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">Manage pricing, sync performance, and CSV/Excel imports & exports</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            isSimulationMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-dark-green'
          }`}>
            {isSimulationMode ? 'Simulation Mode' : 'Supabase Live Connection'}
          </span>
        </div>
      </div>

      {/* Grid Section 1: Egg Pricing & Performance Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Egg Pricing Card */}
        <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg border-b border-border-farm pb-3">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            <span>Egg Price Settings</span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Set the current selling price per crate of eggs. This rate is used across Sales Log computations and revenue statistics.
          </p>

          <form onSubmit={handleSaveEggPrice} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Price Per Crate (₦)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={eggPrice}
                onChange={(e) => setEggPrice(e.target.value)}
                className="w-full bg-bg-farm border border-border-farm rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-accent focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full bg-bg-farm border border-border-farm rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-accent focus:outline-none"
                required
              />
            </div>

            {priceSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-dark-green rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Egg price updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingPrice}
              className="w-full bg-dark-green text-white font-bold py-2.5 rounded-xl text-sm hover:bg-emerald-900 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {savingPrice ? 'Updating...' : 'Save Egg Price Setting'}
            </button>
          </form>
        </div>

        {/* Sync & Speed Controller */}
        <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg border-b border-border-farm pb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Database Sync & Performance</span>
            </div>

            <p className="text-xs text-text-muted leading-relaxed mt-3">
              Data fetches now run in high-speed parallel mode (`Promise.all`). Force an instant cloud sync or inspect offline queued operations below.
            </p>

            <div className="mt-4 p-4 bg-bg-farm rounded-xl border border-border-farm space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Network Status:</span>
                <span className={isOnline ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                  {isOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Queued Offline Changes:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-border-farm font-bold text-dark-green">
                  {queuedCount} records
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Sync Architecture:</span>
                <span className="text-primary font-bold">Delta Sync (Incremental)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
          <button
            onClick={flushQueue}
            disabled={isSyncing || !isOnline}
            className={`w-full font-bold py-2.5 rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 transition-all ${
              isSyncing ? 'bg-amber-100 text-amber-800' : 'bg-primary text-white hover:bg-emerald-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Records...' : 'Trigger Fast Parallel Sync'}</span>
          </button>

          <button
            onClick={async () => {
              if (window.confirm('Force a full re-download from Supabase? This clears all delta sync timestamps and re-pulls all data. Use only if your local data seems out of sync.')) {
                await forceFullSync();
                alert('✅ Full sync complete — all tables refreshed.');
              }
            }}
            disabled={isSyncing || !isOnline}
            className="w-full font-bold py-2.5 rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 transition-all bg-white border border-border-farm text-dark-green hover:bg-red-50 hover:border-red-300 hover:text-red-700 disabled:opacity-40"
          >
            <Database className="w-4 h-4" />
            <span>Force Full Sync (Reset Delta)</span>
          </button>
          </div>
        </div>
      </div>

      {/* Grid Section 2: CSV & Excel Data Import/Export Center */}
      <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border-farm pb-3">
          <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <span>CSV & Excel Data Hub</span>
          </div>
          <span className="text-xs text-text-muted font-sans font-semibold">Support for .csv & .xlsx format</span>
        </div>

        <p className="text-xs text-text-muted">
          Select a database module below to export current data or bulk-import new entries directly from a CSV or Excel spreadsheet.
        </p>

        {/* Target Module Selector */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
            Select Data Module
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { id: 'sales_log', label: 'Sales Log' },
              { id: 'production_log', label: 'Production Log' },
              { id: 'expenses_log', label: 'Expenses' },
              { id: 'census_counts', label: 'Bird Census' },
              { id: 'workers', label: 'Workers' },
              { id: 'maize_records', label: 'Maize Record' }
            ].map((mod) => (
              <button
                key={mod.id}
                onClick={() => {
                  setSelectedTargetTable(mod.id);
                  setImportStatus(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  selectedTargetTable === mod.id
                    ? 'bg-dark-green text-white border-dark-green shadow-sm'
                    : 'bg-bg-farm text-text-primary border-border-farm hover:bg-emerald-50'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Panel: Export, Template & Import */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Export Data Box */}
          <div className="p-4 bg-bg-farm rounded-xl border border-border-farm space-y-3">
            <div className="font-serif font-bold text-sm text-dark-green flex items-center gap-1.5">
              <Download className="w-4 h-4 text-primary" />
              <span>Export {selectedTargetTable}</span>
            </div>
            <p className="text-[11px] text-text-muted">Download all active records formatted for Excel or reporting.</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExportData('csv')}
                className="flex-1 bg-white hover:bg-emerald-50 text-dark-green font-bold py-1.5 px-3 rounded-lg border border-border-farm text-xs transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExportData('excel')}
                className="flex-1 bg-dark-green hover:bg-emerald-900 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Download Sample Template Box */}
          <div className="p-4 bg-bg-farm rounded-xl border border-border-farm space-y-3">
            <div className="font-serif font-bold text-sm text-dark-green flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Sample Template</span>
            </div>
            <p className="text-[11px] text-text-muted">Download a formatted sample template with correct column names for importing.</p>
            <button
              onClick={() => {
                const map = { sales_log: 'sales', expenses_log: 'expenses', production_log: 'production', workers: 'workers', maize_records: 'maize' };
                downloadCSVTemplate(map[selectedTargetTable] || 'sales');
              }}
              className="w-full bg-white hover:bg-emerald-50 text-dark-green font-bold py-1.5 px-3 rounded-lg border border-border-farm text-xs transition-colors shadow-sm flex items-center justify-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Bulk Import Upload Box */}
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3">
            <div className="font-serif font-bold text-sm text-dark-green flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-primary" />
              <span>Import File</span>
            </div>
            <p className="text-[11px] text-text-muted">Upload a `.csv` or `.xlsx` spreadsheet file to bulk-insert records.</p>

            <label className="w-full bg-primary hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{importing ? 'Processing File...' : 'Choose File to Import'}</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Import Status Alert */}
        {importStatus && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-dark-green'
              : 'bg-red-50 border-red-200 text-red-accent'
          }`}>
            {importStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{importStatus.message}</span>
          </div>
        )}
      </div>

      {/* Grid Section 3: User Profile & Role Info */}
      <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm">
        <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg border-b border-border-farm pb-3 mb-4">
          <UserCheck className="w-5 h-5 text-primary" />
          <span>User Account & Role Profile</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div className="p-3 bg-bg-farm rounded-xl border border-border-farm">
            <span className="text-text-muted block text-[10px] uppercase font-bold">User Name:</span>
            <span className="text-dark-green font-serif text-sm font-bold">{worker?.name || user?.email?.split('@')[0] || 'Admin'}</span>
          </div>
          <div className="p-3 bg-bg-farm rounded-xl border border-border-farm">
            <span className="text-text-muted block text-[10px] uppercase font-bold">Email Address:</span>
            <span className="text-text-primary text-xs font-mono">{user?.email || worker?.email || 'N/A'}</span>
          </div>
          <div className="p-3 bg-bg-farm rounded-xl border border-border-farm">
            <span className="text-text-muted block text-[10px] uppercase font-bold">Assigned Permission Role:</span>
            <span className="text-accent uppercase tracking-wider font-bold bg-dark-green px-2 py-0.5 rounded text-[10px] inline-block mt-0.5">
              {role || 'admin'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
