const CACHE_NAME = 'agriinfo-v1';
const OFFLINE_URL = '/offline.html';
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
    '/images/icons/icon-512x512.png'
];

const DYNAMIC_CACHE = 'agriinfo-dynamic-v1';
const API_CACHE = 'agriinfo-api-v1';

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker installed');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== API_CACHE) {
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip chrome-extension requests
    if (event.request.url.startsWith('chrome-extension://')) return;
    
    const requestUrl = new URL(event.request.url);
    
    // API requests strategy
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(apiFirstStrategy(event));
        return;
    }
    
    // Static assets strategy
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then(response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        // Cache the new response
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // If offline and page request, show offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        // Return offline placeholder for images
                        if (event.request.headers.get('accept').includes('image')) {
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180"><text x="20" y="90" font-family="Arial" font-size="16">🌱 Offline Image</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                    });
            })
    );
});

// API First strategy for API requests
function apiFirstStrategy(event) {
    return caches.open(API_CACHE)
        .then(cache => {
            return fetch(event.request)
                .then(response => {
                    // Cache successful responses
                    if (response.status === 200) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached response if offline
                    return cache.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return fallback response
                            return new Response(
                                JSON.stringify({ 
                                    status: 'offline', 
                                    message: 'You are offline. Data may be outdated.' 
                                }),
                                { 
                                    headers: { 
                                        'Content-Type': 'application/json',
                                        'X-Offline': 'true'
                                    } 
                                }
                            );
                        });
                });
        });
}

// Background sync handler
self.addEventListener('sync', event => {
    if (event.tag === 'agriinfo-sync') {
        console.log('Background sync triggered');
        event.waitUntil(syncData());
    }
});

// Push notification handler
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New update available!',
        icon: '/images/icons/icon-192x192.png',
        badge: '/images/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('AgriInfo Update', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Sync data in background
async function syncData() {
    try {
        // Get sync queue from IndexedDB
        const db = await openDB();
        const queue = await getAllFromStore(db, 'syncQueue');
        
        if (queue.length === 0) {
            return;
        }
        
        // Process each item in queue
        for (const item of queue) {
            try {
                // Send to server (simulated)
                await sendToServer(item);
                
                // Remove from queue after successful sync
                await deleteFromStore(db, 'syncQueue', item.id);
                
            } catch (error) {
                console.error('Failed to sync item:', item, error);
            }
        }
        
        // Notify clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'syncComplete',
                message: `Synced ${queue.length} items`
            });
        });
        
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Helper functions for IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AgriInfoDB', 3);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

function deleteFromStore(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Simulate server send
function sendToServer(data) {
    return new Promise((resolve, reject) => {
        // Simulate network request
        setTimeout(() => {
            if (Math.random() > 0.1) { // 90% success rate
                resolve();
            } else {
                reject(new Error('Server error'));
            }
        }, 1000);
    });
}