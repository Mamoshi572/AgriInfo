// Background sync functionality for AgriInfo Kenya
class AgriSync {
    constructor() {
        this.syncQueue = [];
        this.syncInProgress = false;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        this.init();
    }

    init() {
        // Load existing queue from IndexedDB
        this.loadQueue();
        
        // Register sync events if supported
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            this.registerBackgroundSync();
        }
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Periodic sync check
        setInterval(() => this.checkSyncNeeded(), 300000); // Every 5 minutes
        
        console.log('AgriSync initialized');
    }

    async loadQueue() {
        try {
            const queueData = await agriDB.getAllItems('syncQueue', 'status', 'pending');
            this.syncQueue = queueData;
            console.log(`Loaded ${queueData.length} pending sync items`);
        } catch (error) {
            console.error('Error loading sync queue:', error);
        }
    }

    registerBackgroundSync() {
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('agriinfo-sync')
                .then(() => console.log('Background sync registered'))
                .catch(err => console.log('Background sync registration failed:', err));
        });
    }

    async addToQueue(data) {
        const queueItem = {
            ...data,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            timestamp: new Date().toISOString(),
            status: 'pending',
            attempts: 0
        };
        
        this.syncQueue.push(queueItem);
        
        // Store in IndexedDB
        await this.saveQueueItem(queueItem);
        
        // Try to process if online
        if (navigator.onLine) {
            this.processQueue();
        }
        
        return queueItem.id;
    }

    async saveQueueItem(item) {
        try {
            await agriDB.addItem('syncQueue', item);
        } catch (error) {
            console.error('Error saving sync queue item:', error);
        }
    }

    async updateQueueItem(itemId, updates) {
        try {
            const item = await agriDB.getItem('syncQueue', itemId);
            if (item) {
                Object.assign(item, updates);
                await agriDB.updateItem('syncQueue', item);
            }
        } catch (error) {
            console.error('Error updating sync queue item:', error);
        }
    }

    async removeFromQueue(itemId) {
        try {
            await agriDB.deleteItem('syncQueue', itemId);
            this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
        } catch (error) {
            console.error('Error removing from sync queue:', error);
        }
    }

    async processQueue() {
        if (this.syncInProgress || this.syncQueue.length === 0 || !navigator.onLine) {
            return;
        }

        this.syncInProgress = true;
        console.log(`Processing ${this.syncQueue.length} items in sync queue`);

        const successItems = [];
        const failedItems = [];
        
        // Process items with retry logic
        for (const item of this.syncQueue) {
            try {
                // Skip if too many attempts
                if (item.attempts >= this.maxRetries) {
                    console.warn(`Item ${item.id} exceeded max retries`);
                    failedItems.push({ ...item, error: 'Max retries exceeded' });
                    continue;
                }
                
                // Update attempt count
                item.attempts = (item.attempts || 0) + 1;
                await this.updateQueueItem(item.id, { attempts: item.attempts });
                
                // Send to server
                await this.sendToServer(item);
                successItems.push(item.id);
                
                // Mark as synced
                await this.updateQueueItem(item.id, { 
                    status: 'synced',
                    syncedAt: new Date().toISOString()
                });
                
                // Log success
                console.log(`Successfully synced item: ${item.id} (type: ${item.type})`);
                
            } catch (error) {
                console.error('Sync error for item:', item, error);
                
                // Update error info
                await this.updateQueueItem(item.id, {
                    lastError: error.message,
                    lastAttempt: new Date().toISOString()
                });
                
                failedItems.push({ ...item, error: error.message });
                
                // If it's a network error, stop processing and retry later
                if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
                    console.log('Network error detected, stopping sync');
                    break;
                }
            }
            
            // Small delay between items to avoid overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Remove successfully synced items from local queue
        this.syncQueue = this.syncQueue.filter(item => 
            !successItems.includes(item.id)
        );
        
        this.syncInProgress = false;
        
        // Update UI if items were synced
        if (successItems.length > 0) {
            this.updateSyncStatus(`Synced ${successItems.length} items`);
            
            // Show notification
            if (window.agriApp) {
                window.agriApp.showNotification(
                    `Synced ${successItems.length} item${successItems.length > 1 ? 's' : ''}`,
                    'success'
                );
            }
        }
        
        // Schedule retry for failed items if any
        if (failedItems.length > 0) {
            console.log(`${failedItems.length} items failed to sync, will retry later`);
            this.scheduleRetry();
        }
        
        // Update last sync time
        await agriDB.setSetting('lastSync', new Date().toISOString());
    }

    async sendToServer(data) {
        // In production, this would send to your actual backend API
        // For demo purposes, simulate network request
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate 85% success rate for demo
                if (Math.random() > 0.15) {
                    // Simulate successful response
                    const response = {
                        success: true,
                        id: data.id,
                        serverId: `server_${Date.now()}`,
                        timestamp: new Date().toISOString()
                    };
                    resolve(response);
                } else {
                    // Simulate various errors
                    const errors = [
                        new Error('Network request failed'),
                        new Error('Server timeout'),
                        new Error('Invalid data format'),
                        new Error('Authentication required')
                    ];
                    reject(errors[Math.floor(Math.random() * errors.length)]);
                }
            }, 500 + Math.random() * 1000); // Random delay between 500-1500ms
        });
    }

    scheduleRetry() {
        // Schedule retry after delay
        setTimeout(() => {
            if (navigator.onLine && this.syncQueue.length > 0) {
                console.log('Retrying failed sync items...');
                this.processQueue();
            }
        }, this.retryDelay);
    }

    handleOffline() {
        console.log('App went offline, pausing sync operations');
        this.updateSyncStatus('Offline - Sync paused');
    }

    checkSyncNeeded() {
        // Check if sync is needed based on various conditions
        const hasPendingItems = this.syncQueue.length > 0;
        const isOnline = navigator.onLine;
        const lastSync = localStorage.getItem('lastSyncAttempt');
        
        // Sync if online and has pending items, or if last sync was more than 1 hour ago
        if (isOnline && (hasPendingItems || 
            (!lastSync || Date.now() - new Date(lastSync).getTime() > 3600000))) {
            this.processQueue();
        }
    }

    updateSyncStatus(message) {
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            statusElement.textContent = message;
            setTimeout(() => {
                if (statusElement.textContent === message) {
                    statusElement.textContent = 'Sync';
                }
            }, 5000);
        }
    }

    // Specific data collection methods
    recordNewListing(listingData) {
        return this.addToQueue({
            type: 'listing_create',
            action: 'create',
            data: listingData,
            collection: 'marketListings'
        });
    }

    recordListingUpdate(listingData) {
        return this.addToQueue({
            type: 'listing_update',
            action: 'update',
            data: listingData,
            collection: 'marketListings'
        });
    }

    recordListingDeletion(listingId) {
        return this.addToQueue({
            type: 'listing_delete',
            action: 'delete',
            data: { id: listingId },
            collection: 'marketListings'
        });
    }

    recordCropUpdate(cropData) {
        return this.addToQueue({
            type: 'crop_update',
            action: 'update',
            data: cropData,
            collection: 'crops'
        });
    }

    recordWeatherUpdate(weatherData) {
        return this.addToQueue({
            type: 'weather_update',
            action: 'create',
            data: weatherData,
            collection: 'weather'
        });
    }

    recordAnalyticsEvent(eventData) {
        return this.addToQueue({
            type: 'analytics',
            action: 'create',
            data: eventData,
            collection: 'analytics'
        });
    }

    // Batch operations
    async batchSync(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return { success: false, error: 'No items to sync' };
        }
        
        const batchId = `batch_${Date.now()}`;
        console.log(`Starting batch sync ${batchId} with ${items.length} items`);
        
        const results = {
            batchId,
            total: items.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        for (const item of items) {
            try {
                await this.addToQueue(item);
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    item,
                    error: error.message
                });
            }
        }
        
        // Start processing if online
        if (navigator.onLine) {
            this.processQueue();
        }
        
        return results;
    }

    // Get sync statistics
    async getSyncStats() {
        try {
            const pending = await agriDB.getAllItems('syncQueue', 'status', 'pending');
            const synced = await agriDB.getAllItems('syncQueue', 'status', 'synced');
            const failed = await agriDB.getAllItems('syncQueue', 'status', 'failed');
            
            return {
                pending: pending.length,
                synced: synced.length,
                failed: failed.length,
                total: pending.length + synced.length + failed.length,
                lastSync: await agriDB.getSetting('lastSync')
            };
        } catch (error) {
            console.error('Error getting sync stats:', error);
            return null;
        }
    }

    // Clear old sync records
    async cleanupOldRecords(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const allRecords = await agriDB.getAllItems('syncQueue');
            const oldRecords = allRecords.filter(record => {
                const recordDate = new Date(record.timestamp || record.createdAt);
                return recordDate < cutoffDate && record.status === 'synced';
            });
            
            console.log(`Found ${oldRecords.length} old records to clean up`);
            
            for (const record of oldRecords) {
                await agriDB.deleteItem('syncQueue', record.id);
            }
            
            return { cleaned: oldRecords.length };
        } catch (error) {
            console.error('Error cleaning up old records:', error);
            return { cleaned: 0, error: error.message };
        }
    }
}

// Create global sync instance
const agriSync = new AgriSync();

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AgriSync, agriSync };
}

// Auto cleanup every week
setInterval(() => {
    agriSync.cleanupOldRecords(7); // Keep only 7 days of history
}, 604800000); // 7 days in milliseconds