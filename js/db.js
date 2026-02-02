class AgriInfoDB {
    constructor() {
        this.dbName = 'AgriInfoDB_Kenya';
        this.dbVersion = 4; // Increased version for marketplace
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB initialized');
                
                // Check database size
                this.checkStorageUsage();
                
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('Upgrading database to version', this.dbVersion);
                
                // Create or update object stores
                this.createObjectStores(db);
            };
        });
    }

    createObjectStores(db) {
        // Crops store
        if (!db.objectStoreNames.contains('crops')) {
            const cropsStore = db.createObjectStore('crops', { keyPath: 'id' });
            cropsStore.createIndex('name', 'name', { unique: false });
            cropsStore.createIndex('category', 'category', { unique: false });
            cropsStore.createIndex('localName', 'localName', { unique: false });
        }
        
        // Pests store
        if (!db.objectStoreNames.contains('pests')) {
            const pestsStore = db.createObjectStore('pests', { keyPath: 'id' });
            pestsStore.createIndex('crop', 'crop', { unique: false });
        }
        
        // Market store (legacy - for market prices)
        if (!db.objectStoreNames.contains('market')) {
            const marketStore = db.createObjectStore('market', { keyPath: 'id' });
            marketStore.createIndex('crop', 'crop', { unique: false });
        }
        
        // Market Listings store (for marketplace)
        if (!db.objectStoreNames.contains('marketListings')) {
            const listingsStore = db.createObjectStore('marketListings', { keyPath: 'id' });
            listingsStore.createIndex('crop', 'crop', { unique: false });
            listingsStore.createIndex('location', 'location', { unique: false });
            listingsStore.createIndex('farmerId', 'farmerId', { unique: false });
            listingsStore.createIndex('status', 'status', { unique: false });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
            const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
            // Initialize default settings
            settingsStore.add({ key: 'lastSync', value: null });
            settingsStore.add({ key: 'offlineMode', value: true });
            settingsStore.add({ key: 'currency', value: 'KES' });
            settingsStore.add({ key: 'language', value: 'en' });
        }
        
        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            syncStore.createIndex('type', 'type', { unique: false });
            syncStore.createIndex('status', 'status', { unique: false });
        }
        
        // Weather store
        if (!db.objectStoreNames.contains('weather')) {
            const weatherStore = db.createObjectStore('weather', { keyPath: 'timestamp' });
            weatherStore.createIndex('county', 'county', { unique: false });
        }
        
        // Analytics store (for tracking usage)
        if (!db.objectStoreNames.contains('analytics')) {
            const analyticsStore = db.createObjectStore('analytics', { keyPath: 'timestamp' });
            analyticsStore.createIndex('action', 'action', { unique: false });
        }
    }

    // Generic database methods
    async addItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getItem(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllItems(storeName, indexName, indexValue) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            let request;
            if (indexName && indexValue !== undefined) {
                const index = store.index(indexName);
                request = index.getAll(indexValue);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async updateItem(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteItem(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Crop-specific methods
    async addCrop(crop) {
        if (!crop.id) {
            crop.id = `crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return this.addItem('crops', crop);
    }

    async getCrop(id) {
        return this.getItem('crops', id);
    }

    async getAllCrops() {
        return this.getAllItems('crops');
    }

    async searchCrops(query) {
        const crops = await this.getAllCrops();
        return crops.filter(crop => 
            crop.name.toLowerCase().includes(query.toLowerCase()) ||
            (crop.localName && crop.localName.toLowerCase().includes(query.toLowerCase())) ||
            crop.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Marketplace methods
    async addMarketListing(listing) {
        if (!listing.id) {
            listing.id = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return this.addItem('marketListings', listing);
    }

    async getMarketListings(filters = {}) {
        let listings = await this.getAllItems('marketListings');
        
        // Apply filters
        if (filters.county) {
            listings = listings.filter(l => l.location === filters.county);
        }
        if (filters.crop) {
            listings = listings.filter(l => 
                l.crop.toLowerCase().includes(filters.crop.toLowerCase())
            );
        }
        if (filters.farmerId) {
            listings = listings.filter(l => l.farmerId === filters.farmerId);
        }
        
        return listings;
    }

    // Settings methods
    async getSetting(key) {
        const setting = await this.getItem('settings', key);
        return setting ? setting.value : null;
    }

    async setSetting(key, value) {
        return this.updateItem('settings', { key, value });
    }

    // Sync queue methods
    async addToSyncQueue(data) {
        const queueItem = {
            ...data,
            id: Date.now(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0
        };
        return this.addItem('syncQueue', queueItem);
    }

    async getUnsyncedItems() {
        return this.getAllItems('syncQueue', 'status', 'pending');
    }

    async markAsSynced(itemId) {
        const item = await this.getItem('syncQueue', itemId);
        if (item) {
            item.status = 'synced';
            item.syncedAt = new Date().toISOString();
            await this.updateItem('syncQueue', item);
        }
    }

    // Statistics
    async getStats() {
        const [crops, pests, market, listings] = await Promise.all([
            this.getAllCrops(),
            this.getAllItems('pests'),
            this.getAllItems('market'),
            this.getAllItems('marketListings')
        ]);
        
        // Calculate storage usage
        const usage = await this.getStorageUsage();
        
        return {
            totalCrops: crops.length,
            totalPests: pests.length,
            totalMarketItems: market.length,
            totalListings: listings.length,
            lastSync: await this.getSetting('lastSync'),
            storageUsed: usage
        };
    }

    async getStorageUsage() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
                return `${usedMB}MB / ${quotaMB}MB`;
            }
            return 'Unknown';
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return 'Unknown';
        }
    }

    checkStorageUsage() {
        // Warn if storage is getting full
        this.getStorageUsage().then(usage => {
            const usedMB = parseFloat(usage.split('MB')[0]);
            if (usedMB > 50) { // Warn if using more than 50MB
                console.warn('Storage usage is high:', usage);
                // Could show a notification to the user
            }
        });
    }

    // Export data
    async exportData() {
        const [crops, pests, market, listings, settings, weather, analytics] = await Promise.all([
            this.getAllCrops(),
            this.getAllItems('pests'),
            this.getAllItems('market'),
            this.getAllItems('marketListings'),
            this.getAllItems('settings'),
            this.getAllItems('weather'),
            this.getAllItems('analytics')
        ]);
        
        return {
            metadata: {
                exportDate: new Date().toISOString(),
                appVersion: '2.0',
                country: 'Kenya'
            },
            crops,
            pests,
            market,
            listings,
            settings,
            weather,
            analytics,
            summary: {
                totalCrops: crops.length,
                totalListings: listings.length,
                totalWeatherEntries: weather.length
            }
        };
    }

    // Import data
    async importData(data) {
        const transaction = this.db.transaction(
            ['crops', 'pests', 'market', 'marketListings', 'settings', 'weather'],
            'readwrite'
        );
        
        const promises = [];
        
        // Import each data type
        if (data.crops && Array.isArray(data.crops)) {
            const store = transaction.objectStore('crops');
            data.crops.forEach(crop => {
                promises.push(new Promise(resolve => {
                    const request = store.put(crop);
                    request.onsuccess = () => resolve();
                }));
            });
        }
        
        if (data.listings && Array.isArray(data.listings)) {
            const store = transaction.objectStore('marketListings');
            data.listings.forEach(listing => {
                promises.push(new Promise(resolve => {
                    const request = store.put(listing);
                    request.onsuccess = () => resolve();
                }));
            });
        }
        
        if (data.settings && Array.isArray(data.settings)) {
            const store = transaction.objectStore('settings');
            data.settings.forEach(setting => {
                promises.push(new Promise(resolve => {
                    const request = store.put(setting);
                    request.onsuccess = () => resolve();
                }));
            });
        }
        
        await Promise.all(promises);
        await this.setSetting('lastSync', new Date().toISOString());
        
        return { success: true, importedItems: promises.length };
    }

    // Analytics tracking
    async trackEvent(action, data = {}) {
        const event = {
            action,
            data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            online: navigator.onLine
        };
        
        await this.addItem('analytics', event);
        
        // Also queue for sync if online
        if (navigator.onLine) {
            await this.addToSyncQueue({
                type: 'analytics',
                data: event
            });
        }
    }

    // Backup and restore
    async createBackup() {
        return this.exportData();
    }

    async restoreBackup(backupData) {
        if (!backupData || typeof backupData !== 'object') {
            throw new Error('Invalid backup data');
        }
        
        // Create a backup of current data first
        const currentBackup = await this.createBackup();
        const backupTimestamp = new Date().toISOString();
        
        try {
            // Clear existing data
            await Promise.all([
                this.clearStore('crops'),
                this.clearStore('marketListings'),
                this.clearStore('settings')
            ]);
            
            // Import new data
            await this.importData(backupData);
            
            // Save backup of old data
            localStorage.setItem(`backup_${backupTimestamp}`, JSON.stringify(currentBackup));
            
            return { success: true, backupCreated: backupTimestamp };
        } catch (error) {
            console.error('Restore failed:', error);
            
            // Try to restore from backup
            try {
                await this.importData(currentBackup);
            } catch (restoreError) {
                console.error('Failed to restore original data:', restoreError);
            }
            
            throw error;
        }
    }
}

// Create global instance
const agriDB = new AgriInfoDB();

// Helper function to check database health
window.checkDatabaseHealth = async function() {
    try {
        const stats = await agriDB.getStats();
        const isHealthy = stats.totalCrops >= 0; // Basic health check
        
        console.log('Database Health Check:', {
            healthy: isHealthy,
            stats: stats,
            timestamp: new Date().toISOString()
        });
        
        return { healthy: isHealthy, ...stats };
    } catch (error) {
        console.error('Database health check failed:', error);
        return { healthy: false, error: error.message };
    }
};

// Auto health check on load
setTimeout(() => {
    if (agriDB.db) {
        checkDatabaseHealth();
    }
}, 5000);