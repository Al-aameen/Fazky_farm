import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { compressFarmImage, isValidImageFile } from '../lib/imageCompression';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  CircleDollarSign, 
  UserCheck, 
  Camera, 
  Trash2, 
  UserPlus, 
  KeyRound, 
  ShieldAlert, 
  ShieldCheck, 
  FileText,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { exportToCSV, exportToExcel, parseImportFile, downloadCSVTemplate } from '../lib/csvExportImport';

export default function Settings() {
  const { data, insertRecord, updateRecord, deleteRecord, bulkInsertRecords, refresh, isOnline } = useData();
  const { user, role, worker, updateProfile } = useAuth();

  // Avatar Upload States
  const [avatarPreview, setAvatarPreview] = useState(worker?.avatar || null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  // Egg Price State
  const currentEggPriceObj = (data.egg_price_settings || []).sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0] || { price_per_crate: 4400, effective_date: '2026-01-01' };
  const [eggPrice, setEggPrice] = useState(currentEggPriceObj.price_per_crate || 4400);
  const [effectiveDate, setEffectiveDate] = useState(currentEggPriceObj.effective_date || new Date().toISOString().split('T')[0]);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceSuccess, setPriceSuccess] = useState(false);

  // Worker Management & Security Modal States
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerEmail, setNewWorkerEmail] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('staff');
  const [newWorkerSalary, setNewWorkerSalary] = useState('');
  const [newWorkerPassword, setNewWorkerPassword] = useState('');
  const [showNewWorkerPass, setShowNewWorkerPass] = useState(false);
  const [workerActionLoading, setWorkerActionLoading] = useState(false);
  const [workerActionMsg, setWorkerActionMsg] = useState({ type: '', text: '' });

  // Delete Worker Security Modal States
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState('');

  // Import State
  const [selectedTargetTable, setSelectedTargetTable] = useState('sales_log');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // 1. Handle Avatar Upload with Image Compression
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      setAvatarError('Please choose a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setCompressingImage(true);
    setAvatarError('');
    setAvatarSuccess('');

    try {
      // Compress to ≤100KB JPEG using browser-image-compression
      const { base64, sizeKB } = await compressFarmImage(file);
      setAvatarPreview(base64);

      // Save to worker profile in database
      const res = await updateProfile({ avatar: base64 });
      if (res.success) {
        setAvatarSuccess(`Avatar updated and compressed to ${sizeKB}KB!`);
        setTimeout(() => setAvatarSuccess(''), 4000);
      } else {
        setAvatarError(res.error || 'Failed to save avatar.');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setAvatarError(err.message || 'Image compression failed.');
    } finally {
      setCompressingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Handle Save Egg Price
  const handleSaveEggPrice = async (e) => {
    e.preventDefault();
    setSavingPrice(true);
    setPriceSuccess(false);

    try {
      const payload = {
        price_per_crate: parseFloat(eggPrice) || 0,
        effective_date: effectiveDate,
        set_by: worker?.id || null
      };

      await insertRecord('egg_price_settings', payload);
      setPriceSuccess(true);
      setTimeout(() => setPriceSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving egg price:', err);
      alert('Error saving egg price: ' + err.message);
    } finally {
      setSavingPrice(false);
    }
  };

  // 3. Handle Add/Invite Worker
  const handleAddWorker = async (e) => {
    e.preventDefault();
    const salary = parseFloat(newWorkerSalary);
    if (!newWorkerName || !newWorkerEmail || isNaN(salary) || salary < 0) return;

    setWorkerActionLoading(true);
    setWorkerActionMsg({ type: '', text: '' });

    try {
      const payload = {
        action: 'create',
        name: newWorkerName,
        email: newWorkerEmail,
        role: newWorkerRole,
        base_salary: salary,
        password: newWorkerPassword || undefined
      };

      let edgeWorked = false;
      try {
        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('invite-worker', {
          body: payload
        });
        if (!edgeErr && edgeRes?.success) {
          edgeWorked = true;
        }
      } catch (_) {}

      if (!edgeWorked) {
        // Fallback: direct insert to workers table
        await insertRecord('workers', {
          name: newWorkerName,
          email: newWorkerEmail.toLowerCase(),
          role: newWorkerRole,
          base_salary: salary,
          status: newWorkerPassword ? 'active' : 'invited'
        });
      }

      await refresh();
      setWorkerActionMsg({
        type: 'success',
        text: `Worker ${newWorkerName} successfully created! ${newWorkerPassword ? 'Credentials active.' : 'Invite recorded.'}`
      });

      setShowAddWorkerModal(false);
      setNewWorkerName('');
      setNewWorkerEmail('');
      setNewWorkerRole('staff');
      setNewWorkerSalary('');
      setNewWorkerPassword('');
      setTimeout(() => setWorkerActionMsg({ type: '', text: '' }), 5000);
    } catch (err) {
      console.error('Failed to add worker:', err);
      setWorkerActionMsg({ type: 'error', text: err.message || 'Worker creation failed.' });
    } finally {
      setWorkerActionLoading(false);
    }
  };

  // 4. Handle Delete Worker with Password Authorization
  const handleConfirmDeleteWorker = async (e) => {
    e.preventDefault();
    if (!workerToDelete) return;
    if (!adminAuthPassword) {
      setDeleteConfirmError('Please enter your admin password to authorize deletion.');
      return;
    }

    setWorkerActionLoading(true);
    setDeleteConfirmError('');

    try {
      // 1. Verify admin credentials with Supabase Auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: adminAuthPassword
      });

      if (authErr) {
        setDeleteConfirmError('Incorrect admin password. Deletion cancelled.');
        setWorkerActionLoading(false);
        return;
      }

      // 2. Call Edge Function / Delete Record
      try {
        await supabase.functions.invoke('invite-worker', {
          body: {
            action: 'delete',
            worker_id: workerToDelete.id,
            auth_user_id: workerToDelete.auth_user_id
          }
        });
      } catch (_) {}

      // Delete from workers table directly
      await deleteRecord('workers', workerToDelete.id);
      await refresh();

      setWorkerActionMsg({
        type: 'success',
        text: `Worker "${workerToDelete.name}" was permanently removed.`
      });

      setWorkerToDelete(null);
      setAdminAuthPassword('');
      setTimeout(() => setWorkerActionMsg({ type: '', text: '' }), 5000);
    } catch (err) {
      console.error('Delete worker error:', err);
      setDeleteConfirmError(err.message || 'Failed to delete worker.');
    } finally {
      setWorkerActionLoading(false);
    }
  };

  // 5. Handle Export File
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

  // 6. Handle File Upload & Import
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
      e.target.value = null;
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
            <p className="text-xs text-text-muted font-sans mt-0.5">Manage user profiles, worker accounts, egg pricing, and spreadsheets</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-dark-green flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            Supabase Live
          </span>
        </div>
      </div>

      {workerActionMsg.text && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm ${
          workerActionMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-dark-green' 
            : 'bg-red-50 border-red-200 text-red-accent'
        }`}>
          {workerActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{workerActionMsg.text}</span>
        </div>
      )}

      {/* Grid Section 1: User Profile with Avatar Upload & Egg Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: User Profile & Photo Upload (with imageCompression) */}
        <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg border-b border-border-farm pb-3">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>My Profile & Avatar</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar Circle with Upload Trigger */}
            <div className="relative group shrink-0">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt="Avatar" 
                  className="w-18 h-18 rounded-full object-cover border-2 border-primary shadow-sm"
                />
              ) : (
                <div className="w-18 h-18 rounded-full bg-emerald-50 text-dark-green font-serif font-bold text-2xl flex items-center justify-center border-2 border-dashed border-border-farm shadow-sm">
                  {(worker?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressingImage}
                className="absolute inset-0 bg-black/40 hover:bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
                title="Change Photo"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-bold">Upload</span>
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleAvatarChange} 
                className="hidden" 
              />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif font-bold text-dark-green text-base">{worker?.name || 'Farm User'}</h3>
              <p className="text-xs text-text-muted font-mono">{user?.email || worker?.email || 'N/A'}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-dark-green text-accent px-2 py-0.5 rounded">
                  {role || 'staff'}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressingImage}
                  className="text-xs font-bold text-primary hover:text-dark-green underline flex items-center gap-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{compressingImage ? 'Compressing...' : 'Upload Photo'}</span>
                </button>
              </div>
            </div>
          </div>

          {avatarSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-dark-green rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{avatarSuccess}</span>
            </div>
          )}

          {avatarError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-accent rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}

          <p className="text-[11px] text-text-muted leading-relaxed">
            Photos are automatically compressed to <strong>≤100KB</strong> using high-performance web workers before saving to ensure fast load times.
          </p>
        </div>

        {/* Card 2: Egg Pricing Card */}
        <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg border-b border-border-farm pb-3">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            <span>Egg Price Settings</span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Set the official selling price per crate of eggs used across all Sales Log computations and revenue summaries.
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
              disabled={savingPrice || !isOnline}
              className="w-full bg-dark-green text-white font-bold py-2.5 rounded-xl text-sm hover:bg-emerald-900 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingPrice ? 'Updating...' : 'Save Egg Price Setting'}
            </button>
          </form>
        </div>
      </div>

      {/* Grid Section 2: Worker Management & Delete Security (Admin Only) */}
      {role === 'admin' && (
        <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-3">
            <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Worker Accounts & Delete Security</span>
            </div>
            <button
              onClick={() => setShowAddWorkerModal(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add / Invite Worker</span>
            </button>
          </div>

          <p className="text-xs text-text-muted">
            Manage worker accounts. Deleting a worker requires entering your Admin Password to prevent accidental deletion.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-farm text-[10px] uppercase font-bold text-text-muted bg-bg-farm">
                  <th className="p-3 rounded-l-lg">Worker</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {(data.workers || []).map((w) => (
                  <tr key={w.id} className="hover:bg-bg-farm/40 transition-colors">
                    <td className="p-3 font-bold text-dark-green flex items-center gap-2">
                      {w.avatar ? (
                        <img src={w.avatar} alt={w.name} className="w-6 h-6 rounded-full object-cover border border-primary/30" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-dark-green text-white text-[10px] flex items-center justify-center font-bold">
                          {w.name?.charAt(0) || 'W'}
                        </div>
                      )}
                      <span>{w.name}</span>
                    </td>
                    <td className="p-3 font-mono text-text-muted">{w.email}</td>
                    <td className="p-3">
                      <span className="bg-emerald-50 text-dark-green border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {w.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        w.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {w.status || 'active'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {w.email?.toLowerCase() !== user?.email?.toLowerCase() ? (
                        <button
                          onClick={() => {
                            setWorkerToDelete(w);
                            setAdminAuthPassword('');
                            setDeleteConfirmError('');
                          }}
                          className="text-red-accent hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-200 transition-all"
                          title="Delete Worker"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-muted italic">Current User</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid Section 3: CSV & Excel Data Import/Export Center */}
      <div className="bg-white p-6 rounded-2xl border border-border-farm shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border-farm pb-3">
          <div className="flex items-center gap-2 text-dark-green font-serif font-bold text-lg">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <span>CSV & Excel Data Hub</span>
          </div>
          <span className="text-xs text-text-muted font-sans font-semibold">Support for .csv & .xlsx format</span>
        </div>

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
            <p className="text-[11px] text-text-muted">Download a formatted template with correct column names for importing.</p>
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

      {/* ─── MODAL 1: ADD / INVITE WORKER WITH OPTIONAL PASSWORD ─── */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[420px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Add / Invite Worker</span>
              <button 
                onClick={() => setShowAddWorkerModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddWorker} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="e.g. Amos Danjuma"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newWorkerEmail}
                  onChange={(e) => setNewWorkerEmail(e.target.value)}
                  placeholder="e.g. amos@fazky.com"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={newWorkerRole}
                    onChange={(e) => setNewWorkerRole(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                  >
                    <option value="staff">Staff (Worker)</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Salary (₦/mo)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newWorkerSalary}
                    onChange={(e) => setNewWorkerSalary(e.target.value)}
                    placeholder="45000"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              {/* Initial Password Field */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Initial Password (Optional — for instant login)
                </label>
                <div className="relative">
                  <input
                    type={showNewWorkerPass ? 'text' : 'password'}
                    value={newWorkerPassword}
                    onChange={(e) => setNewWorkerPassword(e.target.value)}
                    placeholder="Leave empty to send email invite"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewWorkerPass(!showNewWorkerPass)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                  >
                    {showNewWorkerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  If provided, worker can sign in immediately with this password.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={workerActionLoading}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {workerActionLoading ? 'Creating...' : 'Create Worker Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: CONFIRM DELETE WORKER (REQUIRES ADMIN PASSWORD) ─── */}
      {workerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-red-700 p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-300" />
                <span>Confirm User Deletion</span>
              </div>
              <button 
                onClick={() => setWorkerToDelete(null)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmDeleteWorker} className="p-6 space-y-4 font-sans text-xs">
              <p className="text-text-primary text-xs leading-relaxed">
                You are about to permanently delete worker <strong>{workerToDelete.name}</strong> ({workerToDelete.email}).
              </p>

              <div className="p-3 bg-red-50 border border-red-200 text-red-accent rounded-xl space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Authorization Required</span>
                </div>
                <p className="text-[11px]">
                  Please enter your admin password below to confirm this permanent action:
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminAuthPassword}
                  onChange={(e) => setAdminAuthPassword(e.target.value)}
                  placeholder="Enter your login password"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {deleteConfirmError && (
                <div className="text-red-accent font-bold text-xs flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteConfirmError}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setWorkerToDelete(null)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={workerActionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {workerActionLoading ? 'Verifying...' : 'Authorize & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
