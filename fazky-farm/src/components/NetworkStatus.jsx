import React from 'react';
import { useData } from '../hooks/useData';
import { Wifi, WifiOff, CheckCircle2 } from 'lucide-react';

export default function NetworkStatus() {
  const { isOnline } = useData();

  if (isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-primary text-xs font-semibold rounded-full shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-accent text-xs font-semibold rounded-full shadow-sm animate-pulse">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline</span>
    </div>
  );
}
