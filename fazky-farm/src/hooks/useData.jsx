import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useOnlineStatus } from './useOnlineStatus';

const DataContext = createContext(null);

export const TABLE_NAMES = [
  'workers',
  'pen_blocks',
  'pens',
  'census_counts',
  'general_census',
  'production_log',
  'sales_log',
  'egg_price_settings',
  'expenses_log',
  'maize_records',
  'feed_production',
  'loans',
  'loan_repayments',
  'off_pays',
  'feed_inventory',
  'feed_inventory_log',
  'batches',
  'grower_logs',
  'flock_sales'
];

export function DataProvider({ children }) {
  const isOnline = useOnlineStatus();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Load all tables directly from Supabase
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        TABLE_NAMES.map(async (table) => {
          try {
            const { data: rows, error } = await supabase
              .from(table)
              .select('*');

            if (error) {
              console.warn(`[useData] Error loading table "${table}":`, error.message);
              return { table, rows: [] };
            }
            return { table, rows: rows || [] };
          } catch (err) {
            console.warn(`[useData] Fetch error on "${table}":`, err);
            return { table, rows: [] };
          }
        })
      );

      const tableData = {};
      results.forEach(({ table, rows }) => {
        tableData[table] = rows;
      });

      setData(tableData);
    } catch (err) {
      console.error('[useData] Failed to load data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Insert single record directly into Supabase
  const insertRecord = async (table, record) => {
    if (!isOnline) {
      throw new Error('You are currently offline. Please reconnect to save changes.');
    }

    const { data: inserted, error } = await supabase
      .from(table)
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error(`[useData] Insert error on ${table}:`, error);
      throw error;
    }

    // Optimistically add to state
    setData(prev => ({
      ...prev,
      [table]: [...(prev[table] || []), inserted]
    }));

    return inserted;
  };

  // Update record directly in Supabase
  const updateRecord = async (table, record) => {
    if (!isOnline) {
      throw new Error('You are currently offline. Please reconnect to save changes.');
    }

    const { data: updated, error } = await supabase
      .from(table)
      .update(record)
      .eq('id', record.id)
      .select()
      .single();

    if (error) {
      console.error(`[useData] Update error on ${table}:`, error);
      throw error;
    }

    // Update in state
    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).map(r => r.id === record.id ? updated : r)
    }));

    return updated;
  };

  // Delete record directly from Supabase
  const deleteRecord = async (table, id) => {
    if (!isOnline) {
      throw new Error('You are currently offline. Please reconnect to save changes.');
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[useData] Delete error on ${table}:`, error);
      throw error;
    }

    // Remove from state
    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).filter(r => r.id !== id)
    }));

    return true;
  };

  // Bulk upsert records (used for Excel / CSV imports)
  const bulkInsertRecords = async (tableName, records) => {
    if (!records || records.length === 0) return { success: true, count: 0 };
    if (!isOnline) {
      return { success: false, error: 'You are offline. Cannot import while offline.' };
    }

    try {
      const { data: insertedRows, error } = await supabase
        .from(tableName)
        .upsert(records)
        .select();

      if (error) throw error;

      // Refresh table state
      await loadData();

      return { success: true, count: insertedRows?.length || records.length };
    } catch (err) {
      console.error(`[useData] Bulk insert error on ${tableName}:`, err);
      return { success: false, error: err.message };
    }
  };

  return (
    <DataContext.Provider value={{
      data,
      loading,
      isOnline,
      isSyncing: false,
      queuedCount: 0,
      refresh: loadData,
      forceFullSync: loadData,
      flushQueue: () => Promise.resolve(),
      insertRecord,
      updateRecord,
      deleteRecord,
      bulkInsertRecords
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
