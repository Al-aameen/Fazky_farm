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
  'feed_inventory_log'
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

export async function setCachedData(table, data) {
  const db = await initDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);
  await store.clear();
  for (const item of data) {
    await store.put(item);
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

export async function flushSyncQueue(supabase) {
  if (!supabase) return 0;
  const queue = await getSyncQueue();
  if (queue.length === 0) return 0;

  // Process items in order
  for (const item of queue) {
    const { id, table, action, payload } = item;
    try {
      if (action === 'INSERT') {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      } else if (action === 'UPDATE') {
        const { error } = await supabase.from(table).update(payload).eq('id', payload.id);
        if (error) throw error;
      } else if (action === 'DELETE') {
        const { error } = await supabase.from(table).delete().eq('id', payload.id);
        if (error) throw error;
      }
      // Dequeue after successful sync
      await dequeueSync(id);
    } catch (err) {
      console.error(`Failed to sync item ${id} in queue:`, err);
      // Stop execution of the rest of the queue to maintain ordering
      break;
    }
  }

  const remaining = await getSyncQueue();
  return remaining.length;
}
