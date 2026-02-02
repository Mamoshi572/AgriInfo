const CACHE_NAME = 'agriinfo-kenya-v2.0';
const OFFLINE_URL = '/offline.html';
const API_CACHE = 'agriinfo-api-v1';
const IMAGE_CACHE = 'agriinfo-images-v1';
const DYNAMIC_CACHE = 'agriinfo-dynamic-v1';

// Core assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/db.js',
    '/js/sync.js',
    '/manifest.json',
    '/images/icons/icon-72x72.png',
    '/images/icons/icon-96x96.png',
    '/images/icons/icon-128x128.png',
    '/images/icons/icon-144x144.png',
    '/images/icons/icon-152x152.png',
    '/images/icons/icon-192x192.png',
    '/images/icons/icon-384x384.png',
    '/images/icons/icon-512x512.png',
    '/images/favicon.ico'
];

// Kenyan agricultural images to cache
const KENYAN_IMAGES = [
    '/images/maize.jpg',
    '/images/coffee.jpg',
    '/images/tea.jpg',
    '/images/farmers.jpg',
    '/images/market.jpg'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME)
                .then(cache => {
                    console.log('Caching static assets');
                    return cache.addAll(STATIC_ASSETS);
                }),
            
            // Cache Kenyan images
            caches.open(IMAGE_CACHE)
                .then(cache => {
                    console.log('Caching Kenyan agricultural images');
                    return cache.addAll(KENYAN_IMAGES.map(img => 
                        img.replace('.jpg', '-placeholder.jpg')
                    ));
                })
        ])
        .then(() => {
            console.log('All assets cached successfully');
            return self.skipWaiting();
        })
        .catch(error => {
            console.error('Cache installation failed:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches that don't match current names
                    if (![CACHE_NAME, API_CACHE, IMAGE_CACHE, DYNAMIC_CACHE].includes(cacheName)) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - sophisticated caching strategies
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || 
        url.protocol === 'chrome-extension:' ||
        url.hostname === 'chrome.google.com') {
        return;
    }
    
    // API requests - Network First with Cache Fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(apiStrategy(event));
        return;
    }
    
    // Image requests - Cache First with Network Fallback
    if (event.request.destination === 'image') {
        event.respondWith(imageStrategy(event));
        return;
    }
    
    // HTML pages - Network First with Offline Fallback
    if (event.request.headers.get('accept').includes('text/html')) {
        event.respondWith(htmlStrategy(event));
        return;
    }
    
    // Static assets - Cache First
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset))) {
        event.respondWith(staticStrategy(event));
        return;
    }
    
    // Everything else - Network First with Cache Fallback
    event.respondWith(networkFirstStrategy(event));
});

// Strategy: API requests (Network First)
async function apiStrategy(event) {
    const cache = await caches.open(API_CACHE);
    
    try {
        // Try network first
        const networkResponse = await fetch(event.request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            cache.put(event.request, clonedResponse);
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
            console.log('Serving API from cache:', event.request.url);
            
            // Add cache header to indicate offline data
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Cache', 'HIT');
            headers.set('X-Offline', 'true');
            
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: headers
            });
        }
        
        // No cache available, return offline response
        return new Response(
            JSON.stringify({ 
                status: 'offline', 
                message: 'You are offline. Data may be outdated.',
                timestamp: new Date().toISOString()
            }),
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Offline': 'true'
                } 
            }
        );
    }
}

// Strategy: Images (Cache First)
async function imageStrategy(event) {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedResponse = await cache.match(event.request);
    
    if (cachedResponse) {
        // Return cached image immediately
        return cachedResponse;
    }
    
    try {
        // Try network
        const networkResponse = await fetch(event.request);
        
        // Cache the response for future use
        if (networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            cache.put(event.request, clonedResponse);
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, return placeholder
        return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
                <rect width="400" height="300" fill="#f0f0f0"/>
                <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
                    🌱 Image not available offline
                </text>
                <text x="200" y="170" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">
                    ${event.request.url.split('/').pop()}
                </text>
            </svg>`,
            { 
                headers: { 
                    'Content-Type': 'image/svg+xml',
                    'X-Offline': 'true'
                } 
            }
        );
    }
}

// Strategy: HTML pages (Network First)
async function htmlStrategy(event) {
    try {
        // Try network first for fresh content
        const networkResponse = await fetch(event.request);
        
        // Update cache in background
        const clonedResponse = networkResponse.clone();
        caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, clonedResponse);
        });
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // No cache, serve offline page
        return caches.match(OFFLINE_URL);
    }
}

// Strategy: Static assets (Cache First)
async function staticStrategy(event) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Should never happen as static assets are cached on install
    return fetch(event.request);
}

// Strategy: Network First with Cache Fallback
async function networkFirstStrategy(event) {
    try {
        const networkResponse = await fetch(event.request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request, clonedResponse);
            });
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // No cache available
        return new Response('Offline content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Background sync handler
self.addEventListener('sync', event => {
    if (event.tag === 'agriinfo-sync') {
        console.log('Background sync triggered:', event.tag);
        event.waitUntil(syncPendingData());
    }
    
    if (event.tag.startsWith('agriinfo-')) {
        console.log('Custom sync event:', event.tag);
        event.waitUntil(handleCustomSync(event.tag));
    }
});

// Push notification handler
self.addEventListener('push', event => {
    console.log('Push notification received:', event);
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        data = {
            title: 'AgriInfo Kenya',
            body: event.data ? event.data.text() : 'New update available!',
            icon: '/images/icons/icon-192x192.png'
        };
    }
    
    const options = {
        body: data.body || 'New agricultural information available',
        icon: data.icon || '/images/icons/icon-192x192.png',
        badge: '/images/icons/icon-72x72.png',
        image: data.image || '/images/kenya-agriculture.jpg',
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
        data: {
            url: data.url || '/',
            type: data.type || 'general',
            dateOfArrival: Date.now(),
            primaryKey: data.id || '1'
        },
        actions: [
            {
                action: 'open',
                title: 'Open App',
                icon: '/images/icons/open-icon.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/images/icons/close-icon.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || '🌱 AgriInfo Kenya',
            options
        )
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'open' || event.action === '') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(windowClients => {
                    // Focus existing window or open new one
                    for (const client of windowClients) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    
                    if (clients.openWindow) {
                        return clients.openWindow(event.notification.data.url || '/');
                    }
                })
        );
    }
    
    // Handle other actions
    switch (event.action) {
        case 'dismiss':
            // Just close the notification
            break;
        default:
            // Default action - open the app
            event.waitUntil(clients.openWindow('/'));
    }
});

// Background sync function
async function syncPendingData() {
    console.log('Starting background sync...');
    
    try {
        // Get sync queue from IndexedDB
        const db = await openIndexedDB();
        const pendingItems = await getPendingSyncItems(db);
        
        if (pendingItems.length === 0) {
            console.log('No pending items to sync');
            return;
        }
        
        console.log(`Syncing ${pendingItems.length} items in background`);
        
        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Process each item
        for (const item of pendingItems) {
            try {
                // Simulate server sync (replace with actual API call)
                await syncToServer(item);
                
                // Mark as synced
                await markAsSynced(db, item.id);
                results.successful++;
                
                console.log(`Successfully synced item ${item.id}`);
                
            } catch (error) {
                console.error(`Failed to sync item ${item.id}:`, error);
                results.failed++;
                results.errors.push({
                    id: item.id,
                    error: error.message
                });
                
                // Update retry count
                await updateRetryCount(db, item.id);
            }
        }
        
        // Notify clients about sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'syncComplete',
                data: {
                    timestamp: new Date().toISOString(),
                    results: results
                }
            });
        });
        
        console.log('Background sync completed:', results);
        
    } catch (error) {
        console.error('Background sync failed:', error);
        
        // Notify clients about failure
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'syncFailed',
                data: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            });
        });
    }
}

// Custom sync handler
async function handleCustomSync(tag) {
    const syncType = tag.replace('agriinfo-', '');
    
    switch (syncType) {
        case 'weather':
            await syncWeatherData();
            break;
        case 'prices':
            await syncMarketPrices();
            break;
        case 'listings':
            await syncMarketListings();
            break;
        default:
            console.log(`Unknown sync type: ${syncType}`);
    }
}

// Helper functions for IndexedDB
async function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AgriInfoDB_Kenya', 4);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getPendingSyncItems(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('status');
        const request = index.getAll('pending');
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

async function markAsSynced(db, itemId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.get(itemId);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const item = request.result;
            if (item) {
                item.status = 'synced';
                item.syncedAt = new Date().toISOString();
                
                const updateRequest = store.put(item);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
    });
}

async function updateRetryCount(db, itemId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.get(itemId);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const item = request.result;
            if (item) {
                item.attempts = (item.attempts || 0) + 1;
                item.lastError = 'Background sync failed';
                item.lastAttempt = new Date().toISOString();
                
                const updateRequest = store.put(item);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
    });
}

// Simulated server sync functions
async function syncToServer(item) {
    // In production, replace with actual API calls
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate 90% success rate
            if (Math.random() > 0.1) {
                resolve({
                    id: item.id,
                    serverId: `server_${Date.now()}`,
                    timestamp: new Date().toISOString()
                });
            } else {
                reject(new Error('Simulated server error'));
            }
        }, 1000);
    });
}

async function syncWeatherData() {
    console.log('Syncing weather data...');
    // Implement weather data sync
}

async function syncMarketPrices() {
    console.log('Syncing market prices...');
    // Implement market prices sync
}

async function syncMarketListings() {
    console.log('Syncing market listings...');
    // Implement market listings sync
}

// Periodic cache cleanup
async function cleanupOldCaches() {
    const cacheNames = await caches.keys();
    const currentCaches = [CACHE_NAME, API_CACHE, IMAGE_CACHE, DYNAMIC_CACHE];
    
    for (const cacheName of cacheNames) {
        if (!currentCaches.includes(cacheName)) {
            await caches.delete(cacheName);
            console.log('Deleted old cache:', cacheName);
        }
    }
}

// Run cleanup once a week
setInterval(cleanupOldCaches, 604800000); // 7 days

// Message handler for client communication
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            });
            break;
            
        case 'GET_CACHE_INFO':
            caches.keys().then(cacheNames => {
                event.ports[0].postMessage({
                    type: 'CACHE_INFO',
                    data: {
                        cacheNames,
                        timestamp: new Date().toISOString()
                    }
                });
            });
            break;
            
        case 'TRIGGER_SYNC':
            syncPendingData();
            break;
    }
});

// Register periodic sync for different data types
async function registerPeriodicSync() {
    if ('periodicSync' in self.registration) {
        try {
            await self.registration.periodicSync.register('weather', {
                minInterval: 24 * 60 * 60 * 1000, // 1 day
            });
            
            await self.registration.periodicSync.register('prices', {
                minInterval: 6 * 60 * 60 * 1000, // 6 hours
            });
            
            console.log('Periodic sync registered');
        } catch (error) {
            console.log('Periodic sync not supported:', error);
        }
    }
}

// Register periodic sync when service worker activates
self.addEventListener('activate', event => {
    event.waitUntil(registerPeriodicSync());
});