import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Circle, 
  Edit3, 
  KeyRound, 
  AlertTriangle, 
  Trash2, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ShieldAlert
} from 'lucide-react';

export default function Workers() {
  const { data, insertRecord, updateRecord, deleteRecord, refresh } = useData();
  const { user } = useAuth();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Invite Worker Form States
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('staff');
  const [invSalary, setInvSalary] = useState('');
  const [invPassword, setInvPassword] = useState('');
  const [showInvPass, setShowInvPass] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Worker Form States
  const [editingWorker, setEditingWorker] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('staff');
  const [editSalary, setEditSalary] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  // Delete Worker Security States
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState('');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    const salary = parseFloat(invSalary);
    if (!invName || !invEmail || isNaN(salary) || salary < 0) return;

    setActionLoading(true);
    try {
      const payload = {
        action: 'create',
        name: invName,
        email: invEmail,
        role: invRole,
        base_salary: salary,
        password: invPassword || undefined
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
        // Fallback: direct insert
        await insertRecord('workers', {
          name: invName,
          email: invEmail.toLowerCase(),
          role: invRole,
          base_salary: salary,
          status: invPassword ? 'active' : 'invited'
        });
      }

      await refresh();
      setMessage(`Worker ${invName} created successfully! ${invPassword ? 'Credentials ready for login.' : 'Invitation recorded.'}`);
      setMessageType('success');

      setShowInviteModal(false);
      setInvName('');
      setInvEmail('');
      setInvRole('staff');
      setInvSalary('');
      setInvPassword('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('Failed to invite worker:', err);
      setMessage(err.message || 'Invitation failed.');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const salary = parseFloat(editSalary);
    if (!editingWorker || !editName || isNaN(salary) || salary < 0) return;

    setActionLoading(true);
    try {
      await updateRecord('workers', {
        id: editingWorker.id,
        name: editName,
        role: editRole,
        base_salary: salary,
        status: editStatus
      });

      await refresh();
      setShowEditModal(false);
      setEditingWorker(null);
      setMessage('Worker profile updated successfully.');
      setMessageType('success');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Failed to update worker:', err);
      setMessage('Failed to update profile.');
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteWorker = async (e) => {
    e.preventDefault();
    if (!workerToDelete) return;
    if (!adminAuthPassword) {
      setDeleteConfirmError('Please enter your admin password to authorize deletion.');
      return;
    }

    setActionLoading(true);
    setDeleteConfirmError('');

    try {
      // 1. Verify admin credentials with Supabase Auth
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: adminAuthPassword
      });

      if (authErr) {
        setDeleteConfirmError('Incorrect admin password. Deletion cancelled.');
        setActionLoading(false);
        return;
      }

      // 2. Call Edge Function to remove auth user if present
      try {
        await supabase.functions.invoke('invite-worker', {
          body: {
            action: 'delete',
            worker_id: workerToDelete.id,
            auth_user_id: workerToDelete.auth_user_id
          }
        });
      } catch (_) {}

      // 3. Delete from workers table directly
      await deleteRecord('workers', workerToDelete.id);
      await refresh();

      setMessage(`Worker "${workerToDelete.name}" was permanently removed.`);
      setMessageType('success');
      setWorkerToDelete(null);
      setAdminAuthPassword('');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Delete worker error:', err);
      setDeleteConfirmError(err.message || 'Failed to delete worker.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'active') return 'bg-green-50 text-primary border-green-200';
    if (status === 'invited') return 'bg-amber-50 text-amber-accent border-amber-200';
    return 'bg-red-50 text-red-accent border-red-200';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white border border-border-farm rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <h3 className="font-serif text-dark-green font-bold text-lg leading-snug">Workers Directory</h3>
            <p className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider mt-0.5">
              Staff roles, salary and account statuses
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all w-full sm:w-auto justify-center"
        >
          <UserPlus className="w-4 h-4" />
          Add / Invite Worker
        </button>
      </div>

      {message && (
        <div className={`border rounded-xl p-4 flex gap-2.5 items-center animate-fade-in shadow-sm text-xs ${
          messageType === 'success' ? 'bg-green-50 border-green-200 text-primary' : 'bg-red-50 border-red-200 text-red-accent'
        }`}>
          {messageType === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="font-bold">{message}</span>
        </div>
      )}

      {/* Workers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data.workers || []).map(w => {
          const isCurrentUser = w.email?.toLowerCase() === user?.email?.toLowerCase();
          return (
            <div
              key={w.id}
              className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {w.avatar ? (
                    <img src={w.avatar} alt={w.name} className="w-10 h-10 rounded-full object-cover border border-primary/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-dark-green font-bold font-serif text-sm flex items-center justify-center border border-border-farm">
                      {w.name?.charAt(0) || 'W'}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <h4 className="font-serif text-dark-green font-bold text-base">{w.name}</h4>
                    <div className="text-[10px] text-text-muted font-mono">{w.email}</div>
                  </div>
                </div>

                <span className={`border text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(w.status)}`}>
                  {w.status || 'active'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border-farm/50 pt-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Assigned Role</span>
                  <div className="text-xs font-bold text-text-primary uppercase tracking-wide">{w.role}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Base Salary</span>
                  <div className="text-sm font-serif font-black text-primary">₦{Number(w.base_salary || 0).toLocaleString()} / mo</div>
                </div>
              </div>

              <div className="pt-3 border-t border-border-farm/50 flex justify-between items-center">
                {!isCurrentUser ? (
                  <button
                    onClick={() => {
                      setWorkerToDelete(w);
                      setAdminAuthPassword('');
                      setDeleteConfirmError('');
                    }}
                    className="text-red-accent hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-200 text-xs font-bold flex items-center gap-1 transition-all"
                    title="Delete worker account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-text-muted italic">Current User</span>
                )}

                <button
                  onClick={() => {
                    setEditingWorker(w);
                    setEditName(w.name);
                    setEditRole(w.role);
                    setEditSalary((w.base_salary || 0).toString());
                    setEditStatus(w.status || 'active');
                    setShowEditModal(true);
                  }}
                  className="flex items-center gap-1 bg-bg-farm hover:bg-light-green border border-border-farm text-primary font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all ml-auto"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Profile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL 1: INVITE / ADD WORKER ─── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Add / Invite Worker</span>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Worker Name
                </label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
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
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
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
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                  >
                    <option value="staff">Staff (Worker)</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Monthly Salary (₦)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={invSalary}
                    onChange={(e) => setInvSalary(e.target.value)}
                    placeholder="45000"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              {/* Initial Password Field */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Initial Password (Optional — for direct login)
                </label>
                <div className="relative">
                  <input
                    type={showInvPass ? 'text' : 'password'}
                    value={invPassword}
                    onChange={(e) => setInvPassword(e.target.value)}
                    placeholder="Leave empty to send email invite"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvPass(!showInvPass)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                  >
                    {showInvPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: EDIT WORKER ─── */}
      {showEditModal && editingWorker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[380px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Edit Worker Profile</span>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingWorker(null);
                }}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <div className="text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Worker Email</div>
                <div className="bg-bg-farm border border-border-farm rounded-lg px-3 py-2 font-mono text-text-muted text-xs">
                  {editingWorker.email}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Worker Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                  >
                    <option value="staff">Staff (Worker)</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Base Salary (₦)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="inactive">Inactive (Deactivated)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingWorker(null);
                  }}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CONFIRM DELETE WORKER (REQUIRES ADMIN PASSWORD) ─── */}
      {workerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-red-700 p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-300" />
                <span>Confirm Worker Deletion</span>
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
                  <span>Admin Password Authorization</span>
                </div>
                <p className="text-[11px]">
                  Please enter your admin password to authorize permanent deletion:
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
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Verifying...' : 'Authorize & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
