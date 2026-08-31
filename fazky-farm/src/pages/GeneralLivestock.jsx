import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel } from '../lib/csvExportImport';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Download, 
  HeartPulse, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Layers,
  Activity,
  Trash2,
  Edit3
} from 'lucide-react';

const LIVESTOCK_CATEGORIES = [
  'Turkeys',
  'Goats',
  'Sheep',
  'Cattle',
  'Rabbits',
  'Ducks',
  'Pigs',
  'Other'
];

export default function GeneralLivestock() {
  const { data, insertRecord, updateRecord, deleteRecord } = useData();
  const { role } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form Fields
  const [tagId, setTagId] = useState('');
  const [category, setCategory] = useState('Turkeys');
  const [breed, setBreed] = useState('');
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [youngCount, setYoungCount] = useState(0);
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().split('T')[0]);
  const [acquisitionCost, setAcquisitionCost] = useState(0);
  const [healthStatus, setHealthStatus] = useState('Healthy');
  const [locationPen, setLocationPen] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });

  const rawList = data.general_livestock_detailed || [];

  // Filtered livestock list
  const filteredList = rawList.filter(item => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const lc = searchTerm.toLowerCase();
    const matchesSearch = !lc || 
      (item.tag_id && item.tag_id.toLowerCase().includes(lc)) ||
      (item.category && item.category.toLowerCase().includes(lc)) ||
      (item.breed && item.breed.toLowerCase().includes(lc)) ||
      (item.location_pen && item.location_pen.toLowerCase().includes(lc));
    return matchesCat && matchesSearch;
  });

  // Calculate totals by category
  const categoryTotals = LIVESTOCK_CATEGORIES.reduce((acc, cat) => {
    const total = rawList
      .filter(item => item.category === cat)
      .reduce((sum, item) => sum + (Number(item.count_male || 0) + Number(item.count_female || 0) + Number(item.count_young || 0)), 0);
    acc[cat] = total;
    return acc;
  }, {});

  const totalAllLivestock = rawList.reduce(
    (sum, item) => sum + (Number(item.count_male || 0) + Number(item.count_female || 0) + Number(item.count_young || 0)), 
    0
  );

  // Handle Open Add / Edit Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setTagId(`LS-${Math.floor(1000 + Math.random() * 9000)}`);
    setCategory('Turkeys');
    setBreed('');
    setMaleCount(0);
    setFemaleCount(0);
    setYoungCount(0);
    setAcquisitionDate(new Date().toISOString().split('T')[0]);
    setAcquisitionCost(0);
    setHealthStatus('Healthy');
    setLocationPen('');
    setNotes('');
    setFormMsg({ type: '', text: '' });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setTagId(item.tag_id || '');
    setCategory(item.category || 'Turkeys');
    setBreed(item.breed || '');
    setMaleCount(Number(item.count_male) || 0);
    setFemaleCount(Number(item.count_female) || 0);
    setYoungCount(Number(item.count_young) || 0);
    setAcquisitionDate(item.acquisition_date || new Date().toISOString().split('T')[0]);
    setAcquisitionCost(Number(item.acquisition_cost) || 0);
    setHealthStatus(item.health_status || 'Healthy');
    setLocationPen(item.location_pen || '');
    setNotes(item.notes || '');
    setFormMsg({ type: '', text: '' });
    setShowAddModal(true);
  };

  // Handle Save Livestock
  const handleSaveLivestock = async (e) => {
    e.preventDefault();
    const males = parseInt(maleCount) || 0;
    const females = parseInt(femaleCount) || 0;
    const youngs = parseInt(youngCount) || 0;

    if (males + females + youngs <= 0) {
      setFormMsg({ type: 'error', text: 'Please enter at least one animal (Male, Female, or Young).' });
      return;
    }

    setSubmitting(true);
    setFormMsg({ type: '', text: '' });

    try {
      const payload = {
        tag_id: tagId.trim(),
        category,
        breed: breed.trim(),
        count_male: males,
        count_female: females,
        count_young: youngs,
        acquisition_date: acquisitionDate,
        acquisition_cost: Number(acquisitionCost) || 0,
        health_status: healthStatus,
        location_pen: locationPen.trim(),
        notes: notes.trim()
      };

      if (editingItem) {
        await updateRecord('general_livestock_detailed', { id: editingItem.id, ...payload });
      } else {
        await insertRecord('general_livestock_detailed', payload);
      }

      setShowAddModal(false);
    } catch (err) {
      console.error('Save livestock error:', err);
      setFormMsg({ type: 'error', text: err.message || 'Failed to save livestock record.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLivestock = async (id) => {
    if (!window.confirm('Are you sure you want to remove this livestock record?')) return;
    try {
      await deleteRecord('general_livestock_detailed', id);
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  };

  const handleExport = () => {
    if (rawList.length === 0) return alert('No records to export.');
    exportToExcel(`fazky_general_livestock_${new Date().toISOString().split('T')[0]}`, 'General Livestock', rawList);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border-farm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-dark-green">
            <Sparkles className="w-6 h-6 text-primary" />
            <span>General Livestock Management</span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Track non-poultry animals (Turkeys, Goats, Sheep, Cattle, Rabbits, Ducks) with health, headcount, and pen locations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className="bg-bg-farm hover:bg-border-farm/40 text-dark-green font-bold text-xs px-3.5 py-2.5 rounded-xl border border-border-farm flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {(role === 'admin' || role === 'manager') && (
            <button
              onClick={handleOpenAdd}
              className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Livestock Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Category Quick Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            selectedCategory === 'All' 
              ? 'bg-dark-green text-white border-dark-green shadow-md' 
              : 'bg-white text-text-primary border-border-farm hover:bg-emerald-50/50'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Total Animals</div>
          <div className="text-xl font-bold font-mono mt-1">{totalAllLivestock}</div>
          <div className="text-[9px] opacity-70">All categories</div>
        </button>

        {LIVESTOCK_CATEGORIES.slice(0, 6).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              selectedCategory === cat 
                ? 'bg-dark-green text-white border-dark-green shadow-md' 
                : 'bg-white text-text-primary border-border-farm hover:bg-emerald-50/50'
            }`}
          >
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 truncate">{cat}</div>
            <div className="text-xl font-bold font-mono mt-1">{categoryTotals[cat] || 0}</div>
            <div className="text-[9px] opacity-70">headcount</div>
          </button>
        ))}
      </div>

      {/* ── Registry Table & Search ── */}
      <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Tag ID, Breed, Category, or Location..."
              className="w-full bg-bg-farm border border-border-farm rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="text-xs text-text-muted">
            Showing <strong className="text-dark-green">{filteredList.length}</strong> batch / pen records
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border-farm/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                <th className="p-3.5">Tag / ID</th>
                <th className="p-3.5">Category & Breed</th>
                <th className="p-3.5 text-center">Male</th>
                <th className="p-3.5 text-center">Female</th>
                <th className="p-3.5 text-center">Young</th>
                <th className="p-3.5 text-center font-bold text-dark-green">Total</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Health</th>
                <th className="p-3.5">Acquisition</th>
                {(role === 'admin' || role === 'manager') && (
                  <th className="p-3.5 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-farm/50">
              {filteredList.length > 0 ? (
                filteredList.map((item) => {
                  const itemTotal = (Number(item.count_male) || 0) + (Number(item.count_female) || 0) + (Number(item.count_young) || 0);
                  return (
                    <tr key={item.id} className="hover:bg-bg-farm/40 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-dark-green">
                        {item.tag_id || '—'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-dark-green">{item.category}</div>
                        <div className="text-[10px] text-text-muted">{item.breed || 'Standard'}</div>
                      </td>
                      <td className="p-3.5 text-center font-mono">{item.count_male || 0}</td>
                      <td className="p-3.5 text-center font-mono">{item.count_female || 0}</td>
                      <td className="p-3.5 text-center font-mono">{item.count_young || 0}</td>
                      <td className="p-3.5 text-center font-bold font-mono text-dark-green bg-emerald-50/40">
                        {itemTotal}
                      </td>
                      <td className="p-3.5 text-text-muted flex items-center gap-1 mt-2.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{item.location_pen || 'General Pen'}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.health_status === 'Healthy' 
                            ? 'bg-emerald-100 text-dark-green'
                            : item.health_status === 'Quarantined'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.health_status || 'Healthy'}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-text-muted">
                        <div>{item.acquisition_date || '—'}</div>
                        {item.acquisition_cost > 0 && (
                          <div className="font-mono text-[10px] text-dark-green">₦{Number(item.acquisition_cost).toLocaleString()}</div>
                        )}
                      </td>
                      {(role === 'admin' || role === 'manager') && (
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-text-muted hover:text-dark-green hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLivestock(item.id)}
                              className="p-1.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-text-muted">
                    No livestock records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Livestock Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Sparkles className="w-5 h-5 text-accent" />
                <span>{editingItem ? 'Edit Livestock Record' : 'Add New Livestock Entry'}</span>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLivestock} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formMsg.text && (
                <div className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                  formMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-dark-green border border-emerald-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Tag / Batch ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={tagId}
                    onChange={(e) => setTagId(e.target.value)}
                    placeholder="e.g. TRK-01, GT-04"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    {LIVESTOCK_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Breed / Variety
                  </label>
                  <input
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="e.g. Nicholas White, Boer, Red Sokoto"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Location / Pen Name
                  </label>
                  <input
                    type="text"
                    value={locationPen}
                    onChange={(e) => setLocationPen(e.target.value)}
                    placeholder="e.g. Turkey Shed 1, Paddock B"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Headcount Grid */}
              <div className="p-3.5 bg-bg-farm rounded-2xl border border-border-farm space-y-2">
                <span className="block text-[10px] font-bold text-dark-green uppercase tracking-wider">
                  Headcount Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Male</label>
                    <input
                      type="number"
                      min="0"
                      value={maleCount}
                      onChange={(e) => setMaleCount(e.target.value)}
                      className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Female</label>
                    <input
                      type="number"
                      min="0"
                      value={femaleCount}
                      onChange={(e) => setFemaleCount(e.target.value)}
                      className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Kids / Young</label>
                    <input
                      type="number"
                      min="0"
                      value={youngCount}
                      onChange={(e) => setYoungCount(e.target.value)}
                      className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono text-center focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Acquisition Date
                  </label>
                  <input
                    type="date"
                    value={acquisitionDate}
                    onChange={(e) => setAcquisitionDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Cost (₦ Total)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={acquisitionCost}
                    onChange={(e) => setAcquisitionCost(e.target.value)}
                    placeholder="0"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Health Status
                  </label>
                  <select
                    value={healthStatus}
                    onChange={(e) => setHealthStatus(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Healthy">Healthy</option>
                    <option value="Observation">Observation</option>
                    <option value="Quarantined">Quarantined</option>
                    <option value="Sold">Sold / Offloaded</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Notes & Health Remarks
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Feed preferences, vaccination details, vendor info..."
                  className="w-full bg-bg-farm border border-border-farm rounded-xl p-3 text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
