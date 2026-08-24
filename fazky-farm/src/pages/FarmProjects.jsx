import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { compressFarmImage, isValidImageFile } from '../lib/imageCompression';
import { 
  Hammer, 
  Plus, 
  Receipt, 
  Camera, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  TrendingUp, 
  Image as ImageIcon,
  Trash2,
  Edit3,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';

const CATEGORIES = [
  'Infrastructure',
  'Brooder Pen Expansion',
  'Solar & Power Setup',
  'Water & Borehole',
  'Feed Milling Equipment',
  'Biosecurity & Fencing',
  'General Maintenance'
];

export default function FarmProjects() {
  const { data, insertRecord, updateRecord, deleteRecord } = useData();
  const { role, worker } = useAuth();

  // Modals
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // New Project Form States
  const [projTitle, setProjTitle] = useState('');
  const [projCategory, setProjCategory] = useState('Infrastructure');
  const [projBudget, setProjBudget] = useState('');
  const [projStartDate, setProjStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [projTargetDate, setProjTargetDate] = useState('');
  const [projNotes, setProjNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Log Project Expense Form States (Inserts into expenses_log with project_id)
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expRemarks, setExpRemarks] = useState('');

  // Add Progress Photo States
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);

  const projects = data.farm_projects || [];
  const allExpenses = data.expenses_log || [];

  // 1. Handle Add New Farm Project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projTitle || !projBudget) return;

    setSubmitting(true);
    try {
      await insertRecord('farm_projects', {
        title: projTitle,
        category: projCategory,
        budget_estimated: parseFloat(projBudget) || 0,
        start_date: projStartDate,
        target_date: projTargetDate || null,
        status: 'in_progress',
        photos: [],
        notes: projNotes
      });

      setShowAddProjectModal(false);
      setProjTitle('');
      setProjBudget('');
      setProjNotes('');
      setProjTargetDate('');
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Error creating project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Handle Log Expense for Project (Single Source of Truth -> expenses_log)
  const handleLogProjectExpense = async (e) => {
    e.preventDefault();
    if (!selectedProject || !expDesc || !expAmount) return;

    setSubmitting(true);
    try {
      const amt = parseFloat(expAmount);
      // Directly insert into expenses_log with project_id
      await insertRecord('expenses_log', {
        project_id: selectedProject.id,
        date: expDate,
        day_of_week: new Date(expDate).toLocaleDateString('en-US', { weekday: 'long' }),
        description: `[Project: ${selectedProject.title}] ${expDesc}`,
        amount: amt,
        remarks: expRemarks || `Capital expense logged for project: ${selectedProject.title}`,
        created_by: worker?.id || null
      });

      setShowExpenseModal(false);
      setExpDesc('');
      setExpAmount('');
      setExpRemarks('');
    } catch (err) {
      console.error('Failed to log project expense:', err);
      alert('Error recording expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Handle Add Progress Photo (Compressed to ≤100KB JPEG via web worker)
  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      alert('Please choose a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { base64, sizeKB } = await compressFarmImage(file);
      setPhotoPreview(base64);
    } catch (err) {
      alert(err.message || 'Image compression failed.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProgressPhoto = async (e) => {
    e.preventDefault();
    if (!selectedProject || !photoPreview) return;

    setSubmitting(true);
    try {
      const newPhoto = {
        id: crypto.randomUUID(),
        url: photoPreview,
        caption: photoCaption || 'Project progress update',
        date: photoDate
      };

      const existingPhotos = Array.isArray(selectedProject.photos) ? selectedProject.photos : [];
      const updatedPhotos = [newPhoto, ...existingPhotos];

      await updateRecord('farm_projects', {
        id: selectedProject.id,
        photos: updatedPhotos
      });

      setShowPhotoModal(false);
      setPhotoPreview(null);
      setPhotoCaption('');
    } catch (err) {
      console.error('Failed to save project photo:', err);
      alert('Error saving photo: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Handle Status Change
  const handleUpdateStatus = async (projectId, newStatus) => {
    try {
      await updateRecord('farm_projects', {
        id: projectId,
        status: newStatus
      });
    } catch (err) {
      console.error('Failed to update project status:', err);
    }
  };

  // 5. Handle Delete Project
  const handleDeleteProject = async (projectId, title) => {
    if (window.confirm(`Are you sure you want to delete project "${title}"? Associated ledger expense records will remain preserved.`)) {
      try {
        await deleteRecord('farm_projects', projectId);
      } catch (err) {
        console.error('Failed to delete project:', err);
      }
    }
  };

  // Global Financial Statistics
  const totalBudget = projects.reduce((s, p) => s + (parseFloat(p.budget_estimated) || 0), 0);
  const totalSpentAcrossAllProjects = allExpenses
    .filter(e => e.project_id)
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-dark-green rounded-xl shadow-sm">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">Farm Projects & Capital Works</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              Track infrastructure investments, budget vs actual expenses, and visual progress photos
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddProjectModal(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Farm Project</span>
        </button>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm space-y-1">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Active Capital Projects</span>
          <span className="text-2xl font-serif font-bold text-dark-green">{projects.length} Projects</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm space-y-1">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Estimated Budget</span>
          <span className="text-2xl font-serif font-bold text-primary">₦{totalBudget.toLocaleString()}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm space-y-1">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Total Capital Expended</span>
          <span className="text-2xl font-serif font-bold text-dark-green">₦{totalSpentAcrossAllProjects.toLocaleString()}</span>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white border border-border-farm rounded-2xl p-12 text-center shadow-sm space-y-3">
          <Hammer className="w-12 h-12 text-text-muted mx-auto" />
          <h3 className="font-serif text-lg font-bold text-dark-green">No Ongoing Farm Projects</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Record farm expansion works, solar equipment installations, or pen renovations to track budgets and visual progress.
          </p>
          <button
            onClick={() => setShowAddProjectModal(true)}
            className="bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all"
          >
            + Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
            const projectExpenses = allExpenses.filter(e => e.project_id === proj.id);
            const spent = projectExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const budget = parseFloat(proj.budget_estimated) || 0;
            const progress = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const photos = Array.isArray(proj.photos) ? proj.photos : [];

            return (
              <div key={proj.id} className="bg-white border border-border-farm rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Card Header */}
                  <div className="p-5 border-b border-border-farm bg-bg-farm/40 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-dark-green rounded-full">
                          {proj.category}
                        </span>
                        <select
                          value={proj.status || 'in_progress'}
                          onChange={(e) => handleUpdateStatus(proj.id, e.target.value)}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer ${
                            proj.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : proj.status === 'paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <option value="in_progress">In Progress</option>
                          <option value="planned">Planned</option>
                          <option value="completed">Completed</option>
                          <option value="paused">Paused</option>
                        </select>
                      </div>
                      <h3 className="font-serif font-bold text-dark-green text-lg mt-1">{proj.title}</h3>
                    </div>

                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.title)}
                      className="text-text-muted hover:text-red-accent p-1.5 rounded-lg transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Financial & Timeline Metrics */}
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-text-muted block">Budget Allocation</span>
                        <span className="text-base font-serif font-bold text-dark-green">₦{budget.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-text-muted block">Total Spent (From Ledger)</span>
                        <span className="text-base font-serif font-bold text-primary">₦{spent.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-text-muted">Budget Utilization</span>
                        <span className={progress > 90 ? 'text-red-600 font-bold' : 'text-dark-green font-bold'}>{progress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-bg-farm rounded-full overflow-hidden border border-border-farm">
                        <div
                          className={`h-full transition-all duration-500 ${
                            progress > 100 ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>

                    {/* Dates and Notes */}
                    <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                      <span>Started: <strong>{proj.start_date}</strong></span>
                      {proj.target_date && <span>Target: <strong>{proj.target_date}</strong></span>}
                    </div>

                    {proj.notes && (
                      <p className="text-xs text-text-muted italic bg-bg-farm p-2.5 rounded-xl border border-border-farm">
                        "{proj.notes}"
                      </p>
                    )}

                    {/* Progress Photos Strip */}
                    {photos.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] font-bold uppercase text-text-muted flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Progress Photos ({photos.length})</span>
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {photos.map((ph) => (
                            <div key={ph.id} className="relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border-farm">
                              <img src={ph.url} alt={ph.caption} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[8px] text-white flex flex-col justify-end">
                                <span className="font-bold truncate">{ph.caption}</span>
                                <span className="text-white/70 font-mono">{ph.date}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Project Expenses List Preview */}
                    <div className="space-y-1.5 border-t border-border-farm pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-text-muted flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Recent Expenses ({projectExpenses.length})</span>
                        </span>
                        <span className="text-[10px] text-primary font-bold">Synced to Ledger</span>
                      </div>

                      {projectExpenses.length === 0 ? (
                        <p className="text-[11px] text-text-muted italic">No expenses logged yet.</p>
                      ) : (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1 text-xs scrollbar-thin">
                          {projectExpenses.slice(0, 4).map((exp) => (
                            <div key={exp.id} className="flex justify-between items-center bg-bg-farm px-2 py-1 rounded-lg">
                              <span className="text-text-primary font-medium truncate max-w-[200px]">{exp.description}</span>
                              <span className="font-mono font-bold text-dark-green">₦{Number(exp.amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-4 bg-bg-farm border-t border-border-farm flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedProject(proj);
                      setExpDesc('');
                      setExpAmount('');
                      setExpRemarks('');
                      setShowExpenseModal(true);
                    }}
                    className="flex-1 bg-white hover:bg-emerald-50 text-dark-green font-bold py-2 rounded-xl text-xs border border-border-farm shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Receipt className="w-3.5 h-3.5 text-primary" />
                    <span>Log Expense</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedProject(proj);
                      setPhotoPreview(null);
                      setPhotoCaption('');
                      setShowPhotoModal(true);
                    }}
                    className="flex-1 bg-dark-green hover:bg-emerald-900 text-white font-bold py-2 rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Add Photo</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: NEW PROJECT MODAL ─── */}
      {showAddProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[460px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Register New Farm Project</span>
              <button 
                onClick={() => setShowAddProjectModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="e.g. 5KVA Solar System Setup, Pen Block E Construction"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={projCategory}
                    onChange={(e) => setProjCategory(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-bold text-text-primary focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Estimated Budget (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={projBudget}
                    onChange={(e) => setProjBudget(e.target.value)}
                    placeholder="1500000"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projStartDate}
                    onChange={(e) => setProjStartDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Target Completion
                  </label>
                  <input
                    type="date"
                    value={projTargetDate}
                    onChange={(e) => setProjTargetDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Project Scope & Notes
                </label>
                <textarea
                  rows={2}
                  value={projNotes}
                  onChange={(e) => setProjNotes(e.target.value)}
                  placeholder="Contractor details, specifications, warranty period, etc."
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-xl font-bold text-xs shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: LOG EXPENSE DIRECTLY TO expenses_log ─── */}
      {showExpenseModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-[420px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Expense for {selectedProject.title}</span>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLogProjectExpense} className="p-6 space-y-4 font-sans text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-dark-green font-semibold">
                This expense will be automatically linked to <strong>{selectedProject.title}</strong> and recorded in the main Expenses Ledger with zero duplication.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Item / Work Description *
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Purchase of 4x 300W Solar Panels"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Amount (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="250000"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Vendor / Receipt Remarks
                </label>
                <input
                  type="text"
                  value={expRemarks}
                  onChange={(e) => setExpRemarks(e.target.value)}
                  placeholder="e.g. Paid via transfer to Al-Mubarak Electricals"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD PROGRESS PHOTO (WITH COMPRESSION) ─── */}
      {showPhotoModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Add Progress Photo</span>
              <button 
                onClick={() => setShowPhotoModal(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProgressPhoto} className="p-6 space-y-4 font-sans text-xs">
              <div className="text-center">
                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-primary max-h-48 mb-2">
                    <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg"
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    className="border-2 border-dashed border-border-farm hover:border-primary rounded-2xl p-8 cursor-pointer bg-bg-farm transition-colors"
                  >
                    <Camera className="w-8 h-8 text-primary mx-auto mb-2" />
                    <span className="font-bold text-dark-green block">Click to Snap or Select Photo</span>
                    <span className="text-[10px] text-text-muted">Auto-compressed to ≤100KB JPEG via web worker</span>
                  </div>
                )}

                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Progress Caption *
                </label>
                <input
                  type="text"
                  required
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Inverter mounted, concrete slab cured"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Date Taken
                </label>
                <DatePicker value={photoDate} onChange={setPhotoDate} />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !photoPreview}
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Attach Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
