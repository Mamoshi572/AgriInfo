class AgriInfoApp {
    constructor() {
        this.currentSection = 'home';
        this.cropData = [];
        this.marketplace = null;
        this.userProfile = null;
        this.initializeKenyanContext();
        this.init();
    }

    initializeKenyanContext() {
        // Kenyan specific configuration
        this.config = {
            currency: 'KES',
            language: 'en',
            counties: [
                'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret',
                'Thika', 'Kitale', 'Malindi', 'Kakamega', 'Kisii'
            ],
            crops: {
                maize: { localName: 'Mahindi', seedRate: 25 },
                beans: { localName: 'Maharagwe', seedRate: 40 },
                wheat: { localName: 'Ngano', seedRate: 100 },
                rice: { localName: 'Mchele', seedRate: 40 }
            },
            measurements: {
                land: 'acres',
                weight: 'kgs',
                volume: 'liters'
            }
        };
    }

    async init() {
        try {
            // Initialize database
            await agriDB.init();
            
            // Initialize marketplace
            this.marketplace = new AgriMarketplace(this);
            await this.marketplace.initialize();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Check connection status
            this.checkConnection();
            
            // Setup periodic sync
            this.setupAutoSync();
            
            // Update UI
            this.updateKenyanContext();
            
            console.log('AgriInfo Kenya App initialized');
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Failed to initialize app. Please refresh.');
        }
    }

    updateKenyanContext() {
        // Update UI with Kenyan context
        const currencyElements = document.querySelectorAll('[data-currency]');
        currencyElements.forEach(el => {
            el.textContent = this.config.currency;
        });
        
        // Update crop select options with Kenyan crops
        const cropSelect = document.getElementById('crop-type');
        if (cropSelect) {
            cropSelect.innerHTML = Object.entries(this.config.crops)
                .map(([value, data]) => 
                    `<option value="${value}">${data.localName} (${value})</option>`
                ).join('');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('href').substring(1);
                this.showSection(sectionId);
            });
        });

        // Action buttons
        document.getElementById('load-data')?.addEventListener('click', () => this.loadKenyanSampleData());
        document.getElementById('clear-cache')?.addEventListener('click', () => this.clearCache());
        document.getElementById('export-data')?.addEventListener('click', () => this.exportData());
        document.getElementById('sync-btn')?.addEventListener('click', () => this.manualSync());

        // Search functionality
        document.getElementById('search-btn')?.addEventListener('click', () => this.searchCrops());
        document.getElementById('crop-search')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.searchCrops();
        });

        // Calculator buttons
        document.getElementById('calculate-seed')?.addEventListener('click', () => this.calculateSeedKenyan());
        document.getElementById('calculate-water')?.addEventListener('click', () => this.calculateWater());

        // Weather button
        document.getElementById('get-weather')?.addEventListener('click', () => this.getKenyanWeather());
        document.getElementById('get-weather-tool')?.addEventListener('click', () => this.getKenyanWeather());

        // Connection status
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
        
        // Service worker messages
        navigator.serviceWorker?.addEventListener('message', (event) => {
            if (event.data?.type === 'syncComplete') {
                this.showNotification(event.data.message);
            }
        });
    }

    async loadInitialData() {
        try {
            const stats = await agriDB.getStats();
            this.updateStats(stats);
            
            // Load crops for crops section
            const crops = await agriDB.getAllCrops();
            if (crops.length > 0) {
                this.cropData = crops;
                this.displayCrops(crops);
            }
            
            // Update last sync time
            this.updateLastSync();
            
            // Load user profile if exists
            await this.loadUserProfile();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadUserProfile() {
        const savedProfile = localStorage.getItem('agriUserProfile');
        if (savedProfile) {
            this.userProfile = JSON.parse(savedProfile);
            this.updateProfileUI();
        }
    }

    updateProfileUI() {
        const container = document.getElementById('profile-container');
        if (!container || !this.userProfile) return;
        
        container.innerHTML = `
            <div class="user-profile-card">
                <div class="profile-header">
                    <h3>👨‍🌾 ${this.userProfile.name || 'Farmer'}</h3>
                    ${this.userProfile.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
                </div>
                <div class="profile-details">
                    <p><strong>Location:</strong> ${this.userProfile.location || 'Not set'}</p>
                    <p><strong>Farm Size:</strong> ${this.userProfile.farmSize || 'Not set'}</p>
                    <p><strong>Main Crops:</strong> ${(this.userProfile.crops || []).join(', ') || 'None'}</p>
                    <p><strong>Joined:</strong> ${new Date(this.userProfile.joined).toLocaleDateString()}</p>
                </div>
                <button class="btn-secondary" onclick="agriApp.editProfile()">Edit Profile</button>
            </div>
        `;
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected section
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
            
            // Update active nav link
            document.querySelector(`.nav-link[href="#${sectionId}"]`)?.classList.add('active');
            
            // Load section-specific data
            this.loadSectionData(sectionId);
            
            // Scroll to top of section
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async loadSectionData(sectionId) {
        switch(sectionId) {
            case 'crops':
                if (this.cropData.length === 0) {
                    const crops = await agriDB.getAllCrops();
                    this.cropData = crops;
                    this.displayCrops(crops);
                }
                break;
                
            case 'pest':
                await this.loadPestData();
                break;
                
            case 'market':
                if (this.marketplace) {
                    await this.marketplace.loadMarketListings();
                }
                break;
                
            case 'profile':
                await this.loadUserProfile();
                break;
                
            case 'tools':
                // Tools are already loaded
                break;
        }
    }

    async loadKenyanSampleData() {
        try {
            const kenyanCrops = [
                {
                    id: 1,
                    name: "Maize",
                    localName: "Mahindi",
                    category: "Cereal",
                    description: "Staple food crop in Kenya, grown in most regions. Requires well-drained soil and moderate rainfall.",
                    season: "Long rains (March-May), Short rains (Oct-Dec)",
                    soilType: "Well-drained loam",
                    waterRequirement: "Moderate (500-700mm per season)",
                    harvestTime: "3-4 months",
                    fertilizer: "CAN, DAP, NPK",
                    image: "🌽",
                    marketPrice: "KES 50-70 per kg",
                    counties: ["Nakuru", "Uasin Gishu", "Trans Nzoia"]
                },
                {
                    id: 2,
                    name: "Beans",
                    localName: "Maharagwe",
                    category: "Legume",
                    description: "Important protein source, intercropped with maize. Fixes nitrogen in soil.",
                    season: "Both rainy seasons",
                    soilType: "Medium loam",
                    waterRequirement: "Low to moderate",
                    harvestTime: "2-3 months",
                    fertilizer: "DAP, farmyard manure",
                    image: "🫘",
                    marketPrice: "KES 120-150 per kg",
                    counties: ["Kakamega", "Bungoma", "Kisii"]
                },
                {
                    id: 3,
                    name: "Tea",
                    localName: "Chai",
                    category: "Cash Crop",
                    description: "Major export crop, grown in high altitude areas. Requires careful plucking.",
                    season: "Year-round (peaks in rainy seasons)",
                    soilType: "Acidic, well-drained",
                    waterRequirement: "High (1500-2000mm annually)",
                    harvestTime: "Continuous",
                    fertilizer: "NPK 25:5:5",
                    image: "🍃",
                    marketPrice: "KES 200-300 per kg (green leaf)",
                    counties: ["Kericho", "Nandi", "Nyamira"]
                },
                {
                    id: 4,
                    name: "Coffee",
                    localName: "Kahawa",
                    category: "Cash Crop",
                    description: "Premium Arabica coffee grown in central highlands. Requires shade and careful processing.",
                    season: "Main crop: Oct-Dec, Fly crop: Apr-Jun",
                    soilType: "Volcanic, well-drained",
                    waterRequirement: "Moderate to high",
                    harvestTime: "9 months from flowering",
                    fertilizer: "NPK, foliar feeds",
                    image: "☕",
                    marketPrice: "KES 300-500 per kg (parchment)",
                    counties: ["Kiambu", "Murang'a", "Kirinyaga"]
                }
            ];

            // Add Kenyan crop data to database
            for (const crop of kenyanCrops) {
                await agriDB.addCrop(crop);
            }

            // Update display
            this.cropData = kenyanCrops;
            this.displayCrops(kenyanCrops);
            
            // Update stats
            const stats = await agriDB.getStats();
            this.updateStats(stats);
            
            // Add sample market data
            await this.loadSampleMarketData();
            
            this.showNotification('Kenyan sample data loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error loading sample data:', error);
            this.showNotification('Error loading sample data', 'error');
        }
    }

    async loadSampleMarketData() {
        const sampleListings = [
            {
                id: 'listing_1',
                farmer: "Jane Muthoni",
                crop: "Grade 1 Maize",
                quantity: 500,
                pricePerKg: 55,
                location: "Nakuru",
                rating: 4.7,
                dateListed: new Date().toISOString().split('T')[0],
                delivery: true,
                phone: "+254712345678",
                description: "Freshly harvested Grade 1 maize. Dried and well stored."
            },
            {
                id: 'listing_2',
                farmer: "Omondi Farm",
                crop: "Organic Beans",
                quantity: 200,
                pricePerKg: 120,
                location: "Kiambu",
                rating: 4.9,
                dateListed: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                delivery: false,
                phone: "+254723456789",
                description: "Organically grown beans. No pesticides used."
            }
        ];
        
        for (const listing of sampleListings) {
            await agriDB.addItem('marketListings', listing);
        }
    }

    displayCrops(crops) {
        const container = document.getElementById('crops-container');
        if (!container) return;
        
        if (crops.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No crops found. Load sample data or add your own crops.</p>
                    <button class="btn-primary" onclick="agriApp.loadKenyanSampleData()">
                        Load Kenyan Sample Data
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = crops.map(crop => `
            <div class="crop-card">
                <div class="crop-image">
                    ${crop.image || '🌱'}
                </div>
                <div class="crop-info">
                    <h3>${crop.name} <span class="local-name">(${crop.localName || crop.name})</span></h3>
                    <p><strong>Category:</strong> ${crop.category}</p>
                    <p><strong>Season:</strong> ${crop.season}</p>
                    <p><strong>Soil Type:</strong> ${crop.soilType}</p>
                    <p><strong>Water Requirement:</strong> ${crop.waterRequirement}</p>
                    <p><strong>Harvest Time:</strong> ${crop.harvestTime}</p>
                    <p><strong>Fertilizer:</strong> ${crop.fertilizer}</p>
                    ${crop.marketPrice ? `<p><strong>Market Price:</strong> ${crop.marketPrice}</p>` : ''}
                    <p>${crop.description}</p>
                    ${crop.counties ? `<p><small>Common in: ${crop.counties.join(', ')}</small></p>` : ''}
                </div>
            </div>
        `).join('');
    }

    async searchCrops() {
        const query = document.getElementById('crop-search').value;
        if (!query.trim()) {
            this.displayCrops(this.cropData);
            return;
        }
        
        const results = await agriDB.searchCrops(query);
        this.displayCrops(results);
    }

    async loadPestData() {
        const container = document.getElementById('pest-container');
        if (!container) return;
        
        // Kenyan pest data
        const pestData = [
            { 
                id: 1, 
                name: "Maize Stalk Borer", 
                crop: "Maize", 
                symptoms: "Dead hearts, holes in stems",
                solution: "Use BT maize varieties, apply appropriate pesticides",
                organic: "Neem extracts, intercropping with desmodium"
            },
            { 
                id: 2, 
                name: "Coffee Berry Disease", 
                crop: "Coffee", 
                symptoms: "Dark spots on berries, premature dropping",
                solution: "Fungicide sprays, proper pruning",
                organic: "Copper-based fungicides, good sanitation"
            },
            { 
                id: 3, 
                name: "Tea Mosquito Bug", 
                crop: "Tea", 
                symptoms: "Brown spots on leaves, curled tips",
                solution: "Systemic insecticides",
                organic: "Neem oil, garlic-chili sprays"
            }
        ];
        
        container.innerHTML = pestData.map(pest => `
            <div class="stat-card">
                <h3>${pest.name}</h3>
                <p><strong>Affects:</strong> ${pest.crop}</p>
                <p><strong>Symptoms:</strong> ${pest.symptoms}</p>
                <p><strong>Chemical Solution:</strong> ${pest.solution}</p>
                <p><strong>Organic Solution:</strong> ${pest.organic}</p>
            </div>
        `).join('');
    }

    calculateSeedKenyan() {
        const area = parseFloat(document.getElementById('land-area').value);
        const crop = document.getElementById('crop-type').value;
        
        if (!area || area <= 0) {
            document.getElementById('seed-result').textContent = "Please enter valid area in acres";
            return;
        }
        
        // Kenyan seed rates (kg per acre)
        const seedRates = {
            maize: 25,    // 25kg per acre for maize
            beans: 40,    // 40kg per acre for beans
            wheat: 100,   // 100kg per acre for wheat
            rice: 40      // 40kg per acre for rice
        };
        
        const seedRequired = area * (seedRates[crop] || 50);
        const cropName = this.config.crops[crop]?.localName || crop;
        
        document.getElementById('seed-result').innerHTML = `
            <p><strong>For ${area} acres of ${cropName}:</strong></p>
            <p>Required seeds: <strong>${seedRequired} kg</strong></p>
            <p>Estimated cost: <strong>KES ${(seedRequired * 150).toLocaleString()}</strong></p>
            <small>Based on average seed price of KES 150/kg</small>
        `;
    }

    calculateWater() {
        const area = parseFloat(document.getElementById('water-area').value);
        const soil = document.getElementById('soil-type').value;
        
        if (!area || area <= 0) {
            document.getElementById('water-result').textContent = "Please enter valid area in acres";
            return;
        }
        
        // Water requirements in liters per acre per day
        const waterFactors = {
            clay: 25000,   // 25,000 liters/acre/day for clay
            loam: 30000,   // 30,000 liters/acre/day for loam
            sandy: 35000   // 35,000 liters/acre/day for sandy
        };
        
        const dailyWater = area * (waterFactors[soil] || 30000);
        const weeklyWater = dailyWater * 7;
        
        document.getElementById('water-result').innerHTML = `
            <p><strong>For ${area} acres of ${soil} soil:</strong></p>
            <p>Daily water needed: <strong>${dailyWater.toLocaleString()} liters</strong></p>
            <p>Weekly water needed: <strong>${weeklyWater.toLocaleString()} liters</strong></p>
            <p>≈ <strong>${(weeklyWater / 1000).toFixed(1)} cubic meters</strong> per week</p>
        `;
    }

    async getKenyanWeather() {
        const weatherDiv = document.getElementById('weather-data') || 
                          document.querySelector('.weather-info');
        if (!weatherDiv) return;
        
        weatherDiv.innerHTML = '<p>🌤️ Fetching weather data...</p>';
        
        if (!navigator.geolocation) {
            weatherDiv.innerHTML = '<p>Geolocation not supported by your device</p>';
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // Get county from coordinates (simplified)
                    const county = await this.getCountyFromCoordinates(latitude, longitude);
                    
                    // Mock weather data for Kenyan regions
                    const weatherData = this.getMockKenyanWeather(county, latitude);
                    
                    weatherDiv.innerHTML = `
                        <div class="weather-card">
                            <h4>${county} County Weather</h4>
                            <p><strong>Temperature:</strong> ${weatherData.temperature}</p>
                            <p><strong>Humidity:</strong> ${weatherData.humidity}</p>
                            <p><strong>Conditions:</strong> ${weatherData.conditions}</p>
                            <p><strong>Rainfall:</strong> ${weatherData.rainfall}</p>
                            <p><strong>Recommendation:</strong> ${weatherData.recommendation}</p>
                            <p><small>Coordinates: ${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°</small></p>
                        </div>
                    `;
                    
                    // Store weather data for offline use
                    await agriDB.addItem('weather', {
                        ...weatherData,
                        latitude,
                        longitude,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    console.error('Weather fetch error:', error);
                    weatherDiv.innerHTML = '<p>Could not fetch weather data. Showing cached data...</p>';
                    this.showCachedWeather(weatherDiv);
                }
            },
            (error) => {
                weatherDiv.innerHTML = `
                    <p>Unable to get your location. Showing general Kenyan weather:</p>
                    ${this.getGeneralKenyanWeather()}
                `;
            }
        );
    }

    getMockKenyanWeather(county, latitude) {
        // Simple mock weather based on location
        const isHighAltitude = latitude < -0.5; // South of equator
        const isCoastal = ['Mombasa', 'Kilifi', 'Kwale'].includes(county);
        
        if (isCoastal) {
            return {
                temperature: "28-32°C",
                humidity: "75-85%",
                conditions: "Humid, Partly Cloudy",
                rainfall: "High humidity, occasional showers",
                recommendation: "Good for coconut, cashew, and mango farming"
            };
        } else if (isHighAltitude) {
            return {
                temperature: "18-24°C",
                humidity: "65-75%",
                conditions: "Cool, Mild",
                rainfall: "Adequate for tea and coffee",
                recommendation: "Ideal for tea, coffee, and dairy farming"
            };
        } else {
            return {
                temperature: "22-28°C",
                humidity: "60-70%",
                conditions: "Sunny, Pleasant",
                rainfall: "Moderate, good for maize",
                recommendation: "Perfect day for planting and irrigation"
            };
        }
    }

    async getCountyFromCoordinates(lat, lng) {
        // Simplified county detection
        // In production, use a proper geocoding API
        if (lat < -1.0) return "Nairobi";
        if (lat < -0.5) return "Nakuru";
        if (lng > 36.8) return "Meru";
        if (lng > 34.0) return "Kisumu";
        return "Central Kenya Region";
    }

    updateStats(stats) {
        const cropCount = document.getElementById('crop-count');
        const storageStatus = document.getElementById('storage-status');
        const lastSync = document.getElementById('last-sync');
        
        if (cropCount) cropCount.textContent = `${stats.totalCrops} crops`;
        if (storageStatus) storageStatus.textContent = stats.storageUsed ? `${stats.storageUsed} used` : 'Ready';
        if (lastSync) {
            lastSync.textContent = stats.lastSync ? 
                new Date(stats.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                'Never';
        }
    }

    updateLastSync() {
        const now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const element = document.getElementById('data-updated');
        if (element) element.textContent = `Updated: ${now}`;
    }

    checkConnection() {
        const isOnline = navigator.onLine;
        this.updateConnectionStatus(isOnline);
    }

    updateConnectionStatus(isOnline) {
        const statusElement = document.getElementById('connection-status');
        const indicator = document.getElementById('offline-indicator');
        
        if (isOnline) {
            if (statusElement) {
                statusElement.textContent = 'Online';
                statusElement.className = 'status online';
            }
            if (indicator) indicator.style.display = 'none';
        } else {
            if (statusElement) {
                statusElement.textContent = 'Offline';
                statusElement.className = 'status offline';
            }
            if (indicator) indicator.style.display = 'block';
        }
    }

    async manualSync() {
        const syncBtn = document.getElementById('sync-btn');
        const syncStatus = document.getElementById('sync-status');
        
        if (!navigator.onLine) {
            this.showNotification('You are offline. Sync will happen when connection is restored.', 'warning');
            return;
        }
        
        syncBtn.disabled = true;
        if (syncStatus) syncStatus.textContent = 'Syncing...';
        
        try {
            // Simulate sync process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Update last sync time
            await agriDB.setSetting('lastSync', new Date().toISOString());
            
            // Trigger marketplace sync
            if (this.marketplace) {
                await this.marketplace.syncListings();
            }
            
            if (syncStatus) syncStatus.textContent = 'Synced';
            this.updateLastSync();
            
            this.showNotification('Sync completed successfully!', 'success');
            
        } catch (error) {
            console.error('Sync error:', error);
            if (syncStatus) syncStatus.textContent = 'Failed';
            this.showNotification('Sync failed. Please try again.', 'error');
        } finally {
            syncBtn.disabled = false;
            setTimeout(() => {
                if (syncStatus && syncStatus.textContent === 'Synced') {
                    syncStatus.textContent = 'Sync';
                }
            }, 3000);
        }
    }

    setupAutoSync() {
        // Check for updates every 30 minutes if online
        setInterval(async () => {
            if (navigator.onLine) {
                await this.manualSync();
            }
        }, 1800000); // 30 minutes
    }

    async clearCache() {
        if (confirm('Are you sure you want to clear all cached data? This will remove all saved crops, listings, and settings.')) {
            try {
                // Clear all database stores
                await agriDB.clearStore('crops');
                await agriDB.clearStore('pests');
                await agriDB.clearStore('market');
                await agriDB.clearStore('marketListings');
                await agriDB.clearStore('settings');
                
                // Clear local data
                this.cropData = [];
                const cropsContainer = document.getElementById('crops-container');
                if (cropsContainer) cropsContainer.innerHTML = '';
                
                // Clear marketplace
                if (this.marketplace) {
                    this.marketplace.listings = [];
                    const listingsContainer = document.getElementById('listings-container');
                    if (listingsContainer) listingsContainer.innerHTML = '';
                }
                
                // Update stats
                const stats = await agriDB.getStats();
                this.updateStats(stats);
                
                this.showNotification('Cache cleared successfully!', 'success');
                
            } catch (error) {
                console.error('Error clearing cache:', error);
                this.showNotification('Error clearing cache', 'error');
            }
        }
    }

    async exportData() {
        try {
            const data = await agriDB.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `agriinfo-kenya-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Data exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error exporting data', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                    max-width: 400px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .notification.success { background: #4CAF50; }
                .notification.error { background: #f44336; }
                .notification.warning { background: #ff9800; }
                .notification.info { background: #2196F3; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 10px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    editProfile() {
        const name = prompt('Enter your name:', this.userProfile?.name || '');
        if (name === null) return;
        
        const location = prompt('Enter your county:', this.userProfile?.location || '');
        const farmSize = prompt('Enter your farm size (acres):', this.userProfile?.farmSize || '');
        
        this.userProfile = {
            ...this.userProfile,
            name: name || 'Farmer',
            location: location || 'Kenya',
            farmSize: farmSize || 'Not specified',
            joined: this.userProfile?.joined || new Date().toISOString()
        };
        
        localStorage.setItem('agriUserProfile', JSON.stringify(this.userProfile));
        this.updateProfileUI();
        this.showNotification('Profile updated successfully!', 'success');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.agriApp = new AgriInfoApp();
});

// Marketplace Class
class AgriMarketplace {
    constructor(appInstance) {
        this.app = appInstance;
        this.currentUser = null;
        this.listings = [];
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        await this.loadUserProfile();
        this.setupMarketplaceUI();
        await this.loadMarketListings();
        
        this.initialized = true;
        console.log('Marketplace initialized');
    }

    async loadUserProfile() {
        const savedUser = localStorage.getItem('agriUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        } else {
            // Create demo farmer profile
            this.currentUser = {
                id: `farmer_${Date.now()}`,
                name: "Kamau Wafula",
                location: "Nakuru County",
                farmSize: "5 acres",
                crops: ["Maize", "Beans", "Potatoes"],
                rating: 4.5,
                verified: true,
                phone: "+2547XXXXXXXX",
                joined: new Date().toISOString()
            };
            localStorage.setItem('agriUser', JSON.stringify(this.currentUser));
        }
        this.updateUserUI();
    }

    setupMarketplaceUI() {
        const marketSection = document.getElementById('market');
        if (!marketSection) return;
        
        // Clear existing content and add marketplace UI
        const existingContainer = document.getElementById('marketplace-container');
        if (existingContainer) {
            existingContainer.innerHTML = '';
        }
        
        marketSection.innerHTML = `
            <h2>💰 Farmer's Marketplace</h2>
            <p class="section-subtitle">Buy and sell produce directly with other farmers</p>
            
            <div id="marketplace-container">
                <div class="marketplace-tabs">
                    <button class="tab-btn active" data-tab="buy">🛒 Buy Produce</button>
                    <button class="tab-btn" data-tab="sell">📤 Sell Your Produce</button>
                    <button class="tab-btn" data-tab="my-listings">📋 My Listings</button>
                    <button class="tab-btn" data-tab="transactions">💳 Transactions</button>
                </div>
                
                <div class="tab-content">
                    <!-- Buy Tab -->
                    <div class="tab-pane active" id="buy-tab">
                        <div class="market-filters">
                            <input type="text" id="market-search" placeholder="Search crops (e.g., Maize, Beans)...">
                            <select id="county-filter">
                                <option value="">All Counties</option>
                                ${this.app.config.counties.map(county => 
                                    `<option value="${county}">${county}</option>`
                                ).join('')}
                            </select>
                            <button id="filter-btn" class="btn-primary">Filter</button>
                            <button id="clear-filters" class="btn-secondary">Clear</button>
                        </div>
                        <div id="listings-container" class="listings-grid">
                            <p>Loading listings...</p>
                        </div>
                    </div>
                    
                    <!-- Sell Tab -->
                    <div class="tab-pane" id="sell-tab">
                        <div class="sell-form-container">
                            <h3>📤 List Your Produce for Sale</h3>
                            <form id="sell-form" class="sell-form">
                                <div class="form-group">
                                    <label for="crop-name">Crop Name *</label>
                                    <input type="text" id="crop-name" 
                                           placeholder="e.g., Grade 1 Maize, Organic Beans" required>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="quantity">Quantity (kg) *</label>
                                        <input type="number" id="quantity" 
                                               placeholder="e.g., 500" min="1" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="price-per-kg">Price per Kg (KES) *</label>
                                        <input type="number" id="price-per-kg" 
                                               placeholder="e.g., 50" min="1" required>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="county">County *</label>
                                    <select id="county" required>
                                        <option value="">Select County</option>
                                        ${this.app.config.counties.map(county => 
                                            `<option value="${county}">${county}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="description">Description</label>
                                    <textarea id="description" 
                                              placeholder="Additional details about your produce (quality, storage, delivery options)..."
                                              rows="4"></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="phone-contact">Contact Phone</label>
                                    <input type="tel" id="phone-contact" 
                                           placeholder="+2547XXXXXXXX"
                                           value="${this.currentUser?.phone || ''}">
                                </div>
                                
                                <button type="submit" class="btn-primary">List for Sale</button>
                            </form>
                        </div>
                    </div>
                    
                    <!-- My Listings Tab -->
                    <div class="tab-pane" id="my-listings-tab">
                        <div id="my-listings-container">
                            <p>You haven't listed any produce yet.</p>
                        </div>
                    </div>
                    
                    <!-- Transactions Tab -->
                    <div class="tab-pane" id="transactions-tab">
                        <div class="transactions-info">
                            <h3>💳 Transaction History</h3>
                            <p>Transaction features will be available in the next update.</p>
                            <div class="coming-soon">
                                <p>🚧 Features Coming Soon:</p>
                                <ul>
                                    <li>M-Pesa Integration</li>
                                    <li>Escrow Services</li>
                                    <li>Transaction History</li>
                                    <li>Rating System</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupMarketplaceEvents();
    }

    setupMarketplaceEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });
        
        // Filter button
        document.getElementById('filter-btn')?.addEventListener('click', () => this.filterListings());
        document.getElementById('clear-filters')?.addEventListener('click', () => this.clearFilters());
        
        // Search functionality
        document.getElementById('market-search')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.filterListings();
        });
        
        // Sell form submission
        document.getElementById('sell-form')?.addEventListener('submit', (e) => this.handleSellForm(e));
    }

    async loadMarketListings() {
        const container = document.getElementById('listings-container');
        if (!container) return;
        
        container.innerHTML = '<p>🌱 Loading market listings...</p>';
        
        try {
            // Try network first
            const networkListings = await this.fetchMarketListings();
            
            if (networkListings?.length > 0) {
                await this.cacheListings(networkListings);
                this.listings = networkListings;
                this.displayListings(networkListings);
            } else {
                // Fallback to cache
                const cached = await this.getCachedListings();
                this.listings = cached;
                this.displayListings(cached);
            }
        } catch (error) {
            console.log('Using offline market data:', error);
            const cached = await this.getCachedListings();
            this.listings = cached;
            this.displayListings(cached);
        }
    }

    async fetchMarketListings() {
        if (!navigator.onLine) {
            console.log('Offline - using cached data');
            return [];
        }
        
        // In production, this would fetch from your backend API
        // For demo, return sample data and simulate network delay
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'listing_1',
                        farmer: "Jane Muthoni",
                        crop: "Grade 1 Maize",
                        quantity: 500,
                        pricePerKg: 55,
                        location: "Nakuru",
                        rating: 4.7,
                        dateListed: new Date().toISOString().split('T')[0],
                        delivery: true,
                        phone: "+254712345678",
                        description: "Freshly harvested Grade 1 maize. Dried and well stored."
                    },
                    {
                        id: 'listing_2',
                        farmer: "Omondi Farm",
                        crop: "Organic Beans",
                        quantity: 200,
                        pricePerKg: 120,
                        location: "Kiambu",
                        rating: 4.9,
                        dateListed: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                        delivery: false,
                        phone: "+254723456789",
                        description: "Organically grown beans. No pesticides used."
                    },
                    {
                        id: 'listing_3',
                        farmer: "Kariuki Fresh Produce",
                        crop: "Fresh Tomatoes",
                        quantity: 1000,
                        pricePerKg: 80,
                        location: "Murang'a",
                        rating: 4.5,
                        dateListed: new Date(Date.now() - 172800000).toISOString().split('T')[0],
                        delivery: true,
                        phone: "+254734567890",
                        description: "Fresh tomatoes from Murang'a. Perfect for market."
                    }
                ]);
            }, 1000);
        });
    }

    async cacheListings(listings) {
        try {
            const storeName = 'marketListings';
            
            // Clear old cache
            await agriDB.clearStore(storeName);
            
            // Add new listings
            for (const listing of listings) {
                await agriDB.addItem(storeName, listing);
            }
            
            console.log(`Cached ${listings.length} listings`);
        } catch (error) {
            console.error('Error caching listings:', error);
        }
    }

    async getCachedListings() {
        try {
            return await agriDB.getAllItems('marketListings') || [];
        } catch (error) {
            console.error('Error getting cached listings:', error);
            return [];
        }
    }

    displayListings(listings) {
        const container = document.getElementById('listings-container');
        if (!container) return;
        
        if (listings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No listings found. Try different filters or check back later.</p>
                    <button class="btn-secondary" onclick="this.closest('.tab-pane').querySelector('#clear-filters').click()">
                        Clear Filters
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = listings.map(listing => `
            <div class="listing-card">
                <div class="listing-header">
                    <span class="farmer-badge">${listing.farmer.split(' ')[0]}</span>
                    <span class="rating">⭐ ${listing.rating}</span>
                </div>
                <h4>${listing.crop}</h4>
                <div class="listing-details">
                    <p><strong>Quantity:</strong> ${listing.quantity} kg</p>
                    <p><strong>Price:</strong> KES ${listing.pricePerKg}/kg</p>
                    <p><strong>Total Value:</strong> KES ${(listing.quantity * listing.pricePerKg).toLocaleString()}</p>
                    <p><strong>Location:</strong> ${listing.location} County</p>
                    <p><strong>Listed:</strong> ${new Date(listing.dateListed).toLocaleDateString()}</p>
                    ${listing.description ? `<p><strong>Details:</strong> ${listing.description}</p>` : ''}
                </div>
                <div class="listing-actions">
                    ${listing.delivery ? '<span class="delivery-badge">🚚 Delivery Available</span>' : ''}
                    <button class="buy-btn" onclick="agriApp.marketplace.contactFarmer('${listing.id}')">
                        📞 Contact Farmer
                    </button>
                </div>
            </div>
        `).join('');
    }

    switchTab(event) {
        const tabName = event.target.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show corresponding tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        const tabPane = document.getElementById(`${tabName}-tab`);
        if (tabPane) {
            tabPane.classList.add('active');
            
            // Load tab-specific data
            if (tabName === 'my-listings') {
                this.loadMyListings();
            }
        }
    }

    async filterListings() {
        const searchQuery = document.getElementById('market-search')?.value || '';
        const countyFilter = document.getElementById('county-filter')?.value || '';
        
        let filtered = this.listings;
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(listing => 
                listing.crop.toLowerCase().includes(query) ||
                listing.farmer.toLowerCase().includes(query) ||
                listing.description?.toLowerCase().includes(query)
            );
        }
        
        if (countyFilter) {
            filtered = filtered.filter(listing => 
                listing.location === countyFilter
            );
        }
        
        this.displayListings(filtered);
    }

    clearFilters() {
        const searchInput = document.getElementById('market-search');
        const countySelect = document.getElementById('county-filter');
        
        if (searchInput) searchInput.value = '';
        if (countySelect) countySelect.value = '';
        
        this.displayListings(this.listings);
    }

    async handleSellForm(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = {
            crop: form.querySelector('#crop-name').value,
            quantity: parseFloat(form.querySelector('#quantity').value),
            pricePerKg: parseFloat(form.querySelector('#price-per-kg').value),
            county: form.querySelector('#county').value,
            description: form.querySelector('#description').value,
            phone: form.querySelector('#phone-contact').value || this.currentUser?.phone,
            farmer: this.currentUser?.name || 'Anonymous Farmer',
            dateListed: new Date().toISOString().split('T')[0],
            status: 'active',
            rating: 5.0 // Default rating for new listings
        };
        
        // Validate
        if (!formData.crop || !formData.quantity || !formData.pricePerKg || !formData.county) {
            this.app.showNotification('Please fill all required fields', 'error');
            return;
        }
        
        if (formData.quantity <= 0 || formData.pricePerKg <= 0) {
            this.app.showNotification('Please enter valid quantity and price', 'error');
            return;
        }
        
        // Add to marketplace
        try {
            const newListing = await this.addListing(formData);
            
            // Reset form
            form.reset();
            if (this.currentUser?.phone) {
                form.querySelector('#phone-contact').value = this.currentUser.phone;
            }
            
            // Switch to "My Listings" tab and update
            this.switchToTab('my-listings');
            await this.loadMyListings();
            
            this.app.showNotification('Listing added successfully! It will be visible to other farmers.', 'success');
            
            // Queue for sync
            agriSync.recordNewListing(newListing);
            
        } catch (error) {
            console.error('Error adding listing:', error);
            this.app.showNotification('Error adding listing. Please try again.', 'error');
        }
    }

    async addListing(listingData) {
        // Generate unique ID
        listingData.id = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        listingData.farmerId = this.currentUser?.id;
        
        // Add to local array
        this.listings.unshift(listingData);
        
        // Cache in IndexedDB
        await agriDB.addItem('marketListings', listingData);
        
        // Update display
        this.displayListings(this.listings);
        
        return listingData;
    }

    async loadMyListings() {
        const container = document.getElementById('my-listings-container');
        if (!container) return;
        
        const myListings = this.listings.filter(listing => 
            listing.farmerId === this.currentUser?.id
        );
        
        if (myListings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>You haven't listed any produce yet.</p>
                    <button class="btn-primary" onclick="agriApp.marketplace.switchToTab('sell')">
                        List Your First Product
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = myListings.map(listing => `
            <div class="my-listing-card">
                <div class="listing-header">
                    <h4>${listing.crop}</h4>
                    <span class="listing-status ${listing.status}">${listing.status}</span>
                </div>
                <div class="listing-details">
                    <p><strong>Quantity:</strong> ${listing.quantity} kg</p>
                    <p><strong>Price:</strong> KES ${listing.pricePerKg}/kg</p>
                    <p><strong>Total Value:</strong> KES ${(listing.quantity * listing.pricePerKg).toLocaleString()}</p>
                    <p><strong>Location:</strong> ${listing.location} County</p>
                    <p><strong>Listed:</strong> ${new Date(listing.dateListed).toLocaleDateString()}</p>
                    ${listing.description ? `<p><strong>Description:</strong> ${listing.description}</p>` : ''}
                </div>
                <div class="listing-actions">
                    <button class="btn-secondary" onclick="agriApp.marketplace.editListing('${listing.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn-secondary" onclick="agriApp.marketplace.deleteListing('${listing.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    switchToTab(tabName) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.click();
        }
    }

    contactFarmer(listingId) {
        const listing = this.listings.find(l => l.id === listingId);
        if (!listing) return;
        
        const message = `Hello, I'm interested in your ${listing.crop} listed on AgriInfo Kenya. ` +
                       `Quantity: ${listing.quantity}kg, Price: KES ${listing.pricePerKg}/kg. ` +
                       `Can we discuss further?`;
        
        // Create WhatsApp link
        const phone = listing.phone || this.currentUser?.phone;
        if (phone) {
            const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        } else {
            // Fallback to showing contact info
            alert(`Contact ${listing.farmer} about ${listing.crop}\n\n` +
                  `Phone: ${listing.phone || 'Not provided'}\n` +
                  `Message: ${message}`);
        }
    }

    async editListing(listingId) {
        const listing = this.listings.find(l => l.id === listingId);
        if (!listing) return;
        
        const newPrice = prompt('Enter new price per kg (KES):', listing.pricePerKg);
        if (newPrice === null) return;
        
        const newQuantity = prompt('Enter new quantity (kg):', listing.quantity);
        if (newQuantity === null) return;
        
        listing.pricePerKg = parseFloat(newPrice);
        listing.quantity = parseFloat(newQuantity);
        listing.lastUpdated = new Date().toISOString();
        
        // Update in database
        await agriDB.updateItem('marketListings', listing);
        
        // Update displays
        this.displayListings(this.listings);
        await this.loadMyListings();
        
        // Queue for sync
        agriSync.recordListingUpdate(listing);
        
        this.app.showNotification('Listing updated successfully!', 'success');
    }

    async deleteListing(listingId) {
        if (!confirm('Are you sure you want to delete this listing?')) return;
        
        try {
            // Remove from local array
            this.listings = this.listings.filter(l => l.id !== listingId);
            
            // Remove from database
            await agriDB.deleteItem('marketListings', listingId);
            
            // Update displays
            this.displayListings(this.listings);
            await this.loadMyListings();
            
            // Queue for sync
            agriSync.recordListingDeletion(listingId);
            
            this.app.showNotification('Listing deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting listing:', error);
            this.app.showNotification('Error deleting listing', 'error');
        }
    }

    updateUserUI() {
        const userElement = document.getElementById('user-profile');
        if (userElement && this.currentUser) {
            userElement.innerHTML = `
                <div class="user-card">
                    <h3>👨‍🌾 ${this.currentUser.name}</h3>
                    <p><strong>Location:</strong> ${this.currentUser.location}</p>
                    <p><strong>Farm Size:</strong> ${this.currentUser.farmSize}</p>
                    <p><strong>Rating:</strong> ⭐ ${this.currentUser.rating}</p>
                    ${this.currentUser.verified ? '<span class="verified-badge">✓ Verified Farmer</span>' : ''}
                    <button class="btn-secondary" onclick="agriApp.marketplace.editProfile()" style="margin-top: 10px;">
                        Edit Profile
                    </button>
                </div>
            `;
        }
    }

    editProfile() {
        this.app.editProfile();
    }

    async syncListings() {
        if (!navigator.onLine) return;
        
        try {
            // Get unsynced listings
            const unsynced = await agriDB.getUnsyncedItems();
            
            if (unsynced.length > 0) {
                // In production, send to backend API
                console.log(`Syncing ${unsynced.length} listings...`);
                
                // Mark as synced
                for (const item of unsynced) {
                    await agriDB.markAsSynced(item.id);
                }
                
                this.app.showNotification(`${unsynced.length} listings synced`, 'success');
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    }
}