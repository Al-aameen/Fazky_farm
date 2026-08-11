import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  Plus, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  History, 
  Scale, 
  Clock, 
  Layers
} from 'lucide-react';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';

export default function FeedWatch() {
  const { data, insertRecord, updateRecord, bulkInsertRecords } = useData();
  const { role, worker } = useAuth();
  const importRef = useRef(null);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [changeType, setChangeType] = useState('restock'); // restock, consumption, adjustment
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inventory = data.feed_inventory || [];
  const inventoryLog = data.feed_inventory_log || [];

  // Calculate daily average feed consumption from production log
  const calculateAvgDailyFeed = () => {
    const logs = data.production_log || [];
    if (logs.length === 0) return 40; // default 40 bags/kg per day
    const totalFeed = logs.reduce((sum, log) => sum + (parseFloat(log.total_feed) || 0), 0);
    const uniqueDates = new Set(logs.map(l => l.date)).size || 1;
    return Math.max(1, totalFeed / uniqueDates);
  };

  const avgDailyFeed = calculateAvgDailyFeed();

  // Handle restock/adjustment submit
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFeedItem || !restockAmount) return;

    setSubmitting(true);
    try {
      const amountNum = parseFloat(restockAmount);
      const isDeduction = changeType === 'consumption';
      const actualChange = isDeduction ? -amountNum : amountNum;
      const newStock = Math.max(0, (selectedFeedItem.current_stock || 0) + actualChange);

      // 1. Update Inventory Table
      await updateRecord('feed_inventory', {
        id: selectedFeedItem.id,
        current_stock: newStock,
        last_updated: new Date().toISOString()
      });

      // 2. Add log entry
      await insertRecord('feed_inventory_log', {
        inventory_id: selectedFeedItem.id,
        date: new Date().toISOString().split('T')[0],
        change_amount: actualChange,
        change_type: changeType,
        source: worker?.name || 'Admin',
        notes: notes || `${changeType} recorded`
      });

      setShowRestockModal(false);
      setRestockAmount('');
      setNotes('');
    } catch (err) {
      console.error('Error logging feed restock:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-farm pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-dark-green rounded-xl shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-green">Feed & Stock Watch</h1>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              Live inventory monitoring, low-stock threshold gauges, and predictive supply depletion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden file input for import */}
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
                const result = await bulkInsertRecords('feed_inventory_log', rows);
                alert(`✅ Imported ${result?.count ?? rows.length} feed records successfully.`);
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
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
          >
            <span className="text-blue-600 font-bold text-base leading-none">↑</span>
            <span>Import</span>
          </button>
          <button
            onClick={() => exportToExcel('fazky_feed_inventory', 'Feed Inventory', inventory)}
            className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3.5 py-2 rounded-xl text-xs border border-border-farm shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Stock Report</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-dark-green rounded-xl">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Total Feed Types</span>
            <span className="text-2xl font-serif font-black text-dark-green">{inventory.length}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Avg Daily Consumption</span>
            <span className="text-2xl font-serif font-black text-dark-green">
              {avgDailyFeed.toFixed(1)} <span className="text-xs font-sans text-text-muted">units/day</span>
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-farm shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-accent rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Low Stock Alerts</span>
            <span className="text-2xl font-serif font-black text-red-accent">
              {inventory.filter(item => item.current_stock <= item.low_stock_threshold).length}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory Stock Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventory.map((item) => {
          const isLow = item.current_stock <= item.low_stock_threshold;
          const pct = Math.min(100, Math.round((item.current_stock / (item.low_stock_threshold * 3)) * 100));
          const estimatedDaysLeft = Math.max(0, Math.floor(item.current_stock / (avgDailyFeed / (inventory.length || 1))));

          return (
            <div 
              key={item.id} 
              className={`bg-white p-5 rounded-2xl border transition-all shadow-sm space-y-4 ${
                isLow ? 'border-amber-300 ring-2 ring-amber-100' : 'border-border-farm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-dark-green text-base">{item.item_name}</h3>
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-wide">
                    Unit: {item.unit}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-dark-green'
                }`}>
                  {isLow ? '⚠️ Low Stock' : '✅ Adequate'}
                </span>
              </div>

              {/* Progress Gauge Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-text-muted">Stock Level</span>
                  <span className="text-dark-green">{item.current_stock} {item.unit}</span>
                </div>
                <div className="h-3 w-full bg-bg-farm rounded-full overflow-hidden p-0.5 border border-border-farm">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isLow ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>Threshold: {item.low_stock_threshold} {item.unit}</span>
                  <span className="font-semibold text-dark-green">~{estimatedDaysLeft} days remaining</span>
                </div>
              </div>

              {/* Quick Restock Action Button */}
              <button
                onClick={() => {
                  setSelectedFeedItem(item);
                  setShowRestockModal(true);
                }}
                className="w-full py-2 bg-bg-farm hover:bg-emerald-50 text-dark-green border border-border-farm font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Adjust / Restock Stock</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Restock & Stock Adjustment Modal */}
      {showRestockModal && selectedFeedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-border-farm shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <h3 className="font-serif font-bold text-dark-green text-lg">
                Update Stock: {selectedFeedItem.item_name}
              </h3>
              <button 
                onClick={() => setShowRestockModal(false)}
                className="text-text-muted hover:text-dark-green font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Action Type
                </label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent"
                >
                  <option value="restock">➕ Restock (Add Stock)</option>
                  <option value="consumption">➖ Consumption (Subtract)</option>
                  <option value="adjustment">🔄 Stock Audit Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Quantity ({selectedFeedItem.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  placeholder={`Enter amount in ${selectedFeedItem.unit}`}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Notes / Source
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Supplier delivery invoice #402"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="flex-1 py-2 bg-bg-farm text-text-primary font-bold text-xs rounded-xl border border-border-farm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-dark-green text-white font-bold text-xs rounded-xl hover:bg-emerald-900 shadow-sm"
                >
                  {submitting ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
