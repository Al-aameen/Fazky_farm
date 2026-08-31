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

  // ── D4: 30-day Finished Feed Origin Breakdown (Purchased vs Milled) ──
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];

  const finishedFeedLogs30d = inventoryLog.filter(l => 
    l.date >= thirtyDaysStr && 
    l.change_amount > 0 && 
    (l.change_type === 'restock' || l.change_type === 'adjustment')
  );

  const milledBags30d = finishedFeedLogs30d
    .filter(l => l.source === 'feed_milling')
    .reduce((sum, l) => sum + (Number(l.change_amount) || 0), 0);

  const purchasedBags30d = finishedFeedLogs30d
    .filter(l => l.source !== 'feed_milling')
    .reduce((sum, l) => sum + (Number(l.change_amount) || 0), 0);

  const totalFinishedAdded30d = milledBags30d + purchasedBags30d;
  const milledPct = totalFinishedAdded30d > 0 ? Math.round((milledBags30d / totalFinishedAdded30d) * 100) : 0;
  const purchasedPct = totalFinishedAdded30d > 0 ? Math.round((purchasedBags30d / totalFinishedAdded30d) * 100) : 0;

  // Separate inventory into raw materials and finished feed
  const rawMaterials = inventory.filter(i => 
    i.item_type === 'raw_material' || 
    (!i.item_type && (
      i.item_name.toLowerCase().includes('maize') || 
      i.item_name.toLowerCase().includes('wheat') || 
      i.item_name.toLowerCase().includes('concentrate') || 
      i.item_name.toLowerCase().includes('premix') || 
      i.item_name.toLowerCase().includes('limestone')
    ))
  );

  const finishedFeeds = inventory.filter(i => 
    i.item_type === 'finished_feed' || 
    (!i.item_type && !rawMaterials.some(r => r.id === i.id))
  );

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

  const renderStockCard = (item) => {
    const isLow = item.current_stock <= item.low_stock_threshold;
    const pct = Math.min(100, Math.round((item.current_stock / (Math.max(1, item.low_stock_threshold * 3))) * 100));
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
              Unit: {item.unit} • {item.item_type === 'finished_feed' ? 'Finished Feed' : 'Raw Material'}
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
              Two-tier inventory monitoring: Raw materials for milling and finished feed for birds
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
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider block">Raw Materials / Finished</span>
            <span className="text-2xl font-serif font-black text-dark-green">
              {rawMaterials.length} <span className="text-sm font-sans font-normal text-text-muted">raw</span> • {finishedFeeds.length} <span className="text-sm font-sans font-normal text-text-muted">finished</span>
            </span>
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

      {/* ── 30-Day Finished Feed Origin Breakdown Banner (D4) ── */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <h4 className="font-serif font-bold text-dark-green text-sm">30-Day Finished Feed Origin Breakdown</h4>
          </div>
          <p className="text-xs text-text-muted font-sans">
            Total of {totalFinishedAdded30d.toLocaleString()} bags of finished feed stocked over the past 30 days
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-white px-3.5 py-2 rounded-xl border border-border-farm shadow-xs flex items-center gap-2.5">
            <span className="text-lg">🏭</span>
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase block">In-House Milled</span>
              <span className="font-serif font-bold text-xs text-dark-green">
                {milledBags30d.toLocaleString()} bags ({milledPct}%)
              </span>
            </div>
          </div>

          <div className="bg-white px-3.5 py-2 rounded-xl border border-border-farm shadow-xs flex items-center gap-2.5">
            <span className="text-lg">🚚</span>
            <div>
              <span className="text-[10px] text-text-muted font-bold uppercase block">Purchased Ready</span>
              <span className="font-serif font-bold text-xs text-blue-900">
                {purchasedBags30d.toLocaleString()} bags ({purchasedPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 1: Finished Feed (Fed to Birds) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-farm pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥣</span>
            <h2 className="font-serif font-bold text-lg text-dark-green">Finished Feed (Fed Directly to Birds)</h2>
          </div>
          <span className="text-xs text-text-muted font-mono font-semibold">{finishedFeeds.length} items</span>
        </div>

        {finishedFeeds.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-text-muted text-xs border border-border-farm">
            No finished feed inventory recorded.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {finishedFeeds.map(renderStockCard)}
          </div>
        )}
      </div>

      {/* ── Section 2: Raw Materials (For Milling) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-farm pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <h2 className="font-serif font-bold text-lg text-dark-green">Raw Materials (For In-House Feed Milling)</h2>
          </div>
          <span className="text-xs text-text-muted font-mono font-semibold">{rawMaterials.length} items</span>
        </div>

        {rawMaterials.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-text-muted text-xs border border-border-farm">
            No raw material inventory recorded.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rawMaterials.map(renderStockCard)}
          </div>
        )}
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
