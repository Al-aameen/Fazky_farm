import React from 'react';
import { useData } from '../hooks/useData';
import { Wifi, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';

export default function NetworkStatus() {
  const { isOnline, isSyncing, queuedCount, flushQueue } = useData();

  if (isOnline) {
    if (queuedCount > 0 || isSyncing) {
      return (
        <button
          onClick={flushQueue}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-accent text-xs font-semibold rounded-full shadow-sm hover:bg-amber-100 transition-all animate-pulse"
          title="Click to force sync"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing {queuedCount} records...</span>
        </button>
      );
    }
    
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-primary text-xs font-semibold rounded-full shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Online · Synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-accent text-xs font-semibold rounded-full shadow-sm animate-pulse">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline · {queuedCount} queued</span>
    </div>
  );
}
