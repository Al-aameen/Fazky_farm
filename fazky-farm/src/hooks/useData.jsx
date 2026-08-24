import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useOnlineStatus } from './useOnlineStatus';

const DataContext = createContext(null);

// All known tables in the system
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
  'grower_daily_logs',
  'flock_sales',
  'flock_health_log',
  'farm_projects',
  'vaccination_schedules',
  'loan_requests',
  'general_livestock_detailed',
  'worker_permissions'
];

// Tier 1: Small reference tables needed everywhere — loaded once and kept in memory
export const GLOBAL_TABLES = [
  'workers',
  'pen_blocks',
  'pens',
  'egg_price_settings',
  'farm_projects',
  'vaccination_schedules',
  'feed_inventory',
  'worker_permissions'
];

// Tier 2: Page-specific mapping — only fetch what the active page needs
export const PAGE_TABLES_MAP = {
  dashboard:        ['production_log', 'sales_log', 'expenses_log', 'census_counts', 'general_census'],
  workerdashboard:  ['production_log', 'census_counts', 'vaccination_schedules', 'loan_requests', 'feed_inventory'],
  census:           ['census_counts', 'general_census'],
  production:       ['production_log'],
  flockhealth:      ['production_log', 'census_counts', 'flock_health_log', 'batches'],
  flocklifecycle:   ['batches', 'grower_logs', 'grower_daily_logs', 'flock_sales', 'vaccination_schedules', 'pens'],
  feedwatch:        ['feed_inventory', 'feed_inventory_log', 'feed_production', 'maize_records'],
  sales:            ['sales_log'],
  customerorders:   ['sales_log'],
  expenses:         ['expenses_log'],
  farmprojects:     ['farm_projects', 'expenses_log'],
  procurement:      ['maize_records', 'feed_production', 'feed_inventory', 'feed_inventory_log', 'expenses_log'],
  loans:            ['loans', 'loan_repayments', 'loan_requests'],
  payroll:          ['loans', 'loan_repayments', 'off_pays'],
  workers:          ['workers', 'pens'],
  generallivestock: ['general_livestock_detailed', 'general_census'],
  settings:         ['workers', 'egg_price_settings', 'worker_permissions']
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache lifetime

// Helper to merge arrays of records by `id` without creating duplicates
function mergeRecords(existing = [], incoming = []) {
  if (!incoming || incoming.length === 0) return existing;
  if (!existing || existing.length === 0) return incoming;

  const map = new Map();
  existing.forEach(item => {
    if (item && item.id) map.set(item.id, item);
  });
  incoming.forEach(item => {
    if (item && item.id) {
      map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    }
  });

  return Array.from(map.values());
}

export function DataProvider({ children }) {
  const isOnline = useOnlineStatus();

  // Initialize data object with empty arrays for every table to prevent undefined access
  const [data, setData] = useState(() => {
    const initial = {};
    TABLE_NAMES.forEach(t => { initial[t] = []; });
    return initial;
  });

  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);

  // Cache tracker: table -> { lastFetched: number, full: boolean }
  const tableCacheRef = useRef({});
  // Month cache tracker: table -> Set of 'YYYY-MM' strings loaded
  const monthCacheRef = useRef({});

  // 1. Fetch a single table (or date-filtered slice) from Supabase
  const fetchTableData = useCallback(async (table, options = {}) => {
    if (!isSupabaseConfigured) return [];

    try {
      let query = supabase.from(table).select('*');

      // Date range filtering if requested
      if (options.startDate && options.endDate) {
        query = query.gte('date', options.startDate).lte('date', options.endDate);
      } else if (options.startDate) {
        query = query.gte('date', options.startDate);
      } else if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.warn(`[useData] Error querying "${table}":`, error.message);
        return [];
      }
      return rows || [];
    } catch (err) {
      console.warn(`[useData] Exception querying "${table}":`, err);
      return [];
    }
  }, []);

  // 2. Load Global Reference Tables (Tier 1)
  const loadGlobalTables = useCallback(async (force = false) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    const tablesToFetch = GLOBAL_TABLES.filter(t => {
      if (force) return true;
      const cached = tableCacheRef.current[t];
      return !cached || (now - cached.lastFetched > CACHE_TTL_MS);
    });

    if (tablesToFetch.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        tablesToFetch.map(async (table) => {
          const rows = await fetchTableData(table);
          tableCacheRef.current[table] = { lastFetched: Date.now(), full: true };
          return { table, rows };
        })
      );

      setData(prev => {
        const next = { ...prev };
        results.forEach(({ table, rows }) => {
          next[table] = mergeRecords(next[table], rows);
        });
        return next;
      });
    } catch (err) {
      console.error('[useData] Global tables fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchTableData]);

  // 3. Load Page-Specific Tables on demand (Tier 2)
  const loadPageData = useCallback(async (pageId, force = false) => {
    if (!isSupabaseConfigured || !pageId) return;

    const tables = PAGE_TABLES_MAP[pageId] || [];
    const now = Date.now();

    const needed = tables.filter(t => {
      if (force) return true;
      const cached = tableCacheRef.current[t];
      return !cached || (now - cached.lastFetched > CACHE_TTL_MS);
    });

    if (needed.length === 0) return;

    setPageLoading(true);
    try {
      const results = await Promise.all(
        needed.map(async (table) => {
          const rows = await fetchTableData(table);
          tableCacheRef.current[table] = { lastFetched: Date.now(), full: true };
          return { table, rows };
        })
      );

      setData(prev => {
        const next = { ...prev };
        results.forEach(({ table, rows }) => {
          next[table] = mergeRecords(next[table], rows);
        });
        return next;
      });
    } catch (err) {
      console.error(`[useData] Error loading page data for "${pageId}":`, err);
    } finally {
      setPageLoading(false);
    }
  }, [fetchTableData]);

  // 4. On-Demand Month/Date Fetching (For historical browsing & comparisons)
  // When a user selects e.g. '2026-01-15', we check if that month is cached.
  // If not, we fetch the whole month in one lightweight query and cache it!
  const ensureDateLoaded = useCallback(async (table, dateStr) => {
    if (!isSupabaseConfigured || !table || !dateStr) return;

    // Check if table is already marked full
    if (tableCacheRef.current[table]?.full) return;

    // Extract YYYY-MM
    const monthKey = dateStr.slice(0, 7);
    if (!monthCacheRef.current[table]) {
      monthCacheRef.current[table] = new Set();
    }

    if (monthCacheRef.current[table].has(monthKey)) {
      // Already fetched this month into memory!
      return;
    }

    // Determine month start and end
    const [year, month] = monthKey.split('-').map(Number);
    const startDate = `${monthKey}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

    try {
      const rows = await fetchTableData(table, { startDate, endDate });
      monthCacheRef.current[table].add(monthKey);

      setData(prev => ({
        ...prev,
        [table]: mergeRecords(prev[table], rows)
      }));
    } catch (err) {
      console.warn(`[useData] Failed to on-demand fetch month ${monthKey} for ${table}:`, err);
    }
  }, [fetchTableData]);

  // 5. Ensure an entire table is loaded in full (used for Excel export, full sync)
  const ensureTableLoaded = useCallback(async (table, force = false) => {
    if (!isSupabaseConfigured || !table) return [];

    const cached = tableCacheRef.current[table];
    const now = Date.now();

    if (!force && cached?.full && (now - cached.lastFetched < CACHE_TTL_MS)) {
      return data[table] || [];
    }

    try {
      const rows = await fetchTableData(table);
      tableCacheRef.current[table] = { lastFetched: Date.now(), full: true };

      setData(prev => ({
        ...prev,
        [table]: mergeRecords(prev[table], rows)
      }));

      return rows;
    } catch (err) {
      console.error(`[useData] Failed to ensure table ${table} loaded:`, err);
      return data[table] || [];
    }
  }, [fetchTableData, data]);

  // Initial load on mount: fetch only global reference tables
  useEffect(() => {
    loadGlobalTables();
  }, [loadGlobalTables]);

  // Insert record
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

    // Optimistically merge into state
    setData(prev => ({
      ...prev,
      [table]: mergeRecords(prev[table], [inserted])
    }));

    return inserted;
  };

  // Update record
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

    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).map(r => r.id === record.id ? updated : r)
    }));

    return updated;
  };

  // Delete record
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

    setData(prev => ({
      ...prev,
      [table]: (prev[table] || []).filter(r => r.id !== id)
    }));

    return true;
  };

  // Bulk upsert records (Excel / CSV imports)
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

      // Update state with newly inserted records
      setData(prev => ({
        ...prev,
        [tableName]: mergeRecords(prev[tableName], insertedRows || records)
      }));

      return { success: true, count: insertedRows?.length || records.length };
    } catch (err) {
      console.error(`[useData] Bulk insert error on ${tableName}:`, err);
      return { success: false, error: err.message };
    }
  };

  // Targeted or full refresh
  const refresh = useCallback(async (tableName = null) => {
    if (tableName) {
      await ensureTableLoaded(tableName, true);
    } else {
      await loadGlobalTables(true);
    }
  }, [ensureTableLoaded, loadGlobalTables]);

  return (
    <DataContext.Provider value={{
      data,
      loading,
      pageLoading,
      isOnline,
      isSyncing: false,
      queuedCount: 0,
      loadPageData,
      ensureDateLoaded,
      ensureTableLoaded,
      refresh,
      forceFullSync: () => loadGlobalTables(true),
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

