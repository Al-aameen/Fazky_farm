import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { Plus, Hammer, Tractor, Boxes, History, ChevronRight, AlertTriangle, Download, Upload } from 'lucide-react';
import { exportToExcel, parseImportFile } from '../lib/csvExportImport';

export default function Procurement() {
  const { data, insertRecord, updateRecord, bulkInsertRecords } = useData();
  const { role } = useAuth();
  const maizeImportRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('maize'); // 'maize', 'production', 'inventory'
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null); // id of feed_inventory

  // Modal forms states
  const [showAddMaize, setShowAddMaize] = useState(false);
  const [showAddProduction, setShowAddProduction] = useState(false);
  const [showRestock, setShowRestock] = useState(false);

  // Maize form inputs
  const [mzDate, setMzDate] = useState(new Date().toISOString().split('T')[0]);
  const [mzSeller, setMzSeller] = useState('');
  const [mzKg, setMzKg] = useState('');
  const [mzBags, setMzBags] = useState('');
  const [mzAmount, setMzAmount] = useState('');

  // Production form inputs
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
  const [prodMaize, setProdMaize] = useState('');
  const [prodWheat, setProdWheat] = useState('');
  const [prodConcentrate, setProdConcentrate] = useState('');
  const [prodSoya, setProdSoya] = useState('');
  const [prodPremix, setProdPremix] = useState('');
  const [prodTonnes, setProdTonnes] = useState('');
  const [prodBags, setProdBags] = useState('');

  // Restock form inputs
  const [restockAmount, setRestockAmount] = useState('');
  const [restockType, setRestockType] = useState('restock'); // 'restock', 'adjustment'
  const [restockNotes, setRestockNotes] = useState('');

  const handleAddMaizeSubmit = async (e) => {
    e.preventDefault();
    const kg = parseFloat(mzKg);
    const bags = parseInt(mzBags, 10);
    const amt = parseFloat(mzAmount);

    if (!mzSeller || isNaN(kg) || isNaN(bags) || isNaN(amt)) return;

    try {
      // 1. Log maize record
      await insertRecord('maize_records', {
        date: mzDate,
        seller_name: mzSeller,
        kg_procured: kg,
        bag_number: bags,
        total_amount: amt
      });

      // 2. Also restock Maize raw ingredient in inventory (Phase 2 trigger)
      const maizeInv = (data.feed_inventory || []).find(fi => fi.item_name === 'Maize');
      if (maizeInv) {
        const updated = {
          ...maizeInv,
          current_stock: maizeInv.current_stock + kg,
          last_updated: new Date().toISOString()
        };
        await updateRecord('feed_inventory', updated);

        // Add log
        await insertRecord('feed_inventory_log', {
          inventory_id: maizeInv.id,
          date: mzDate,
          change_amount: kg,
          change_type: 'restock',
          source: 'Maize Procurement',
          notes: `Procured from ${mzSeller} (Receipt of ${bags} bags)`
        });
      }

      setShowAddMaize(false);
      setMzSeller('');
      setMzKg('');
      setMzBags('');
      setMzAmount('');
    } catch (err) {
      console.error('Failed to log maize procurement:', err);
    }
  };

  const handleAddProductionSubmit = async (e) => {
    e.preventDefault();
    const maize = parseFloat(prodMaize) || 0;
    const wheat = parseInt(prodWheat, 10) || 0;
    const conc = parseInt(prodConcentrate, 10) || 0;
    const soya = parseFloat(prodSoya) || 0;
    const premix = parseFloat(prodPremix) || 0;
    const tonnes = parseFloat(prodTonnes) || 0;
    const bags = parseInt(prodBags, 10) || 0;

    try {
      // Log Feed Production (which fires handleFeedProductionTrigger in useData to deduct/add stock)
      await insertRecord('feed_production', {
        date: prodDate,
        maize_kg: maize,
        wheat_offal_bags: wheat,
        concentrate_bags: conc,
        soya_beans_qty: soya,
        premix_qty: premix,
        feed_produced_tonnes: tonnes,
        bags_produced: bags
      });

      setShowAddProduction(false);
      setProdMaize('');
      setProdWheat('');
      setProdConcentrate('');
      setProdSoya('');
      setProdPremix('');
      setProdTonnes('');
      setProdBags('');
    } catch (err) {
      console.error('Failed to save feed production:', err);
    }
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(restockAmount);
    if (isNaN(amt) || !selectedInventoryItem) return;

    try {
      const invItem = (data.feed_inventory || []).find(fi => fi.id === selectedInventoryItem);
      if (!invItem) return;

      const changeVal = restockType === 'restock' ? amt : -amt;
      const updated = {
        ...invItem,
        current_stock: invItem.current_stock + changeVal,
        last_updated: new Date().toISOString()
      };
      
      await updateRecord('feed_inventory', updated);

      await insertRecord('feed_inventory_log', {
        inventory_id: invItem.id,
        date: new Date().toISOString().split('T')[0],
        change_amount: changeVal,
        change_type: restockType === 'restock' ? 'restock' : 'adjustment',
        source: 'Manual Adjustment',
        notes: restockNotes || 'Manual update'
      });

      setShowRestock(false);
      setRestockAmount('');
      setRestockNotes('');
    } catch (err) {
      console.error('Failed to adjust inventory:', err);
    }
  };

  // Get logs for selected inventory item
  const getLogsForItem = (invId) => {
    return (data.feed_inventory_log || [])
      .filter(l => l.inventory_id === invId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tab Menu Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border-farm pb-3">
        <div className="flex bg-white p-1 rounded-xl border border-border-farm shadow-sm">
          <button
            onClick={() => setActiveTab('maize')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'maize'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Tractor className="w-3.5 h-3.5" />
            Maize Procurement
          </button>
          <button
            onClick={() => setActiveTab('production')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'production'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            Feed Production
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'inventory'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Feed Inventory (Phase 2)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'maize' && (
            <>
              {/* Import CSV/Excel */}
              <input
                type="file"
                ref={maizeImportRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const rows = await parseImportFile(file);
                    const result = await bulkInsertRecords('maize_records', rows);
                    alert(`✅ Imported ${result?.count ?? rows.length} maize records successfully.`);
                  } catch (err) {
                    alert('❌ Import failed: ' + err.message);
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => maizeImportRef.current?.click()}
                className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-dark-green font-bold px-3 py-2 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
                title="Import Maize Records from CSV or Excel file"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Import CSV/Excel</span>
              </button>
              <button
                type="button"
                onClick={() => exportToExcel('fazky_maize_records', 'Maize', data.maize_records || [])}
                className="flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-dark-green font-bold px-3 py-2 rounded-lg text-xs border border-border-farm shadow-sm transition-all"
                title="Export Maize Records to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowAddMaize(true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                Log Maize Purchase
              </button>
            </>
          )}

          {activeTab === 'production' && (
            <button
              onClick={() => setShowAddProduction(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-lg text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Log Milling Production
            </button>
          )}
        </div>
      </div>

      {/* Maize Tab */}
      {activeTab === 'maize' && (
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-serif text-dark-green font-bold text-base">Maize Procurement Ledger</h3>
          
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Seller Name</th>
                  <th className="p-3 text-right">KG Procured</th>
                  <th className="p-3 text-center">Bags Count</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-right font-bold text-primary">Avg Price / KG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {(data.maize_records || []).length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-text-muted font-sans text-xs">
                      No maize records logged. Click "Log Maize Purchase" to record a delivery.
                    </td>
                  </tr>
                ) : (
                  [...(data.maize_records || [])]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(row => (
                      <tr key={row.id} className="hover:bg-bg-farm/20">
                        <td className="p-3 font-mono font-bold text-text-primary">{row.date}</td>
                        <td className="p-3 font-bold text-text-primary">{row.seller_name}</td>
                        <td className="p-3 text-right font-mono">{row.kg_procured.toLocaleString()} kg</td>
                        <td className="p-3 text-center font-mono">{row.bag_number} bags</td>
                        <td className="p-3 text-right font-mono">₦{row.total_amount.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          ₦{(row.total_amount / (row.kg_procured || 1)).toFixed(1)} / kg
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Production Tab */}
      {activeTab === 'production' && (
        <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-serif text-dark-green font-bold text-base">Milling Production Sessions</h3>
          
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Maize Used</th>
                  <th className="p-3 text-center">Wheat Offal Used</th>
                  <th className="p-3 text-center">Concentrate Used</th>
                  <th className="p-3 text-center">Soya Used</th>
                  <th className="p-3 text-center">Premix Used</th>
                  <th className="p-3 text-right bg-green-50/50 text-dark-green font-black">Feed Output</th>
                  <th className="p-3 text-center font-bold text-primary">Bags Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/60">
                {(data.feed_production || []).length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-text-muted font-sans text-xs">
                      No feed milling production logged. Click "Log Milling Production" to record a mixing session.
                    </td>
                  </tr>
                ) : (
                  [...(data.feed_production || [])]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(row => (
                      <tr key={row.id} className="hover:bg-bg-farm/20">
                        <td className="p-3 font-mono font-bold text-text-primary">{row.date}</td>
                        <td className="p-3 text-center font-mono">{row.maize_kg.toLocaleString()} kg</td>
                        <td className="p-3 text-center font-mono">{row.wheat_offal_bags} bags</td>
                        <td className="p-3 text-center font-mono">{row.concentrate_bags} bags</td>
                        <td className="p-3 text-center font-mono">{row.soya_beans_qty.toLocaleString()} kg</td>
                        <td className="p-3 text-center font-mono">{row.premix_qty.toLocaleString()} kg</td>
                        <td className="p-3 text-right font-mono bg-green-50/20 font-black text-dark-green">
                          {row.feed_produced_tonnes.toLocaleString()} tonnes
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-primary">
                          {row.bags_produced} bags
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-fade-in">
          {/* Feed ingredient status cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data.feed_inventory || []).map(item => {
              const isLow = item.current_stock <= item.low_stock_threshold;
              const isSelected = selectedInventoryItem === item.id;
              
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedInventoryItem(item.id)}
                  className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary border-2 ring-2 ring-accent/20' : 'border-border-farm'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-serif text-dark-green font-bold text-base">{item.item_name}</h4>
                      <p className="text-[9px] text-text-muted mt-0.5">Last updated: {item.last_updated ? new Date(item.last_updated).toLocaleString() : '—'}</p>
                    </div>
                    {isLow ? (
                      <span className="flex items-center gap-0.5 bg-red-50 text-red-accent border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </span>
                    ) : (
                      <span className="bg-green-50 text-primary border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Normal
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-serif font-black text-dark-green">
                      {item.current_stock.toLocaleString()}
                    </span>
                    <span className="text-xs text-text-muted font-bold">{item.unit}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-farm/50 flex justify-between items-center">
                    <span className="text-[10px] text-text-muted font-bold">Min Threshold: {item.low_stock_threshold} {item.unit}</span>
                    {role === 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInventoryItem(item.id);
                          setShowRestock(true);
                        }}
                        className="bg-bg-farm hover:bg-light-green border border-border-farm text-primary font-bold px-3 py-1 rounded-lg text-[10px] transition-all"
                      >
                        Adjust / Restock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audit Logs for selected item */}
          {selectedInventoryItem && (
            <div className="bg-white border border-border-farm rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 border-b border-border-farm pb-3">
                <History className="w-4.5 h-4.5 text-primary" />
                <h3 className="font-serif text-dark-green font-bold text-base">
                  Change Log: { (data.feed_inventory || []).find(fi => fi.id === selectedInventoryItem)?.item_name }
                </h3>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="bg-bg-farm border-b border-border-farm font-bold text-text-muted uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Change Qty</th>
                      <th className="p-3">Operation Type</th>
                      <th className="p-3">Source Module</th>
                      <th className="p-3">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-farm/60">
                    {getLogsForItem(selectedInventoryItem).length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-6 text-center text-text-muted font-sans text-xs">
                          No audit log transactions found for this item.
                        </td>
                      </tr>
                    ) : (
                      getLogsForItem(selectedInventoryItem).map(log => (
                        <tr key={log.id} className="hover:bg-bg-farm/20">
                          <td className="p-3 font-mono font-semibold text-text-primary">{log.date}</td>
                          <td className={`p-3 text-center font-mono font-bold ${log.change_amount > 0 ? 'text-primary' : 'text-red-accent'}`}>
                            {log.change_amount > 0 ? `+${log.change_amount.toLocaleString()}` : log.change_amount.toLocaleString()}
                          </td>
                          <td className="p-3 uppercase tracking-wider font-bold text-[10px]">
                            {log.change_type}
                          </td>
                          <td className="p-3 text-text-primary font-medium">{log.source}</td>
                          <td className="p-3 text-text-muted italic">{log.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* 1. Log Maize Shipment */}
      {showAddMaize && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[400px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Maize Procurement</span>
              <button 
                onClick={() => setShowAddMaize(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddMaizeSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  required
                  value={mzDate}
                  onChange={(e) => setMzDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Seller Name
                </label>
                <input
                  type="text"
                  required
                  value={mzSeller}
                  onChange={(e) => setMzSeller(e.target.value)}
                  placeholder="e.g. Kano Grains Depot"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Weight Procured (KG)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={mzKg}
                    onChange={(e) => setMzKg(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Number of Bags
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={mzBags}
                    onChange={(e) => setMzBags(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Total Amount Paid (₦)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={mzAmount}
                  onChange={(e) => setMzAmount(e.target.value)}
                  placeholder="e.g. 120000"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddMaize(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Log Feed Production (Milling) */}
      {showAddProduction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[480px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Log Milling Feed Production</span>
              <button 
                onClick={() => setShowAddProduction(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProductionSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Production Date
                </label>
                <input
                  type="date"
                  required
                  value={prodDate}
                  onChange={(e) => setProdDate(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider border-b border-border-farm pb-1">
                Ingredients Consumed
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-wider mb-1">
                    Maize (KG)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodMaize}
                    onChange={(e) => setProdMaize(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-wider mb-1">
                    Wheat Offal (Bags)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodWheat}
                    onChange={(e) => setProdWheat(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-wider mb-1">
                    Concentrate (Bags)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodConcentrate}
                    onChange={(e) => setProdConcentrate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-wider mb-1">
                    Soya Beans (KG)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodSoya}
                    onChange={(e) => setProdSoya(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-muted uppercase tracking-wider mb-1">
                    Premix (KG)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={prodPremix}
                    onChange={(e) => setProdPremix(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-2 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider border-b border-border-farm pb-1 pt-2">
                Finished Feed Output
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Total Output (Tonnes)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodTonnes}
                    onChange={(e) => setProdTonnes(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Bags Packed
                  </label>
                  <input
                    type="number"
                    required
                    value={prodBags}
                    onChange={(e) => setProdBags(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowAddProduction(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Save Mixing Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Manual Restock / Adjustment Modal */}
      {showRestock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-border-farm shadow-2xl max-w-[360px] w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-4 text-white font-serif font-bold text-base flex justify-between items-center">
              <span>Adjust Ingredient Stock</span>
              <button 
                onClick={() => setShowRestock(false)}
                className="text-white/60 hover:text-white font-sans text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRestockSubmit} className="p-6 space-y-4 font-sans text-xs">
              <div>
                <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Item Name</div>
                <div className="bg-bg-farm border border-border-farm rounded-lg px-3 py-2 font-bold text-text-primary text-sm">
                  { (data.feed_inventory || []).find(fi => fi.id === selectedInventoryItem)?.item_name }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Adjustment Quantity
                  </label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="any"
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-semibold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Action Type
                  </label>
                  <select
                    value={restockType}
                    onChange={(e) => setRestockType(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none font-bold text-text-primary"
                  >
                    <option value="restock">Restock (+)</option>
                    <option value="adjustment">Deduct (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Reason / Notes
                </label>
                <textarea
                  required
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="e.g. Manual count adjustment, warehouse loss, extra restock donation"
                  rows="2"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-border-farm">
                <button
                  type="button"
                  onClick={() => setShowRestock(false)}
                  className="px-4 py-2 border border-border-farm hover:bg-bg-farm rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-dark-green text-white rounded-lg font-bold shadow-sm"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
