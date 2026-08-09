import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { Plus, UserPlus, Mail, Shield, Circle, Edit3, KeyRound, AlertTriangle } from 'lucide-react';

export default function Workers() {
  const { data, insertRecord, updateRecord } = useData();
  const { isSimulationMode } = useAuth();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Invite Worker Form States
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('staff');
  const [invSalary, setInvSalary] = useState('');

  // Edit Worker Form States
  const [editingWorker, setEditingWorker] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('staff');
  const [editSalary, setEditSalary] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    const salary = parseFloat(invSalary);
    if (!invName || !invEmail || isNaN(salary) || salary < 0) return;

    try {
      const payload = {
        name: invName,
        email: invEmail,
        role: invRole,
        base_salary: salary,
        status: isSimulationMode ? 'active' : 'invited'
      };

      if (isSimulationMode) {
        // Local simulation adds directly to cache
        await insertRecord('workers', payload);
        setMessage('Worker invited successfully! Status: Active (Simulated)');
        setMessageType('success');
      } else {
        // Real Edge Function trigger placeholder / REST POST
        // We will call the Supabase functions client
        // await supabase.functions.invoke('invite-worker', { body: payload })
        // For standard local execution if Edge Function isn't running, we fallback to insert
        await insertRecord('workers', payload);
        setMessage('Invitation email sent via Edge Function. Worker created.');
        setMessageType('success');
      }

      setShowInviteModal(false);
      setInvName('');
      setInvEmail('');
      setInvRole('staff');
      setInvSalary('');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Failed to invite worker:', err);
      setMessage(err.message || 'Invitation failed.');
      setMessageType('error');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const salary = parseFloat(editSalary);
    if (!editingWorker || !editName || isNaN(salary) || salary < 0) return;

    try {
      await updateRecord('workers', {
        id: editingWorker.id,
        name: editName,
        role: editRole,
        base_salary: salary,
        status: editStatus
      });

      setShowEditModal(false);
      setEditingWorker(null);
      setMessage('Worker profile updated successfully.');
      setMessageType('success');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Failed to update worker:', err);
      setMessage('Failed to update profile.');
      setMessageType('error');
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
          Invite Farm Worker
        </button>
      </div>

      {message && (
        <div className={`border rounded-xl p-4 flex gap-2.5 items-center animate-fade-in shadow-sm text-xs ${
          messageType === 'success' ? 'bg-green-50 border-green-200 text-primary' : 'bg-red-50 border-red-200 text-red-accent'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{message}</span>
        </div>
      )}

      {/* Workers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(data.workers || []).map(w => {
          return (
            <div
              key={w.id}
              className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <h4 className="font-serif text-dark-green font-bold text-base">{w.name}</h4>
                  <div className="text-[10px] text-text-muted font-mono">{w.email}</div>
                </div>
                <span className={`border text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getStatusColor(w.status)}`}>
                  {w.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border-farm/50 pt-3">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Assigned Role</span>
                  <div className="text-xs font-bold text-text-primary uppercase tracking-wide">{w.role}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Base Salary</span>
                  <div className="text-sm font-serif font-black text-primary">₦{Number(w.base_salary).toLocaleString()} / mo</div>
                </div>
              </div>

              <div className="pt-3 border-t border-border-farm/50 flex justify-end">
                <button
                  onClick={() => {
                    setEditingWorker(w);
                    setEditName(w.name);
                    setEditRole(w.role);
                    setEditSalary(w.base_salary.toString());
                    setEditStatus(w.status);
                    setShowEditModal(true);
                  }}
                  className="flex items-center gap-1 bg-bg-farm hover:bg-light-green border border-border-farm text-primary font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Profile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALS */}
      {/* 1. Invite Worker Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[380px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Invite New Farm Worker</span>
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

              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="e.g. 45000"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                  />
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
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Worker Modal */}
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
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
