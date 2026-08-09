import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useOnlineStatus } from './useOnlineStatus';
import {
  getCachedData,
  setCachedData,
  putCachedItem,
  deleteCachedItem,
  enqueueSync,
  getSyncQueue,
  flushSyncQueue,
  TABLE_NAMES
} from '../lib/offlineQueue';
import historicalData from '../seed_data/historical_data.json';

const DataContext = createContext(null);

// Default Seed Data based on Section 9 of the Build Spec
const SEED_DATA = {
  workers: [
    { id: 'w-admin', name: 'Admin User', email: 'admin@fazky.com', role: 'admin', base_salary: 100000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-manager', name: 'Manager User', email: 'manager@fazky.com', role: 'manager', base_salary: 75000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-muslimat', name: 'Muslimat', email: 'muslimat@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-mm', name: 'MM', email: 'mm@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-babafarida', name: 'Baba Farida', email: 'babafarida@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-iyaopeyemi', name: 'Iya Opeyemi', email: 'iyaopeyemi@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-iyaarishe', name: 'Iya Arishe', email: 'iyaarishe@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-iyafarida', name: 'Iya Farida', email: 'iyafarida@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-iyazainab', name: 'Iya Zainab', email: 'iyazainab@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-alfataye', name: 'Alfa Taye', email: 'alfataye@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-amos', name: 'Amos', email: 'amos@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-romoke', name: 'Romoke', email: 'romoke@fazky.com', role: 'staff', base_salary: 45000, status: 'active', created_at: new Date().toISOString() },
    { id: 'w-abdulganiyu', name: 'Abdul Ganiyu', email: 'abdulganiyu@fazky.com', role: 'staff', base_salary: 35000, status: 'active', created_at: new Date().toISOString() }
  ],
  pen_blocks: [
    { id: 'pb-a', name: 'Pen Block A', display_order: 1, created_at: new Date().toISOString() },
    { id: 'pb-b', name: 'Pen Block B', display_order: 2, created_at: new Date().toISOString() },
    { id: 'pb-c', name: 'Pen Block C', display_order: 3, created_at: new Date().toISOString() },
    { id: 'pb-d', name: 'Pen Block D', display_order: 4, created_at: new Date().toISOString() }
  ],
  pens: [
    // Pen Block A
    { id: 'pen-muslimat', pen_block_id: 'pb-a', name: 'Muslimat Pen', worker_id: 'w-muslimat', has_sides: false, slot_count: 15, generation: 'Batch 1', display_order: 1, is_active: true, created_at: new Date().toISOString() },
    { id: 'pen-mm', pen_block_id: 'pb-a', name: 'MM Pen', worker_id: 'w-mm', has_sides: false, slot_count: 15, generation: 'Batch 1', display_order: 2, is_active: true, created_at: new Date().toISOString() },
    { id: 'pen-babafarida', pen_block_id: 'pb-a', name: 'Baba Farida Pen', worker_id: 'w-babafarida', has_sides: false, slot_count: 15, generation: 'Batch 2', display_order: 3, is_active: true, created_at: new Date().toISOString() },
    { id: 'pen-iyaopeyemi', pen_block_id: 'pb-a', name: 'Iya Opeyemi Pen', worker_id: 'w-iyaopeyemi', has_sides: false, slot_count: 15, generation: 'Batch 2', display_order: 4, is_active: true, created_at: new Date().toISOString() },
    // Pen Block B
    { id: 'pen-iyaarishe', pen_block_id: 'pb-b', name: 'Iya Arishe Pen', worker_id: 'w-iyaarishe', has_sides: true, slot_count: 14, generation: 'Batch 3', display_order: 1, is_active: true, created_at: new Date().toISOString() },
    { id: 'pen-iyafarida', pen_block_id: 'pb-b', name: 'Iya Farida Pen', worker_id: 'w-iyafarida', has_sides: true, slot_count: 13, generation: 'Batch 3', display_order: 2, is_active: true, created_at: new Date().toISOString() },
    // Pen Block C
    { id: 'pen-iyazainab', pen_block_id: 'pb-c', name: 'Iya Zainab / Arisha Pen', worker_id: 'w-iyazainab', has_sides: true, slot_count: 14, generation: 'Batch 4', display_order: 1, is_active: true, created_at: new Date().toISOString() },
    { id: 'pen-alfataye', pen_block_id: 'pb-c', name: 'Alfa Taye Pen', worker_id: 'w-alfataye', has_sides: true, slot_count: 13, generation: 'Batch 4', display_order: 2, is_active: true, created_at: new Date().toISOString() },
    // Pen Block D
    { id: 'pen-small', pen_block_id: 'pb-d', name: 'Various smaller pens', worker_id: 'w-amos', has_sides: false, slot_count: 10, generation: 'Batch 5', display_order: 1, is_active: true, created_at: new Date().toISOString() }
  ],
  general_census: historicalData.general_census || [],
  egg_price_settings: [
    { id: 'ep-1', price_per_crate: 4400, effective_date: '2026-01-01', set_by: 'w-admin', created_at: new Date().toISOString() }
  ],
  feed_inventory: [
    { id: 'fi-1', item_name: 'Layers Feed', unit: 'bags', current_stock: 120, low_stock_threshold: 20, last_updated: new Date().toISOString() },
    { id: 'fi-2', item_name: 'Maize', unit: 'kg', current_stock: 1500, low_stock_threshold: 300, last_updated: new Date().toISOString() },
    { id: 'fi-3', item_name: 'Wheat Offal', unit: 'bags', current_stock: 45, low_stock_threshold: 10, last_updated: new Date().toISOString() },
    { id: 'fi-4', item_name: 'Concentrate', unit: 'bags', current_stock: 60, low_stock_threshold: 15, last_updated: new Date().toISOString() },
    { id: 'fi-5', item_name: 'Soya Beans', unit: 'kg', current_stock: 800, low_stock_threshold: 150, last_updated: new Date().toISOString() },
    { id: 'fi-6', item_name: 'Premix', unit: 'kg', current_stock: 50, low_stock_threshold: 10, last_updated: new Date().toISOString() }
  ],
  loans: [
    { id: 'loan-abdul', worker_id: 'w-abdulganiyu', total_borrowed: 170000, duration_months: 17, monthly_amount: 10000, created_at: new Date().toISOString() },
    { id: 'loan-amos', worker_id: 'w-amos', total_borrowed: 50000, duration_months: 5, monthly_amount: 10000, created_at: new Date().toISOString() }
  ],
  loan_repayments: [
    { id: 'lr-amos-1', loan_id: 'loan-amos', date: '2026-06-01', amount_repayable: 10000, repayment_made: 10000, balance: 40000, comments: 'Repayment 1', created_at: new Date().toISOString() },
    { id: 'lr-amos-2', loan_id: 'loan-amos', date: '2026-07-01', amount_repayable: 10000, repayment_made: 10000, balance: 30000, comments: 'Repayment 2', created_at: new Date().toISOString() }
  ],
  census_counts: [],
  production_log: historicalData.production_log || [],
  sales_log: historicalData.sales_log || [],
  expenses_log: historicalData.expenses_log || [],
  maize_records: historicalData.maize_records || [],
  feed_production: [],
  off_pays: [],
  feed_inventory_log: []
};

// Auto-fill Census Counts for all pens to match starting census of mid-2026
const initialBirdCounts = {
  'pen-muslimat': { single: 45 },
  'pen-mm': { single: 42 },
  'pen-babafarida': { single: 43 },
  'pen-iyaopeyemi': { single: 44 },
  'pen-iyaarishe': { left: 45, right: 44 },
  'pen-iyafarida': { left: 44, right: 45 },
  'pen-iyazainab': { left: 45, right: 44 },
  'pen-alfataye': { left: 44, right: 45 },
  'pen-small': { single: 8 }
};

const defaultDateStr = '2026-08-05';

Object.entries(initialBirdCounts).forEach(([penId, sides]) => {
  Object.entries(sides).forEach(([side, count]) => {
    // Generate counts for 15 slots
    const maxSlots = penId.includes('small') ? 10 : penId.includes('iya') ? 14 : 15;
    for (let slot = 1; slot <= maxSlots; slot++) {
      SEED_DATA.census_counts.push({
        id: `cc-${penId}-${side}-${slot}-${defaultDateStr}`,
        pen_id: penId,
        side,
        slot_number: slot,
        bird_count: count,
        date: defaultDateStr,
        updated_at: new Date().toISOString()
      });
    }
  });
});


export function DataProvider({ children }) {
  const isOnline = useOnlineStatus();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  // Initialize and load cached data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = {};
      let hasCachedContent = false;

      // Try loading from IndexedDB
      for (const table of TABLE_NAMES) {
        const cached = await getCachedData(table);
        if (cached && cached.length > 0) {
          loaded[table] = cached;
          hasCachedContent = true;
        } else {
          loaded[table] = [];
        }
      }

      // If IndexedDB is empty, seed it with default records
      if (!hasCachedContent) {
        console.log('IndexedDB is empty. Seeding defaults...');
        for (const table of TABLE_NAMES) {
          const seeds = SEED_DATA[table] || [];
          if (seeds.length > 0) {
            await setCachedData(table, seeds);
            loaded[table] = seeds;
          }
        }
      }

      setData(loaded);

      // Check current sync queue size
      const queue = await getSyncQueue();
      setQueuedCount(queue.length);

      // If online and Supabase is configured, pull fresh database content
      if (isOnline && isSupabaseConfigured) {
        await syncFromSupabase(loaded);
      }
    } catch (err) {
      console.error('Failed to load local data cache:', err);
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  // Pull records from Supabase and cache them
  const syncFromSupabase = async (currentLocalData) => {
    try {
      console.log('Fetching fresh data from Supabase...');
      const freshData = { ...currentLocalData };
      
      for (const table of TABLE_NAMES) {
        const { data: remoteData, error } = await supabase
          .from(table)
          .select('*');
        
        if (!error && remoteData) {
          await setCachedData(table, remoteData);
          freshData[table] = remoteData;
        }
      }
      
      setData(freshData);
    } catch (err) {
      console.error('Failed to sync from Supabase:', err);
    }
  };

  // Run full database flush
  const triggerFlush = useCallback(async () => {
    if (!isOnline || !isSupabaseConfigured || isSyncing) return;
    setIsSyncing(true);
    try {
      const remaining = await flushSyncQueue(supabase);
      setQueuedCount(remaining);
      if (remaining === 0) {
        // Refresh local cache once sync completes
        await syncFromSupabase(data);
      }
    } catch (err) {
      console.error('Error during queue flush:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, data]);

  // Trigger sync when online status changes
  useEffect(() => {
    if (isOnline) {
      triggerFlush();
    }
  }, [isOnline, triggerFlush]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Generic write functions
  const insertRecord = async (table, record) => {
    const newRecord = {
      id: record.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...record
    };

    // 1. Optimistic Update React State
    setData(prev => ({
      ...prev,
      [table]: [...(prev[table] || []), newRecord]
    }));

    // 2. Cache locally in IndexedDB
    await putCachedItem(table, newRecord);

    // 3. Try to sync or enqueue
    if (isOnline && isSupabaseConfigured) {
      try {
        const { error } = await supabase.from(table).insert(newRecord);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase insert failed, enqueuing offline sync:', err);
        await enqueueSync(table, 'INSERT', newRecord);
        setQueuedCount(prev => prev + 1);
      }
    } else {
      await enqueueSync(table, 'INSERT', newRecord);
      setQueuedCount(prev => prev + 1);
    }

    // Trigger mortality hooks if recording mortality
    if (table === 'production_log') {
      await handleMortalityTrigger(newRecord);
    }
    // Trigger feed deduction hooks
    if (table === 'production_log') {
      await handleFeedDeductionTrigger(newRecord);
    }
    // Trigger procurement hooks
    if (table === 'feed_production') {
      await handleFeedProductionTrigger(newRecord);
    }
  };

  const updateRecord = async (table, record) => {
    // 1. Optimistic Update React State
    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).map(r => r.id === record.id ? { ...r, ...record } : r)
    }));

    // 2. Cache locally in IndexedDB
    const currentItem = (data[table] || []).find(r => r.id === record.id);
    const updatedItem = { ...currentItem, ...record };
    await putCachedItem(table, updatedItem);

    // 3. Try to sync or enqueue
    if (isOnline && isSupabaseConfigured) {
      try {
        const { error } = await supabase.from(table).update(record).eq('id', record.id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase update failed, enqueuing offline sync:', err);
        await enqueueSync(table, 'UPDATE', updatedItem);
        setQueuedCount(prev => prev + 1);
      }
    } else {
      await enqueueSync(table, 'UPDATE', updatedItem);
      setQueuedCount(prev => prev + 1);
    }

    // Trigger mortality hooks if production changes
    if (table === 'production_log') {
      await handleMortalityTrigger(updatedItem, currentItem);
    }
    // Trigger feed deduction hooks
    if (table === 'production_log') {
      await handleFeedDeductionTrigger(updatedItem, currentItem);
    }
  };

  const deleteRecord = async (table, id) => {
    // 1. Optimistic Update React State
    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).filter(r => r.id !== id)
    }));

    // 2. Cache locally in IndexedDB
    await deleteCachedItem(table, id);

    // 3. Try to sync or enqueue
    if (isOnline && isSupabaseConfigured) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase delete failed, enqueuing offline sync:', err);
        await enqueueSync(table, 'DELETE', { id });
        setQueuedCount(prev => prev + 1);
      }
    } else {
      await enqueueSync(table, 'DELETE', { id });
      setQueuedCount(prev => prev + 1);
    }
  };

  // Local triggers simulation (matches SQL behavior when offline)
  const handleMortalityTrigger = async (newProduction, oldProduction = null) => {
    const oldMortality = oldProduction ? (oldProduction.mortality || 0) : 0;
    const newMortality = newProduction.mortality || 0;
    let deduction = newMortality - oldMortality;

    if (deduction !== 0) {
      // Find census counts for this pen and date
      const censusList = [...(data.census_counts || [])]
        .filter(c => c.pen_id === newProduction.pen_id && c.date === newProduction.date)
        .sort((a, b) => a.slot_number - b.slot_number);

      if (censusList.length > 0) {
        const updatedCounts = [...(data.census_counts || [])];
        
        for (let i = 0; i < censusList.length; i++) {
          const item = censusList[i];
          const itemIdx = updatedCounts.findIndex(c => c.id === item.id);
          
          if (deduction > 0) {
            if (item.bird_count >= deduction) {
              updatedCounts[itemIdx] = { ...item, bird_count: item.bird_count - deduction };
              await putCachedItem('census_counts', updatedCounts[itemIdx]);
              deduction = 0;
              break;
            } else {
              updatedCounts[itemIdx] = { ...item, bird_count: 0 };
              await putCachedItem('census_counts', updatedCounts[itemIdx]);
              deduction -= item.bird_count;
            }
          } else if (deduction < 0) {
            // Re-add birds if mortality is reduced
            updatedCounts[itemIdx] = { ...item, bird_count: item.bird_count - deduction };
            await putCachedItem('census_counts', updatedCounts[itemIdx]);
            deduction = 0;
            break;
          }
        }
        setData(prev => ({ ...prev, census_counts: updatedCounts }));
      }
    }
  };

  const handleFeedDeductionTrigger = async (newProduction, oldProduction = null) => {
    const oldFeed = oldProduction ? ((oldProduction.morning_feed || 0) + (oldProduction.evening_feed || 0)) : 0;
    const newFeed = (newProduction.morning_feed || 0) + (newProduction.evening_feed || 0);
    const diff = newFeed - oldFeed;

    if (diff !== 0) {
      // Find 'Layers Feed' inventory
      const layersFeedItem = (data.feed_inventory || []).find(fi => fi.item_name === 'Layers Feed');
      if (layersFeedItem) {
        const updatedInventory = (data.feed_inventory || []).map(fi => {
          if (fi.id === layersFeedItem.id) {
            const nextStock = fi.current_stock - diff;
            const updated = {
              ...fi,
              current_stock: nextStock,
              last_updated: new Date().toISOString()
            };
            putCachedItem('feed_inventory', updated);
            
            // Write inventory log
            const logId = crypto.randomUUID();
            const logItem = {
              id: logId,
              inventory_id: fi.id,
              date: newProduction.date,
              change_amount: -diff,
              change_type: 'consumption',
              source: 'Production Log',
              notes: `Consumed by Pen: ${newProduction.pen_id}`,
              created_at: new Date().toISOString()
            };
            putCachedItem('feed_inventory_log', logItem);
            // Append log optimistically
            setTimeout(() => {
              setData(prev => ({
                ...prev,
                feed_inventory_log: [...(prev.feed_inventory_log || []), logItem]
              }));
            }, 0);

            return updated;
          }
          return fi;
        });

        setData(prev => ({ ...prev, feed_inventory: updatedInventory }));
      }
    }
  };

  // Add Restock from Feed Production (Section 13: "When feed production is recorded, maize KG and bag quantities are automatically added")
  const handleFeedProductionTrigger = async (newProduction) => {
    // Deduct raw items, add finished feed
    const maizeKg = newProduction.maize_kg || 0;
    const bagsProduced = newProduction.bags_produced || 0;
    
    // Soya Beans, Concentrate, Premix, Wheat Offal
    const soyaKg = newProduction.soya_beans_qty || 0;
    const concentrateBags = newProduction.concentrate_bags || 0;
    const premixKg = newProduction.premix_qty || 0;
    const wheatBags = newProduction.wheat_offal_bags || 0;

    const updatedInventory = (data.feed_inventory || []).map(fi => {
      let change = 0;
      let notes = 'Used for Feed Production';
      let type = 'consumption';

      if (fi.item_name === 'Layers Feed') {
        change = bagsProduced;
        notes = 'Produced in Feed Production Module';
        type = 'restock';
      } else if (fi.item_name === 'Maize') {
        change = -maizeKg;
      } else if (fi.item_name === 'Soya Beans') {
        change = -soyaKg;
      } else if (fi.item_name === 'Concentrate') {
        change = -concentrateBags;
      } else if (fi.item_name === 'Premix') {
        change = -premixKg;
      } else if (fi.item_name === 'Wheat Offal') {
        change = -wheatBags;
      }

      if (change !== 0) {
        const updated = {
          ...fi,
          current_stock: fi.current_stock + change,
          last_updated: new Date().toISOString()
        };
        putCachedItem('feed_inventory', updated);
        
        // Log changes
        const logItem = {
          id: crypto.randomUUID(),
          inventory_id: fi.id,
          date: newProduction.date,
          change_amount: change,
          change_type: type,
          source: 'Feed Production',
          notes: notes,
          created_at: new Date().toISOString()
        };
        putCachedItem('feed_inventory_log', logItem);

        return updated;
      }
      return fi;
    });

    setData(prev => ({ ...prev, feed_inventory: updatedInventory }));
  };

  return (
    <DataContext.Provider value={{
      data,
      loading,
      isOnline,
      isSyncing,
      queuedCount,
      refresh: loadData,
      flushQueue: triggerFlush,
      insertRecord,
      updateRecord,
      deleteRecord
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
