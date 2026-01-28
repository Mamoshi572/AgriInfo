// Background sync functionality for AgriInfo
class AgriSync {
    constructor() {
        this.syncQueue = [];
        this.init();
    }

    init() {
        // Register sync events
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            this.registerBackgroundSync();
        }
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.processQueue());
    }

    registerBackgroundSync() {
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('agriinfo-sync')
                .then(() => console.log('Background sync registered'))
                .catch(err => console.log('Background sync registration failed:', err));
        });
    }

    addToQueue(data) {
        this.syncQueue.push({
            ...data,
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        });
        
        // Store queue in IndexedDB
        this.saveQueue();
        
        // Try to process if online
        if (navigator.onLine) {
            this.processQueue();
        }
    }

    async saveQueue() {
        try {
            await agriDB.setSetting('syncQueue', JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('Error saving sync queue:', error);
        }
    }

    async loadQueue() {
        try {
            const queueData = await agriDB.getSetting('syncQueue');
            if (queueData) {
                this.syncQueue = JSON.parse(queueData);
            }
        } catch (error) {
            console.error('Error loading sync queue:', error);
        }
    }

    async processQueue() {
        if (this.syncQueue.length === 0 || !navigator.onLine) {
            return;
        }

        console.log(`Processing ${this.syncQueue.length} items in sync queue`);
        
        const successItems = [];
        const failedItems = [];
        
        for (const item of this.syncQueue) {
            try {
                // In production, this would send data to your server
                await this.sendToServer(item);
                successItems.push(item.id);
            } catch (error) {
                console.error('Sync error for item:', item, error);
                failedItems.push(item);
            }
        }
        
        // Remove successfully synced items
        this.syncQueue = this.syncQueue.filter(item => 
            !successItems.includes(item.id)
        );
        
        // Update queue in storage
        await this.saveQueue();
        
        // Update UI if items were synced
        if (successItems.length > 0) {
            this.updateSyncStatus(`Synced ${successItems.length} items`);
        }
    }

    async sendToServer(data) {
        // Simulate server request
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // For demo purposes, simulate 90% success rate
                if (Math.random() > 0.1) {
                    resolve();
                } else {
                    reject(new Error('Server error'));
                }
            }, 1000);
        });
    }

    updateSyncStatus(message) {
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            statusElement.textContent = message;
            setTimeout(() => {
                statusElement.textContent = 'Sync';
            }, 3000);
        }
    }

    // Data collection methods for offline changes
    recordCropUpdate(cropData) {
        this.addToQueue({
            type: 'crop_update',
            data: cropData,
            action: 'update'
        });
    }

    recordNewCrop(cropData) {
        this.addToQueue({
            type: 'crop_create',
            data: cropData,
            action: 'create'
        });
    }

    recordPriceUpdate(priceData) {
        this.addToQueue({
            type: 'price_update',
            data: priceData,
            action: 'update'
        });
    }
}

// Create global sync instance
const agriSync = new AgriSync();