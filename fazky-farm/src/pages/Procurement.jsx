import React, { useState, useRef } from 'react';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/DatePicker';
import { exportToExcel } from '../lib/csvExportImport';
import { 
  Package, 
  Boxes, 
  Plus, 
  Hammer, 
  TrendingDown, 
  History, 
  Download, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Truck, 
  Layers, 
  Grid, 
  RefreshCw,
  Wheat,
  Calculator,
  ArrowRight
} from 'lucide-react';

const TABS = [
  { id: 'overview',   label: 'Stock Overview',            icon: Boxes },
  { id: 'maize',      label: 'Maize Purchases & Multi-Bag Grid', icon: Wheat },
  { id: 'finished',   label: 'Finished Feed Purchases',   icon: Package },
  { id: 'production', label: 'In-House Feed Milling',     icon: Hammer },
  { id: 'logs',       label: 'Movement Ledger',           icon: History },
];

export default function Procurement() {
  const { data, insertRecord, updateRecord, deleteRecord, isOnline } = useData();
  const { role, worker } = useAuth();
  const canEdit = role === 'admin' || role === 'manager';

  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // ── Modal States ──
  const [showMaizeGridModal, setShowMaizeGridModal] = useState(false);
  const [showFinishedFeedModal, setShowFinishedFeedModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);

  // ── Multi-Bag Maize Grid Form State (Item X & XVII) ──
  const [mzDate, setMzDate] = useState(new Date().toISOString().split('T')[0]);
  const [mzSeller, setMzSeller] = useState('');
  const [mzPricePerKg, setMzPricePerKg] = useState('');
  const [mzTransportCost, setMzTransportCost] = useState('');
  const [mzHandlingCost, setMzHandlingCost] = useState('');
  const [mzAutoLogExpense, setMzAutoLogExpense] = useState(true);
  const [mzBagWeights, setMzBagWeights] = useState([50, 50, 50, 50, 50]); // initial 5 bags
  const [mzSubmitting, setMzSubmitting] = useState(false);

  // ── Finished Feed Purchase Form State (Item XX) ──
  const [ffDate, setFfDate] = useState(new Date().toISOString().split('T')[0]);
  const [ffFeedType, setFfFeedType] = useState('Layers Mash');
  const [ffVendor, setFfVendor] = useState('');
  const [ffBags, setFfBags] = useState('');
  const [ffCostPerBag, setFfCostPerBag] = useState('');
  const [ffTransport, setFfTransport] = useState('');
  const [ffAutoExpense, setFfAutoExpense] = useState(true);
  const [ffSubmitting, setFfSubmitting] = useState(false);

  // ── In-House Milling Production Form State ──
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
  const [prodTargetFeed, setProdTargetFeed] = useState('Layers Mash');
  const [prodMaizeKg, setProdMaizeKg] = useState('');
  const [prodWheatBags, setProdWheatBags] = useState('');
  const [prodConcBags, setProdConcBags] = useState('');
  const [prodPremixKg, setProdPremixKg] = useState('');
  const [prodLimestoneBags, setProdLimestoneBags] = useState('');
  const [prodBagsProduced, setProdBagsProduced] = useState('');
  const [prodSubmitting, setProdSubmitting] = useState(false);

  // ── Stock Manual Adjustment Form State ──
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('restock');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Data lists
  const feedInventory = data.feed_inventory || [];
  const maizeRecords = data.maize_records || [];
  const feedProduction = data.feed_production || [];
  const inventoryLogs = data.feed_inventory_log || [];

  // Maize Grid Computations
  const totalMaizeKg = mzBagWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
  const totalMaizeBags = mzBagWeights.filter(w => (parseFloat(w) || 0) > 0).length;
  const avgWeightPerBag = totalMaizeBags > 0 ? (totalMaizeKg / totalMaizeBags).toFixed(1) : 0;
  const maizeGrainCost = totalMaizeKg * (parseFloat(mzPricePerKg) || 0);
  const maizeGrandTotal = maizeGrainCost + (parseFloat(mzTransportCost) || 0) + (parseFloat(mzHandlingCost) || 0);

  // Handle Adding / Removing bags in Maize Grid
  const handleAddBagToGrid = () => {
    setMzBagWeights(prev => [...prev, 50]);
  };

  const handleRemoveBagFromGrid = (index) => {
    setMzBagWeights(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateBagWeight = (index, val) => {
    setMzBagWeights(prev => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  // Submit Maize Purchase with Multi-Bag Grid
  const handleSaveMaizePurchase = async (e) => {
    e.preventDefault();
    if (!mzSeller.trim() || totalMaizeKg <= 0) {
      alert('Please enter vendor name and valid bag weights.');
      return;
    }

    setMzSubmitting(true);
    try {
      // 1. Insert into maize_records
      await insertRecord('maize_records', {
        date: mzDate,
        seller_name: mzSeller.trim(),
        kg_procured: totalMaizeKg,
        bag_number: totalMaizeBags,
        total_amount: maizeGrandTotal,
        notes: `Avg: ${avgWeightPerBag}kg/bag. Price/kg: ₦${mzPricePerKg || 0}. Trans: ₦${mzTransportCost || 0}.`
      });

      // 2. Restock Maize in feed_inventory
      const maizeInv = feedInventory.find(fi => fi.item_name.toLowerCase().includes('maize'));
      if (maizeInv) {
        await updateRecord('feed_inventory', {
          id: maizeInv.id,
          current_stock: Number(maizeInv.current_stock || 0) + totalMaizeKg,
          last_updated: new Date().toISOString()
        });

        // Add to movement log
        await insertRecord('feed_inventory_log', {
          inventory_id: maizeInv.id,
          date: mzDate,
          change_amount: totalMaizeKg,
          change_type: 'restock',
          source: 'Maize Procurement',
          notes: `Purchased ${totalMaizeBags} bags (${totalMaizeKg}kg) from ${mzSeller.trim()}`
        });
      }

      // 3. Optional Auto-Expense Log for Transport / Misc (Item XVII)
      const extraExpense = (parseFloat(mzTransportCost) || 0) + (parseFloat(mzHandlingCost) || 0);
      if (mzAutoLogExpense && extraExpense > 0) {
        await insertRecord('expenses_log', {
          date: mzDate,
          category: 'Transport & Logistics',
          description: `Transport & offloading for ${totalMaizeBags} bags maize (${mzSeller.trim()})`,
          amount: extraExpense,
          payment_method: 'Cash',
          recipient: mzSeller.trim()
        });
      }

      setShowMaizeGridModal(false);
      setMzSeller('');
      setMzPricePerKg('');
      setMzTransportCost('');
      setMzHandlingCost('');
      setMzBagWeights([50, 50, 50, 50, 50]);
    } catch (err) {
      console.error('Failed to log maize purchase:', err);
      alert('Error: ' + err.message);
    } finally {
      setMzSubmitting(false);
    }
  };

  // Submit Finished Feed Purchase (Item XX)
  const handleSaveFinishedFeedPurchase = async (e) => {
    e.preventDefault();
    const bags = parseInt(ffBags);
    const costPerBag = parseFloat(ffCostPerBag) || 0;
    const transport = parseFloat(ffTransport) || 0;

    if (!bags || bags <= 0 || costPerBag <= 0) {
      alert('Please enter valid bags count and cost per bag.');
      return;
    }

    setFfSubmitting(true);
    try {
      const feedCost = bags * costPerBag;
      const grandTotal = feedCost + transport;

      // 1. Restock Finished Feed in feed_inventory
      const targetFeedInv = feedInventory.find(fi => fi.item_name.toLowerCase().includes(ffFeedType.toLowerCase()));
      if (targetFeedInv) {
        await updateRecord('feed_inventory', {
          id: targetFeedInv.id,
          current_stock: Number(targetFeedInv.current_stock || 0) + bags,
          last_updated: new Date().toISOString()
        });

        // Add to movement log
        await insertRecord('feed_inventory_log', {
          inventory_id: targetFeedInv.id,
          date: ffDate,
          change_amount: bags,
          change_type: 'restock',
          source: 'Finished Feed Purchase',
          notes: `Direct purchase of ${bags} bags ${ffFeedType} from ${ffVendor || 'Vendor'}`
        });
      }

      // 2. Auto-log Feed Purchase Expense
      if (ffAutoExpense) {
        await insertRecord('expenses_log', {
          date: ffDate,
          category: 'Feed Purchase',
          description: `Direct purchase of ${bags} bags ${ffFeedType} (@ ₦${costPerBag.toLocaleString()}/bag)` + (transport > 0 ? ` + ₦${transport.toLocaleString()} transport` : ''),
          amount: grandTotal,
          payment_method: 'Transfer',
          recipient: ffVendor || 'Feed Supplier'
        });
      }

      setShowFinishedFeedModal(false);
      setFfVendor('');
      setFfBags('');
      setFfCostPerBag('');
      setFfTransport('');
    } catch (err) {
      console.error('Failed to log finished feed purchase:', err);
      alert('Error: ' + err.message);
    } finally {
      setFfSubmitting(false);
    }
  };

  // Submit In-House Feed Production
  const handleSaveProduction = async (e) => {
    e.preventDefault();
    const produced = parseInt(prodBagsProduced) || 0;
    if (produced <= 0) {
      alert('Please enter number of bags produced.');
      return;
    }

    setProdSubmitting(true);
    try {
      // 1. Log to feed_production
      await insertRecord('feed_production', {
        date: prodDate,
        maize_kg: parseFloat(prodMaizeKg) || 0,
        wheat_offal_bags: parseInt(prodWheatBags) || 0,
        concentrate_bags: parseInt(prodConcBags) || 0,
        premix_qty: parseFloat(prodPremixKg) || 0,
        feed_produced_tonnes: (produced * 25) / 1000,
        bags_produced: produced
      });

      // 2. Restock Produced Finished Feed
      const finishedInv = feedInventory.find(fi => fi.item_name.toLowerCase().includes(prodTargetFeed.toLowerCase()));
      if (finishedInv) {
        await updateRecord('feed_inventory', {
          id: finishedInv.id,
          current_stock: Number(finishedInv.current_stock || 0) + produced,
          last_updated: new Date().toISOString()
        });

        await insertRecord('feed_inventory_log', {
          inventory_id: finishedInv.id,
          date: prodDate,
          change_amount: produced,
          change_type: 'production',
          source: 'In-House Feed Milling',
          notes: `Produced ${produced} bags (${prodTargetFeed}) from raw ingredients`
        });
      }

      // 3. Deduct Raw Ingredients from feed_inventory
      const maizeInv = feedInventory.find(fi => fi.item_name.toLowerCase().includes('maize'));
      if (maizeInv && parseFloat(prodMaizeKg) > 0) {
        const remaining = Math.max(0, Number(maizeInv.current_stock || 0) - parseFloat(prodMaizeKg));
        await updateRecord('feed_inventory', { id: maizeInv.id, current_stock: remaining });
      }

      setShowProductionModal(false);
      setProdMaizeKg('');
      setProdWheatBags('');
      setProdConcBags('');
      setProdPremixKg('');
      setProdBagsProduced('');
    } catch (err) {
      console.error('Failed to log feed milling:', err);
      alert('Error: ' + err.message);
    } finally {
      setProdSubmitting(false);
    }
  };

  // Submit Manual Stock Adjustment
  const handleSaveStockAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedStockItem || !adjustQty) return;
    setAdjustSubmitting(true);
    try {
      const qty = parseFloat(adjustQty);
      const newStock = adjustType === 'restock'
        ? Number(selectedStockItem.current_stock || 0) + qty
        : Math.max(0, Number(selectedStockItem.current_stock || 0) - qty);

      await updateRecord('feed_inventory', {
        id: selectedStockItem.id,
        current_stock: newStock,
        last_updated: new Date().toISOString()
      });

      await insertRecord('feed_inventory_log', {
        inventory_id: selectedStockItem.id,
        date: new Date().toISOString().split('T')[0],
        change_amount: qty,
        change_type: adjustType,
        source: 'Manual Adjustment',
        notes: adjustNotes.trim() || 'Manual stock update by manager'
      });

      setShowRestockModal(false);
      setSelectedStockItem(null);
      setAdjustQty('');
      setAdjustNotes('');
    } catch (err) {
      console.error('Stock adjust error:', err);
      alert('Error: ' + err.message);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-border-farm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-serif font-bold text-xl sm:text-2xl text-dark-green">
            <Package className="w-6 h-6 text-primary" />
            <span>Feed & Procurement Hub</span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Unified management for finished feeds, raw ingredient milling, multi-bag maize weighbridge grids, and stock logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportToExcel('fazky_feed_procurement', 'Feed Stock', feedInventory)}
            className="bg-bg-farm hover:bg-border-farm/40 text-dark-green font-bold text-xs px-3.5 py-2.5 rounded-xl border border-border-farm flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export Stock</span>
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => setShowFinishedFeedModal(true)}
                className="bg-dark-green hover:bg-emerald-900 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Package className="w-4 h-4" />
                <span>+ Buy Finished Feed</span>
              </button>

              <button
                onClick={() => setShowMaizeGridModal(true)}
                className="bg-primary hover:bg-dark-green text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <Calculator className="w-4 h-4" />
                <span>+ Log Maize (Multi-Bag Grid)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex flex-wrap gap-1.5 border-b border-border-farm pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-dark-green text-white shadow-md'
                  : 'text-text-muted hover:text-dark-green hover:bg-bg-farm'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Stock Overview (Finished Feeds vs Raw Ingredients) ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Finished Feeds Section */}
          <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-dark-green flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span>Finished Feeds (Fed Directly to Birds)</span>
                </h3>
                <p className="text-[11px] text-text-muted">Chick Mash, Grower Mash, and Layers Mash counted in bags (25kg/bag)</p>
              </div>
              <span className="text-xs font-bold text-dark-green bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                1 Bag = 25 kg
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {feedInventory.filter(fi => ['Chick Mash', 'Grower Mash', 'Layers Mash'].some(name => fi.item_name.includes(name))).map(item => {
                const stock = Number(item.current_stock) || 0;
                const isLow = stock <= (Number(item.low_stock_threshold) || 10);
                return (
                  <div key={item.id} className="p-4 bg-bg-farm rounded-2xl border border-border-farm space-y-3 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-sm text-dark-green">{item.item_name}</div>
                        <div className="text-[11px] text-text-muted">{item.category || 'Finished Feed'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-dark-green'
                      }`}>
                        {isLow ? 'Low Stock' : 'Good'}
                      </span>
                    </div>

                    <div>
                      <div className="text-3xl font-bold font-mono text-dark-green">{stock.toLocaleString()}</div>
                      <div className="text-[11px] text-text-muted font-semibold mt-0.5">
                        bags in store (~{(stock * 25).toLocaleString()} kg)
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => {
                          setSelectedStockItem(item);
                          setShowRestockModal(true);
                        }}
                        className="w-full bg-white hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-xs py-2 rounded-xl transition-colors shadow-xs"
                      >
                        Adjust / Restock
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw Ingredients Section */}
          <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-farm pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-dark-green flex items-center gap-2">
                  <Wheat className="w-5 h-5 text-primary" />
                  <span>Raw Formulation Ingredients</span>
                </h3>
                <p className="text-[11px] text-text-muted">Maize, Wheat Offal, Concentrate, Premix, Limestone for on-farm feed mixing</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {feedInventory.filter(fi => !['Chick Mash', 'Grower Mash', 'Layers Mash'].some(name => fi.item_name.includes(name))).map(item => {
                const stock = Number(item.current_stock) || 0;
                return (
                  <div key={item.id} className="p-4 bg-bg-farm rounded-2xl border border-border-farm space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-xs text-dark-green">{item.item_name}</div>
                      <div className="text-[10px] text-text-muted">{item.category || 'Raw Material'}</div>
                    </div>

                    <div>
                      <div className="text-2xl font-bold font-mono text-dark-green">{stock.toLocaleString()}</div>
                      <div className="text-[10px] text-text-muted font-bold">{item.unit || 'kg'} in silo / warehouse</div>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => {
                          setSelectedStockItem(item);
                          setShowRestockModal(true);
                        }}
                        className="w-full bg-white hover:bg-dark-green hover:text-white text-dark-green border border-border-farm font-bold text-[11px] py-1.5 rounded-xl transition-colors"
                      >
                        Adjust Stock
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Maize Purchases Log & Weighbridge ── */}
      {activeTab === 'maize' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-3">
            <div>
              <h3 className="font-serif font-bold text-dark-green text-base">Maize Procurement Log</h3>
              <p className="text-xs text-text-muted">Grain purchases with total kg procured, bag counts, and average weight/bag.</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowMaizeGridModal(true)}
                className="bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
              >
                <Calculator className="w-4 h-4" />
                <span>+ Log Maize Purchase Grid</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-farm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Seller / Supplier</th>
                  <th className="p-3.5 text-center">Bags</th>
                  <th className="p-3.5 text-center">Total Weight (kg)</th>
                  <th className="p-3.5 text-center">Avg kg/bag</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                  <th className="p-3.5">Notes</th>
                  {canEdit && <th className="p-3.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/50">
                {maizeRecords.length > 0 ? (
                  [...maizeRecords].reverse().map(mz => {
                    const avg = mz.bag_number > 0 ? (mz.kg_procured / mz.bag_number).toFixed(1) : '—';
                    return (
                      <tr key={mz.id} className="hover:bg-bg-farm/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-dark-green">{mz.date}</td>
                        <td className="p-3.5 font-bold">{mz.seller_name}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-dark-green">{mz.bag_number}</td>
                        <td className="p-3.5 text-center font-mono font-bold">{Number(mz.kg_procured).toLocaleString()} kg</td>
                        <td className="p-3.5 text-center font-mono text-text-muted">{avg} kg</td>
                        <td className="p-3.5 text-right font-mono font-bold text-dark-green">
                          ₦{Number(mz.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5 text-text-muted max-w-xs truncate">{mz.notes || '—'}</td>
                        {canEdit && (
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => deleteRecord('maize_records', mz.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-text-muted">No maize procurement records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Finished Feed Direct Purchases (Item XX) ── */}
      {activeTab === 'finished' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-3">
            <div>
              <h3 className="font-serif font-bold text-dark-green text-base">Finished Feed Purchases</h3>
              <p className="text-xs text-text-muted">Log ready-made Chick, Grower, or Layers Mash bought directly from feed millers.</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowFinishedFeedModal(true)}
                className="bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Log Finished Feed Purchase</span>
              </button>
            )}
          </div>

          <div className="p-8 text-center text-text-muted text-xs space-y-2">
            <Package className="w-10 h-10 mx-auto text-primary opacity-60" />
            <p className="font-bold">Finished feed purchases auto-restock your warehouse and log expenses.</p>
            <p className="text-[11px]">Click the button above to record a new finished feed delivery.</p>
          </div>
        </div>
      )}

      {/* ── Tab 4: In-House Milling Production ── */}
      {activeTab === 'production' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-farm pb-3">
            <div>
              <h3 className="font-serif font-bold text-dark-green text-base">In-House Milling & Production Log</h3>
              <p className="text-xs text-text-muted">Batches formulated from raw ingredients into finished bags.</p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowProductionModal(true)}
                className="bg-primary hover:bg-dark-green text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all self-start sm:self-auto"
              >
                <Hammer className="w-4 h-4" />
                <span>+ Log Milling Batch</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-farm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-center">Maize Used (kg)</th>
                  <th className="p-3.5 text-center">Wheat Offal (bags)</th>
                  <th className="p-3.5 text-center">Concentrate (bags)</th>
                  <th className="p-3.5 text-center">Premix (kg)</th>
                  <th className="p-3.5 text-center font-bold text-dark-green">Bags Produced</th>
                  <th className="p-3.5 text-center">Total Tonnes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/50">
                {feedProduction.length > 0 ? (
                  [...feedProduction].reverse().map(p => (
                    <tr key={p.id} className="hover:bg-bg-farm/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-dark-green">{p.date}</td>
                      <td className="p-3.5 text-center font-mono">{p.maize_kg || 0} kg</td>
                      <td className="p-3.5 text-center font-mono">{p.wheat_offal_bags || 0}</td>
                      <td className="p-3.5 text-center font-mono">{p.concentrate_bags || 0}</td>
                      <td className="p-3.5 text-center font-mono">{p.premix_qty || 0}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-dark-green bg-emerald-50/40">
                        {p.bags_produced || 0} bags
                      </td>
                      <td className="p-3.5 text-center font-mono text-text-muted">{p.feed_produced_tonnes || 0} t</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-muted">No feed production milling records logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: Movement Ledger ── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-border-farm p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-farm pb-3">
            <h3 className="font-serif font-bold text-dark-green text-base">Inventory Transaction Ledger</h3>
            <span className="text-xs text-text-muted font-bold">{inventoryLogs.length} events</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-farm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-bg-farm border-b border-border-farm text-text-muted uppercase text-[10px] font-bold">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Source / Event</th>
                  <th className="p-3.5 text-center">Change Qty</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-farm/50">
                {inventoryLogs.length > 0 ? (
                  [...inventoryLogs].reverse().slice(0, 50).map(l => (
                    <tr key={l.id} className="hover:bg-bg-farm/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-dark-green">{l.date}</td>
                      <td className="p-3.5 font-bold">{l.source}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-dark-green">{l.change_amount}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.change_type === 'restock' ? 'bg-emerald-100 text-dark-green' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {l.change_type}
                        </span>
                      </td>
                      <td className="p-3.5 text-text-muted">{l.notes || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">No inventory movement logs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Multi-Bag Maize Grid Purchase (Item X & XVII) ── */}
      {showMaizeGridModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-2xl w-full overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Wheat className="w-5 h-5 text-accent" />
                <span>Log Maize Purchase • Multi-Bag Weighbridge Grid</span>
              </div>
              <button 
                onClick={() => setShowMaizeGridModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMaizePurchase} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={mzDate}
                    onChange={(e) => setMzDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Maize Vendor / Farmer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={mzSeller}
                    onChange={(e) => setMzSeller(e.target.value)}
                    placeholder="e.g. Alhaji Danladi Grain Supply"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* ── Multi-Bag Weight Input Grid (Item X) ── */}
              <div className="bg-bg-farm p-4 rounded-2xl border border-border-farm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-dark-green flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-primary" />
                    <span>Individual Bag Weights (kg per bag)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBagToGrid}
                    className="bg-white hover:bg-emerald-50 text-dark-green border border-emerald-300 font-bold px-2.5 py-1 rounded-lg text-xs shadow-2xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bag</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {mzBagWeights.map((weight, idx) => (
                    <div key={idx} className="relative group">
                      <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">
                        Bag #{idx + 1} (kg)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={weight}
                        onChange={(e) => handleUpdateBagWeight(idx, e.target.value)}
                        className="w-full bg-white border border-border-farm rounded-xl p-2 text-xs font-bold font-mono text-center focus:ring-2 focus:ring-accent focus:outline-none"
                      />
                      {mzBagWeights.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBagFromGrid(idx)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove bag"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Auto-sum Totals Bar */}
                <div className="mt-2 pt-2 border-t border-border-farm/70 grid grid-cols-3 text-center text-xs font-bold">
                  <div>
                    <span className="text-[10px] text-text-muted block">Total Bags</span>
                    <span className="font-mono text-dark-green text-sm">{totalMaizeBags} bags</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted block">Total Weight</span>
                    <span className="font-mono text-dark-green text-sm">{totalMaizeKg.toLocaleString()} kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted block">Average Weight</span>
                    <span className="font-mono text-dark-green text-sm">{avgWeightPerBag} kg/bag</span>
                  </div>
                </div>
              </div>

              {/* Pricing, Transport, Handling */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Grain Price / kg (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 850"
                    value={mzPricePerKg}
                    onChange={(e) => setMzPricePerKg(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Transport Cost (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15000"
                    value={mzTransportCost}
                    onChange={(e) => setMzTransportCost(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Offloading / Misc (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={mzHandlingCost}
                    onChange={(e) => setMzHandlingCost(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Calculation Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-dark-green">
                <span>Grand Total Maize Procurement:</span>
                <span className="text-base font-serif font-black text-dark-green">
                  ₦{maizeGrandTotal.toLocaleString()}
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={mzAutoLogExpense}
                  onChange={(e) => setMzAutoLogExpense(e.target.checked)}
                  className="rounded text-primary focus:ring-accent"
                />
                <span>Automatically record transport & handling costs in Daily Expenses Log</span>
              </label>

              <div className="pt-2 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMaizeGridModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mzSubmitting || !isOnline}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {mzSubmitting ? 'Saving...' : 'Save Maize Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Finished Feed Direct Purchase (Item XX) ── */}
      {showFinishedFeedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Package className="w-5 h-5 text-accent" />
                <span>Buy Finished Feed (Ready-Made)</span>
              </div>
              <button 
                onClick={() => setShowFinishedFeedModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFinishedFeedPurchase} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Feed Type *
                  </label>
                  <select
                    value={ffFeedType}
                    onChange={(e) => setFfFeedType(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Layers Mash">Layers Mash (25kg)</option>
                    <option value="Grower Mash">Grower Mash (25kg)</option>
                    <option value="Chick Mash">Chick Mash (25kg)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={ffDate}
                    onChange={(e) => setFfDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Feed Supplier / Miller *
                </label>
                <input
                  type="text"
                  required
                  value={ffVendor}
                  onChange={(e) => setFfVendor(e.target.value)}
                  placeholder="e.g. TopFeed, Animal Care, Ultima"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Quantity (Bags) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={ffBags}
                    onChange={(e) => setFfBags(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Cost per Bag (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={ffCostPerBag}
                    onChange={(e) => setFfCostPerBag(e.target.value)}
                    placeholder="e.g. 14500"
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Transport / Delivery (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={ffTransport}
                  onChange={(e) => setFfTransport(e.target.value)}
                  placeholder="0"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              {ffBags && ffCostPerBag && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-dark-green">
                  <span>Total Purchase Cost:</span>
                  <span className="font-serif font-black text-sm">
                    ₦{((Number(ffBags) * Number(ffCostPerBag)) + (Number(ffTransport) || 0)).toLocaleString()}
                  </span>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={ffAutoExpense}
                  onChange={(e) => setFfAutoExpense(e.target.checked)}
                  className="rounded text-primary focus:ring-accent"
                />
                <span>Automatically record total purchase in Daily Expenses Log</span>
              </label>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinishedFeedModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ffSubmitting || !isOnline}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {ffSubmitting ? 'Saving...' : 'Save & Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: In-House Feed Milling ── */}
      {showProductionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Hammer className="w-5 h-5 text-accent" />
                <span>Log Feed Production Milling</span>
              </div>
              <button 
                onClick={() => setShowProductionModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduction} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Feed Produced *
                  </label>
                  <select
                    value={prodTargetFeed}
                    onChange={(e) => setProdTargetFeed(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Layers Mash">Layers Mash</option>
                    <option value="Grower Mash">Grower Mash</option>
                    <option value="Chick Mash">Chick Mash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    Milling Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                    className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-bg-farm p-3 rounded-2xl border border-border-farm">
                <div>
                  <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Maize Used (kg)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={prodMaizeKg}
                    onChange={(e) => setProdMaizeKg(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Wheat Offal (bags)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 6"
                    value={prodWheatBags}
                    onChange={(e) => setProdWheatBags(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Concentrate (bags)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 4"
                    value={prodConcBags}
                    onChange={(e) => setProdConcBags(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-text-muted uppercase font-bold mb-0.5">Premix / Additives (kg)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2.5"
                    value={prodPremixKg}
                    onChange={(e) => setProdPremixKg(e.target.value)}
                    className="w-full bg-white border border-border-farm rounded-lg p-2 text-xs font-bold font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Finished Bags Produced (25kg/bag) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 40"
                  value={prodBagsProduced}
                  onChange={(e) => setProdBagsProduced(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-dark-green focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductionModal(false)}
                  className="flex-1 bg-bg-farm hover:bg-border-farm/40 text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={prodSubmitting || !isOnline}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {prodSubmitting ? 'Saving...' : 'Save Production Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Manual Stock Adjustment ── */}
      {showRestockModal && selectedStockItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-border-farm shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
            <div className="bg-dark-green p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-serif font-bold text-base">
                <Boxes className="w-5 h-5 text-accent" />
                <span>Adjust {selectedStockItem.item_name}</span>
              </div>
              <button 
                onClick={() => setShowRestockModal(false)}
                className="text-white/70 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-bg-farm rounded-xl border border-border-farm">
                <span className="text-text-muted">Current Stock:</span>
                <span className="font-mono font-bold text-dark-green text-sm">
                  {selectedStockItem.current_stock} {selectedStockItem.unit || 'bags'}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                >
                  <option value="restock">Add Stock (+)</option>
                  <option value="adjustment">Deduct / Loss (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Quantity ({selectedStockItem.unit || 'bags'}) *
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-sm font-bold font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Physical audit recount, spill loss, etc."
                  className="w-full bg-bg-farm border border-border-farm rounded-xl px-3.5 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="flex-1 bg-bg-farm text-text-muted font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting || !isOnline}
                  className="flex-1 bg-primary hover:bg-dark-green text-white font-bold py-2.5 rounded-xl shadow-sm transition-all"
                >
                  {adjustSubmitting ? 'Updating...' : 'Save Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
