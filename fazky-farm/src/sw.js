// Custom Service Worker
// Location: src/sw.js

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

clientsClaim();
cleanupOutdatedCaches();

// This is replaced by the list of assets to precache during the build
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
