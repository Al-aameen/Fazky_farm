// Deprecated: Offline-first IndexedDB queue removed in favor of direct Supabase connection.
export const TABLE_NAMES = [];
export async function initDB() { return null; }
export async function getCachedData() { return []; }
export async function setCachedData() { return; }
export async function putCachedItem() { return; }
export async function deleteCachedItem() { return; }
export async function enqueueSync() { return; }
export async function getSyncQueue() { return []; }
export async function flushSyncQueue() { return 0; }
