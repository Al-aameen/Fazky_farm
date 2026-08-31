import React, { useState, useRef, useCallback } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';
import { Plus, Receipt, Calendar, Download, Upload, ChevronRight, Hammer, Filter, Edit3, Trash2, AlertCircle } from 'lucide-react';

export default function ExpensesLog() {
  const { data, insertRecord, updateRecord, deleteRecord, bulkInsertRecords } = useData();
  const { worker, role } = useAuth();
  const expImportRef = useRef(null);
  const isAdmin = role === 'admin';
  
  // Set month filter state (defaults to latest recorded month, e.g. "2026-08")
  const getLatestExpensesMonth = () => {
    const dates = (data.expenses_log || []).map(e => e.date).filter(Boolean);
    if (dates.length > 0) {
      const sorted = dates.sort((a, b) => new Date(b) - new Date(a));
      return sorted[0].substring(0, 7); // YYYY-MM
    }
    return new Date().toISOString().substring(0, 7);
  };

  const [selectedMonth, setSelectedMonth] = useState(getLatestExpensesMonth());
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'operations', 'projects'
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [highlightedDate, setHighlightedDate] = useState(null);
  const groupRefs = useRef({});

  // Admin Edit Expense state
  const [editingExpense, setEditingExpense] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmt, setEditAmt] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // New Expense form inputs
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expProjectId, setExpProjectId] = useState('');
  const [expRemarks, setExpRemarks] = useState('');

  // Error state
  const [errorMessage, setErrorMessage] = useState(null);

  const projects = data.farm_projects || [];
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.title]));

  // Filter expenses by selectedMonth (YYYY-MM) and category
  const getFilteredExpenses = () => {
    return (data.expenses_log || [])
      .filter(e => {
        if (!e.date || e.date.substring(0, 7) !== selectedMonth) return false;
        if (categoryFilter === 'projects') return !!e.project_id;
        if (categoryFilter === 'operations') return !e.project_id;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at));
  };

  const filteredExpenses = getFilteredExpenses();

  // Group by date
  const getGroupedExpenses = () => {
    const groups = {};
    filteredExpenses.forEach(exp => {
      const d = exp.date;
      if (!groups[d]) {
        groups[d] = {
          date: d,
          items: [],
          subtotal: 0
        };
      }
      groups[d].items.push(exp);
      groups[d].subtotal += (Number(exp.amount) || 0);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const groupedExpenses = getGroupedExpenses();

  // Monthly total
  const getMonthlyTotal = () => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expAmt);
    if (!expDesc || isNaN(amt) || amt <= 0) return;
    setErrorMessage(null);

    try {
      const dayOfWeekStr = new Date(expDate).toLocaleDateString('en-US', { weekday: 'long' });
      await insertRecord('expenses_log', {
        date: expDate,
        day_of_week: dayOfWeekStr,
        description: expDesc,
        amount: amt,
        project_id: expProjectId || null,
        remarks: expRemarks || (expProjectId ? `Linked to project: ${projectMap[expProjectId] || ''}` : ''),
        created_by: worker?.id || null
      });

      // Only clear on success
      setShowAddExpense(false);
      setExpDesc('');
      setExpAmt('');
      setExpProjectId('');
      setExpRemarks('');
    } catch (err) {
      console.error('Failed to log expense:', err);
      setErrorMessage(err?.message || 'Failed to log expense. Your data is still on screen.');
    }
  };

  // Admin: open edit modal for an expense
  const openEditModal = (item) => {
    setEditingExpense(item);
    setEditDesc(item.description || '');
    setEditAmt(String(item.amount || ''));
    setEditDate(item.date || new Date().toISOString().split('T')[0]);
    setEditRemarks(item.remarks || '');
    setEditProjectId(item.project_id || '');
  };

  // Admin: save edited expense
  const handleEditExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(editAmt);
    if (!editDesc || isNaN(amt) || amt <= 0) return;

    setEditSaving(true);
    setErrorMessage(null);
    try {
      const dayOfWeek = new Date(editDate).toLocaleDateString('en-US', { weekday: 'long' });
      await updateRecord('expenses_log', {
        id: editingExpense.id,
        date: editDate,
        day_of_week: dayOfWeek,
        description: editDesc,
        amount: amt,
        project_id: editProjectId || null,
        remarks: editRemarks
      });

      setEditingExpense(null);
    } catch (err) {
      console.error('Edit expense failed:', err);
      setErrorMessage(err?.message || 'Failed to update expense.');
    } finally {
      setEditSaving(false);
    }
  };

  // Admin: delete expense with confirmation
  const handleDeleteExpense = async (item) => {
    if (!window.confirm(`Delete this expense?\n\n"${item.description}" — ₦${Number(item.amount).toLocaleString()}\n\nThis cannot be undone.`)) return;
    try {
      await deleteRecord('expenses_log', item.id);
    } catch (err) {
      console.error('Delete expense failed:', err);
      alert('Failed to delete: ' + err.message);
    }
  };


  return (
    <div className="p-6 space-y-6">
      {/* Error Banner */}
      {errorMessage && (
        <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4 text-xs text-red-800 font-sans shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">Save failed — your data is still on screen</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="shrink-0 text-red-500 hover:text-red-700 font-bold text-xs">Dismiss</button>
        </div>
      )}

      {/* Metrics Card & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Monthly Summary Card */}
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm flex items-start justify-between md:col-span-1">
          <div className="space-y-1">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Monthly Outflow</span>
            <div className="text-3xl font-serif font-black text-red-accent">
              ₦{getMonthlyTotal().toLocaleString()}
            </div>
            <p className="text-[10px] text-text-muted">Total expenses in {selectedMonth}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-xl text-red-accent font-bold">💳</div>
        </div>

        {/* Filter and Action Panel */}
        <div className="bg-white border border-border-farm rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between md:col-span-2">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-bg-farm px-2.5 py-1.5 rounded-xl border border-border-farm">
              <Calendar className="w-4 h-4 text-primary" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-dark-green focus:outline-none cursor-pointer"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center bg-bg-farm p-0.5 rounded-xl border border-border-farm text-xs font-bold">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  categoryFilter === 'all' ? 'bg-dark-green text-white shadow-sm' : 'text-text-muted hover:text-dark-green'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setCategoryFilter('operations')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  categoryFilter === 'operations' ? 'bg-dark-green text-white shadow-sm' : 'text-text-muted hover:text-dark-green'
                }`}
              >
                Operations
              </button>
              <button
                onClick={() => setCategoryFilter('projects')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  categoryFilter === 'projects' ? 'bg-dark-green text-white shadow-sm' : 'text-text-muted hover:text-dark-green'
                }`}
              >
                <Hammer className="w-3 h-3" />
                <span>Projects</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => exportToExcel(`fazky_expenses_${selectedMonth}`, 'Expenses', data.expenses_log || [])}
              className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
              title="Export Expenses to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export</span>
            </button>

            <button
              onClick={() => setShowAddExpense(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Expenses List */}
      <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-serif text-dark-green font-bold text-base flex items-center gap-1.5 border-b border-border-farm pb-3">
          <Receipt className="w-4.5 h-4.5 text-primary" />
          <span>Expenditure Records</span>
        </h3>

        <div className="space-y-6">
          {groupedExpenses.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8 font-sans">
              No expenses matching the selected criteria.
            </p>
          ) : (
            groupedExpenses.map(group => (
              <div
                key={group.date}
                ref={el => { groupRefs.current[group.date] = el; }}
                className={`space-y-2 rounded-xl transition-all duration-500 ${
                  highlightedDate === group.date
                    ? 'ring-2 ring-yellow-400 bg-yellow-50/30 px-2 py-1'
                    : ''
                }`}
              >
                {/* Date header */}
                <div className="flex justify-between items-center text-xs font-bold bg-bg-farm/70 border border-border-farm/60 px-3 py-2 rounded-lg">
                  <span className="text-dark-green font-serif">{group.date}</span>
                  <span className="text-red-accent font-mono">Subtotal: -₦{group.subtotal.toLocaleString()}</span>
                </div>

                {/* Expense Items list */}
                <div className="divide-y divide-border-farm/40 pl-2">
                  {group.items.map(item => (
                    <div key={item.id} className="py-3 flex justify-between items-start text-xs font-sans">
                      <div className="space-y-1 max-w-[60%]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-text-primary text-sm">{item.description}</span>
                          {item.project_id && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <Hammer className="w-2.5 h-2.5" />
                              <span>{projectMap[item.project_id] || 'Farm Project'}</span>
                            </span>
                          )}
                        </div>
                        {item.remarks && (
                          <div className="text-[10px] text-text-muted italic flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 shrink-0" />
                            <span>{item.remarks}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono font-black text-red-accent text-sm">
                          -₦{Number(item.amount).toLocaleString()}
                        </div>
                        {/* Admin-only: Edit & Delete buttons */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-text-muted hover:text-dark-green hover:bg-bg-farm rounded-lg transition-colors"
                              title="Edit this expense (Admin)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(item)}
                              className="p-1.5 text-text-muted hover:text-red-accent hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete this expense (Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ADMIN EDIT EXPENSE MODAL */}
      {editingExpense && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[420px] w-full overflow-hidden">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>✏️ Edit Expense (Admin)</span>
              <button onClick={() => setEditingExpense(null)} className="text-white/60 hover:text-white font-sans text-lg">✕</button>
            </div>
            <form onSubmit={handleEditExpenseSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold">
                ⚠️ Admin Edit: Changes here update the database record directly. This is logged for audit purposes.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Date</label>
                <DatePicker value={editDate} onChange={setEditDate} />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Amount (₦) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editAmt}
                  onChange={(e) => setEditAmt(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Link to Project (Optional)</label>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">-- No Project Link --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>🏗️ {p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Remarks</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button type="button" onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {showAddExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[420px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Farm Expense</span>
              <button 
                onClick={() => setShowAddExpense(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddExpenseSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Expense Date
                </label>
                <DatePicker
                  value={expDate}
                  onChange={setExpDate}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Description / Item Purchased *
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Generator diesel, layer feed mixing, plumbing spares"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Amount Spent (₦) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expAmt}
                  onChange={(e) => setExpAmt(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              {/* Link to Project (Optional) */}
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Link to Farm Project (Optional)
                </label>
                <select
                  value={expProjectId}
                  onChange={(e) => setExpProjectId(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold text-text-primary"
                >
                  <option value="">-- General Operational Expense (No Project) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      🏗️ {p.title} ({p.category})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-text-muted mt-1">
                  If linked, this expense automatically updates the project's budget tracking.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  value={expRemarks}
                  onChange={(e) => setExpRemarks(e.target.value)}
                  placeholder="Vendor receipt notes, delivery details, etc."
                  rows="2"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
