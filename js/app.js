class AgriInfoApp {
    constructor() {
        this.currentSection = 'home';
        this.cropData = [];
        this.init();
    }

    async init() {
        // Wait for DB to initialize
        await agriDB.init();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadInitialData();
        
        // Check connection status
        this.checkConnection();
        
        // Setup periodic sync
        this.setupAutoSync();
        
        console.log('AgriInfo App initialized');
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
        document.getElementById('load-data').addEventListener('click', () => this.loadSampleData());
        document.getElementById('clear-cache').addEventListener('click', () => this.clearCache());
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('sync-btn').addEventListener('click', () => this.manualSync());

        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => this.searchCrops());
        document.getElementById('crop-search').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.searchCrops();
        });

        // Calculator buttons
        document.getElementById('calculate-seed').addEventListener('click', () => this.calculateSeed());
        document.getElementById('calculate-water').addEventListener('click', () => this.calculateWater());

        // Weather button
        document.getElementById('get-weather').addEventListener('click', () => this.getWeather());

        // Connection status
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
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
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
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
        document.getElementById(sectionId).classList.add('active');
        
        // Update active nav link
        document.querySelector(`.nav-link[href="#${sectionId}"]`).classList.add('active');
        
        // Load section-specific data
        this.loadSectionData(sectionId);
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
                await this.loadMarketData();
                break;
                
            case 'tools':
                // Tools are already loaded
                break;
        }
    }

    async loadSampleData() {
        try {
            // Sample crop data
            const sampleCrops = [
                {
                    id: 1,
                    name: "Wheat",
                    category: "Cereal",
                    description: "Wheat is a grass widely cultivated for its seed.",
                    season: "Winter",
                    soilType: "Loamy",
                    waterRequirement: "Medium",
                    harvestTime: "90-120 days",
                    fertilizer: "NPK 20-20-0",
                    image: "🌾"
                },
                {
                    id: 2,
                    name: "Rice",
                    category: "Cereal",
                    description: "Rice is the seed of the grass species Oryza sativa.",
                    season: "Summer",
                    soilType: "Clay",
                    waterRequirement: "High",
                    harvestTime: "110-150 days",
                    fertilizer: "NPK 17-17-17",
                    image: "🍚"
                },
                {
                    id: 3,
                    name: "Corn",
                    category: "Cereal",
                    description: "Corn is a grain plant domesticated by indigenous peoples.",
                    season: "Summer",
                    soilType: "Well-drained",
                    waterRequirement: "Medium",
                    harvestTime: "60-100 days",
                    fertilizer: "NPK 10-10-10",
                    image: "🌽"
                },
                {
                    id: 4,
                    name: "Tomato",
                    category: "Vegetable",
                    description: "Tomato is an edible berry of the plant Solanum lycopersicum.",
                    season: "All seasons",
                    soilType: "Sandy Loam",
                    waterRequirement: "Medium",
                    harvestTime: "60-80 days",
                    fertilizer: "NPK 19-19-19",
                    image: "🍅"
                }
            ];

            // Add sample data to database
            for (const crop of sampleCrops) {
                await agriDB.addCrop(crop);
            }

            // Update display
            this.cropData = sampleCrops;
            this.displayCrops(sampleCrops);
            
            // Update stats
            const stats = await agriDB.getStats();
            this.updateStats(stats);
            
            alert('Sample data loaded successfully!');
            
        } catch (error) {
            console.error('Error loading sample data:', error);
            alert('Error loading sample data');
        }
    }

    displayCrops(crops) {
        const container = document.getElementById('crops-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        crops.forEach(crop => {
            const cropCard = document.createElement('div');
            cropCard.className = 'crop-card';
            cropCard.innerHTML = `
                <div class="crop-image">
                    ${crop.image || '🌱'}
                </div>
                <div class="crop-info">
                    <h3>${crop.name}</h3>
                    <p><strong>Category:</strong> ${crop.category}</p>
                    <p><strong>Season:</strong> ${crop.season}</p>
                    <p><strong>Soil Type:</strong> ${crop.soilType}</p>
                    <p><strong>Water:</strong> ${crop.waterRequirement}</p>
                    <p><strong>Harvest Time:</strong> ${crop.harvestTime}</p>
                    <p><strong>Fertilizer:</strong> ${crop.fertilizer}</p>
                    <p>${crop.description}</p>
                </div>
            `;
            container.appendChild(cropCard);
        });
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
        
        // Sample pest data (in production, this would come from database)
        const pestData = [
            { id: 1, name: "Aphids", crop: "Wheat", solution: "Neem oil spray" },
            { id: 2, name: "Bollworms", crop: "Cotton", solution: "Bt Cotton seeds" },
            { id: 3, name: "Leaf Miner", crop: "Tomato", solution: "Remove affected leaves" }
        ];
        
        container.innerHTML = pestData.map(pest => `
            <div class="stat-card">
                <h3>${pest.name}</h3>
                <p><strong>Crop:</strong> ${pest.crop}</p>
                <p><strong>Solution:</strong> ${pest.solution}</p>
            </div>
        `).join('');
    }

    async loadMarketData() {
        const container = document.getElementById('market-container');
        if (!container) return;
        
        // Sample market data
        const marketData = [
            { id: 1, crop: "Wheat", price: "₹2100/quintal", market: "Mandi" },
            { id: 2, crop: "Rice", price: "₹2800/quintal", market: "APMC" },
            { id: 3, crop: "Corn", price: "₹1800/quintal", market: "Local" }
        ];
        
        container.innerHTML = marketData.map(item => `
            <div class="stat-card">
                <h3>${item.crop}</h3>
                <p><strong>Price:</strong> ${item.price}</p>
                <p><strong>Market:</strong> ${item.market}</p>
            </div>
        `).join('');
    }

    calculateSeed() {
        const area = parseFloat(document.getElementById('land-area').value);
        const crop = document.getElementById('crop-type').value;
        
        if (!area || area <= 0) {
            document.getElementById('seed-result').textContent = "Please enter valid area";
            return;
        }
        
        const seedRates = {
            wheat: 100,
            rice: 40,
            corn: 20
        };
        
        const seedRequired = area * (seedRates[crop] || 50);
        document.getElementById('seed-result').textContent = 
            `Required seeds: ${seedRequired} kg`;
    }

    calculateWater() {
        const area = parseFloat(document.getElementById('water-area').value);
        const soil = document.getElementById('soil-type').value;
        
        if (!area || area <= 0) {
            document.getElementById('water-result').textContent = "Please enter valid area";
            return;
        }
        
        const waterFactors = {
            clay: 0.8,
            loam: 1.0,
            sandy: 1.2
        };
        
        const waterRequired = area * 10000 * (waterFactors[soil] || 1.0);
        document.getElementById('water-result').textContent = 
            `Required water: ${waterRequired.toFixed(0)} liters`;
    }

    async getWeather() {
        const weatherDiv = document.getElementById('weather-data');
        weatherDiv.innerHTML = '<p>Loading weather data...</p>';
        
        if (!navigator.geolocation) {
            weatherDiv.innerHTML = '<p>Geolocation not supported</p>';
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // In production, use a weather API
                    // For demo, show mock data
                    const mockWeather = {
                        temperature: "25°C",
                        humidity: "65%",
                        conditions: "Partly Cloudy",
                        recommendation: "Good day for irrigation"
                    };
                    
                    weatherDiv.innerHTML = `
                        <p><strong>Temperature:</strong> ${mockWeather.temperature}</p>
                        <p><strong>Humidity:</strong> ${mockWeather.humidity}</p>
                        <p><strong>Conditions:</strong> ${mockWeather.conditions}</p>
                        <p><strong>Recommendation:</strong> ${mockWeather.recommendation}</p>
                    `;
                    
                } catch (error) {
                    weatherDiv.innerHTML = '<p>Error fetching weather data</p>';
                }
            },
            (error) => {
                weatherDiv.innerHTML = '<p>Unable to get location</p>';
            }
        );
    }

    updateStats(stats) {
        document.getElementById('crop-count').textContent = `${stats.totalCrops} crops`;
        document.getElementById('storage-status').textContent = 'Ready';
        document.getElementById('last-sync').textContent = 
            stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never';
    }

    updateLastSync() {
        const now = new Date().toLocaleString();
        document.getElementById('data-updated').textContent = now;
    }

    checkConnection() {
        const isOnline = navigator.onLine;
        this.updateConnectionStatus(isOnline);
    }

    updateConnectionStatus(isOnline) {
        const statusElement = document.getElementById('connection-status');
        const indicator = document.getElementById('offline-indicator');
        
        if (isOnline) {
            statusElement.textContent = 'Online';
            statusElement.style.color = 'green';
            indicator.style.display = 'none';
        } else {
            statusElement.textContent = 'Offline';
            statusElement.style.color = 'orange';
            indicator.style.display = 'block';
        }
    }

    async manualSync() {
        const syncBtn = document.getElementById('sync-btn');
        const syncStatus = document.getElementById('sync-status');
        
        syncBtn.disabled = true;
        syncStatus.textContent = 'Syncing...';
        
        try {
            // Simulate sync process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update last sync time
            await agriDB.setSetting('lastSync', new Date().toISOString());
            
            syncStatus.textContent = 'Synced';
            this.updateLastSync();
            
            alert('Sync completed successfully!');
            
        } catch (error) {
            console.error('Sync error:', error);
            syncStatus.textContent = 'Sync failed';
            alert('Sync failed. Please try again.');
        } finally {
            syncBtn.disabled = false;
            setTimeout(() => {
                if (syncStatus.textContent === 'Synced') {
                    syncStatus.textContent = 'Sync';
                }
            }, 3000);
        }
    }

    setupAutoSync() {
        // Check for updates every hour if online
        setInterval(async () => {
            if (navigator.onLine) {
                await this.manualSync();
            }
        }, 3600000); // 1 hour
    }

    async clearCache() {
        if (confirm('Are you sure you want to clear all cached data?')) {
            try {
                await agriDB.clearStore('crops');
                await agriDB.clearStore('pests');
                await agriDB.clearStore('market');
                
                this.cropData = [];
                document.getElementById('crops-container').innerHTML = '';
                
                const stats = await agriDB.getStats();
                this.updateStats(stats);
                
                alert('Cache cleared successfully!');
                
            } catch (error) {
                console.error('Error clearing cache:', error);
                alert('Error clearing cache');
            }
        }
    }

    async exportData() {
        try {
            const data = await agriDB.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `agriinfo-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.agriApp = new AgriInfoApp();
});