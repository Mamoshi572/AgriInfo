class AgriInfoDB {
    constructor() {
        this.dbName = 'AgriInfoDB';
        this.dbVersion = 3;
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
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('crops')) {
                    const cropsStore = db.createObjectStore('crops', { keyPath: 'id' });
                    cropsStore.createIndex('name', 'name', { unique: false });
                    cropsStore.createIndex('category', 'category', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('pests')) {
                    const pestsStore = db.createObjectStore('pests', { keyPath: 'id' });
                    pestsStore.createIndex('crop', 'crop', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('market')) {
                    const marketStore = db.createObjectStore('market', { keyPath: 'id' });
                    marketStore.createIndex('crop', 'crop', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                    // Initialize default settings
                    settingsStore.add({ key: 'lastSync', value: null });
                    settingsStore.add({ key: 'offlineMode', value: true });
                }
                
                console.log('Database schema created');
            };
        });
    }

    // Generic methods for all object stores
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

    async getAllItems(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
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
            crop.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Settings methods
    async getSetting(key) {
        const setting = await this.getItem('settings', key);
        return setting ? setting.value : null;
    }

    async setSetting(key, value) {
        return this.updateItem('settings', { key, value });
    }

    // Statistics
    async getStats() {
        const [crops, pests, market] = await Promise.all([
            this.getAllCrops(),
            this.getAllItems('pests'),
            this.getAllItems('market')
        ]);
        
        return {
            totalCrops: crops.length,
            totalPests: pests.length,
            totalMarketItems: market.length,
            lastSync: await this.getSetting('lastSync')
        };
    }

    // Export data
    async exportData() {
        const [crops, pests, market, settings] = await Promise.all([
            this.getAllCrops(),
            this.getAllItems('pests'),
            this.getAllItems('market'),
            this.getAllItems('settings')
        ]);
        
        return {
            crops,
            pests,
            market,
            settings,
            exportDate: new Date().toISOString()
        };
    }

    // Import data
    async importData(data) {
        const transaction = this.db.transaction(
            ['crops', 'pests', 'market', 'settings'],
            'readwrite'
        );
        
        const promises = [];
        
        if (data.crops) {
            const store = transaction.objectStore('crops');
            data.crops.forEach(crop => {
                promises.push(new Promise(resolve => {
                    const request = store.put(crop);
                    request.onsuccess = () => resolve();
                }));
            });
        }
        
        if (data.settings) {
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
    }
}

// Create global instance
const agriDB = new AgriInfoDB();