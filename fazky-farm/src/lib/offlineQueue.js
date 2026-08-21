import { openDB } from 'idb';

const DB_NAME = 'fazky_farm_db';
const DB_VERSION = 1;

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
  // Flock Lifecycle (Part 4)
  'batches',
  'grower_logs',
  'flock_sales'
];

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create cache tables
      TABLE_NAMES.forEach(tableName => {
        if (!db.objectStoreNames.contains(tableName)) {
          db.createObjectStore(tableName, { keyPath: 'id' });
        }
      });
      // Create sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    }
  });
}

export async function getCachedData(table) {
  const db = await initDB();
  return db.getAll(table);
}

// Fast batch write into IndexedDB
export async function setCachedData(table, data) {
  const db = await initDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  await store.clear();
  for (const item of (data || [])) {
    store.put(item);
  }
  await tx.done;
}

export async function putCachedItem(table, item) {
  const db = await initDB();
  await db.put(table, item);
}

export async function deleteCachedItem(table, id) {
  const db = await initDB();
  await db.delete(table, id);
}

export async function enqueueSync(table, action, payload) {
  const db = await initDB();
  await db.add('sync_queue', {
    table,
    action,
    payload,
    timestamp: Date.now()
  });
}

export async function getSyncQueue() {
  const db = await initDB();
  return db.getAll('sync_queue');
}

export async function dequeueSync(id) {
  const db = await initDB();
  await db.delete('sync_queue', id);
}

// Optimized high-speed queue flusher
export async function flushSyncQueue(supabase) {
  if (!supabase) return 0;

  // Fix 1: Guard against flushing with the anon key — bail silently if no
  // authenticated session exists to avoid 403 floods on the workers table.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('No active session — skipping queue flush');
    return 0;
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) return 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const { id, table, action, payload } = item;
    try {
      if (action === 'INSERT') {
        const { error } = await supabase.from(table).upsert(payload);
        if (error) throw error;
      } else if (action === 'UPDATE') {
        const { error } = await supabase.from(table).update(payload).eq('id', payload.id);
        if (error) throw error;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from(table).delete().eq('id', payload.id);
        if (error) throw error;
      }
      await dequeueSync(id);
    } catch (err) {
      console.error(`Failed to sync item ${id} in queue:`, err);
      // Store error info on the queue item for display in Settings
      try {
        const db = await initDB();
        const existing = await db.get('sync_queue', id);
        if (existing) {
          await db.put('sync_queue', {
            ...existing,
            lastError: err.message || String(err),
            failedAt: new Date().toISOString()
          });
        }
      } catch (_) {}
      // Continue to next item instead of breaking
    }
  }

  const remaining = await getSyncQueue();
  return remaining.length;
}

// ─── Delta Sync Helpers ─────────────────────────────────────────────────────
// Store per-table "last synced at" timestamps in localStorage.
// On next sync we only fetch rows newer than this — massively reducing
// mobile data usage on repeat syncs.

const SYNC_TS_PREFIX = 'fazky_sync_ts_';

/**
 * Get the ISO timestamp of the last successful sync for a table.
 * Returns null if this table has never been synced (triggers a full pull).
 */
export function getLastSyncedAt(table) {
  return localStorage.getItem(`${SYNC_TS_PREFIX}${table}`) || null;
}

/**
 * Record the current time as the successful sync timestamp for a table.
 */
export function setLastSyncedAt(table, isoTimestamp) {
  localStorage.setItem(`${SYNC_TS_PREFIX}${table}`, isoTimestamp || new Date().toISOString());
}

/**
 * Clear all sync timestamps (used for "Force Full Sync" in Settings).
 */
export function clearAllSyncTimestamps() {
  TABLE_NAMES.forEach(t => localStorage.removeItem(`${SYNC_TS_PREFIX}${t}`));
}

/**
 * Upsert delta rows into IndexedDB WITHOUT clearing existing data.
 * Used for incremental syncs — only the changed/new records are written.
 * @param {string} table
 * @param {Array}  deltaRows — rows returned from a `.gte('updated_at', ts)` query
 */
export async function mergeCachedData(table, deltaRows) {
  if (!deltaRows || deltaRows.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  for (const row of deltaRows) {
    store.put(row); // upsert by primary key — won't touch rows not in deltaRows
  }
  await tx.done;
}

