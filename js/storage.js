/**
 * WATTWATCH - Storage Module
 * Manages localStorage persistence, sample data loading, export, and import with schema validation.
 */

const STORAGE_KEYS = {
  APPLIANCES: 'wattwatch_appliances_v1',
  SETTINGS: 'wattwatch_settings_v1',
  THEME: 'wattwatch_theme_v1'
};

const DEFAULT_SETTINGS = {
  electricityRate: 8.00, // ₹ per kWh
  currency: '₹',
  currencyCode: 'INR',
  billingDays: 30,
  theme: 'light'
};

// Curated sample appliances representing a typical modern luxury household
const SAMPLE_APPLIANCES = [
  {
    id: 'app_sample_1',
    name: '1.5 Ton 5-Star Inverter AC (Living Room)',
    category: 'Cooling',
    powerWatts: 1450,
    dailyHours: 6.5,
    operatingDays: 30,
    quantity: 1,
    createdAt: Date.now() - 500000
  },
  {
    id: 'app_sample_2',
    name: 'Double-Door Frost Free Refrigerator 340L',
    category: 'Kitchen',
    powerWatts: 180,
    dailyHours: 12.0, // compressor active cycle equivalent
    operatingDays: 30,
    quantity: 1,
    createdAt: Date.now() - 400000
  },
  {
    id: 'app_sample_3',
    name: 'BLDC Ultra-Quiet Ceiling Fans',
    category: 'Cooling',
    powerWatts: 35,
    dailyHours: 14.0,
    operatingDays: 30,
    quantity: 3,
    createdAt: Date.now() - 300000
  },
  {
    id: 'app_sample_4',
    name: 'Instant Water Geyser 15L',
    category: 'Other',
    powerWatts: 2000,
    dailyHours: 1.5,
    operatingDays: 30,
    quantity: 1,
    createdAt: Date.now() - 200000
  },
  {
    id: 'app_sample_5',
    name: '65" 4K OLED Smart TV & Surround Audio',
    category: 'Entertainment',
    powerWatts: 140,
    dailyHours: 4.5,
    operatingDays: 30,
    quantity: 1,
    createdAt: Date.now() - 100000
  },
  {
    id: 'app_sample_6',
    name: 'Architectural LED Warm Downlights (Pack of 8)',
    category: 'Lighting',
    powerWatts: 10,
    dailyHours: 6.0,
    operatingDays: 30,
    quantity: 8,
    createdAt: Date.now() - 50000
  },
  {
    id: 'app_sample_7',
    name: 'Executive Workstation (Laptop + Dual 4K Displays)',
    category: 'Computing',
    powerWatts: 160,
    dailyHours: 8.0,
    operatingDays: 24,
    quantity: 1,
    createdAt: Date.now()
  }
];

const WattWatchStorage = {
  /**
   * Retrieves saved appliances from localStorage with safety fallback
   * @returns {Array} List of appliance objects
   */
  getAppliances() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPLIANCES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[WattWatch Storage] Error reading appliances:', e);
      return [];
    }
  },

  /**
   * Saves appliances array to localStorage
   * @param {Array} appliances
   * @returns {boolean} Success status
   */
  saveAppliances(appliances) {
    try {
      if (!Array.isArray(appliances)) {
        throw new Error('Appliances must be an array');
      }
      localStorage.setItem(STORAGE_KEYS.APPLIANCES, JSON.stringify(appliances));
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving appliances:', e);
      return false;
    }
  },

  /**
   * Retrieves settings object with default fallback
   * @returns {Object} Settings
   */
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.error('[WattWatch Storage] Error reading settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Saves settings to localStorage
   * @param {Object} settings
   * @returns {boolean} Success status
   */
  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const merged = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving settings:', e);
      return false;
    }
  },

  /**
   * Gets the active theme ('light' or 'dark')
   * @returns {string}
   */
  getTheme() {
    try {
      const theme = localStorage.getItem(STORAGE_KEYS.THEME);
      return theme === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  },

  /**
   * Saves active theme preference
   * @param {string} theme ('light' | 'dark')
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme === 'dark' ? 'dark' : 'light');
    } catch (e) {
      console.error('[WattWatch Storage] Error saving theme:', e);
    }
  },

  /**
   * Loads sample appliances into storage
   * @returns {Array} Loaded sample appliances
   */
  loadSampleHousehold() {
    const samples = JSON.parse(JSON.stringify(SAMPLE_APPLIANCES));
    this.saveAppliances(samples);
    return samples;
  },

  /**
   * Exports full application data as a downloadable JSON string
   * @returns {string} JSON string
   */
  exportDataJSON() {
    const exportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      generator: 'WattWatch Energy Analytics',
      settings: this.getSettings(),
      appliances: this.getAppliances()
    };
    return JSON.stringify(exportPayload, null, 2);
  },

  /**
   * Validates and imports JSON application data
   * @param {string} jsonString
   * @returns {Object} { success: boolean, count?: number, error?: string }
   */
  importDataJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON format' };
      }

      if (!Array.isArray(parsed.appliances)) {
        return { success: false, error: 'File missing "appliances" list' };
      }

      // Validate each appliance schema
      const validAppliances = [];
      for (const item of parsed.appliances) {
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          continue;
        }
        const power = Number(item.powerWatts);
        const hours = Number(item.dailyHours);
        const days = Number(item.operatingDays);
        const qty = Number(item.quantity);

        if (isNaN(power) || power <= 0) continue;
        if (isNaN(hours) || hours < 0 || hours > 24) continue;
        if (isNaN(days) || days < 1 || days > 31) continue;
        if (isNaN(qty) || qty < 1) continue;

        validAppliances.push({
          id: item.id || `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: item.name.trim(),
          category: item.category || 'Other',
          powerWatts: power,
          dailyHours: hours,
          operatingDays: Math.round(days),
          quantity: Math.round(qty),
          createdAt: item.createdAt || Date.now()
        });
      }

      if (validAppliances.length === 0 && parsed.appliances.length > 0) {
        return { success: false, error: 'No valid appliance records found in imported file' };
      }

      // Save imported appliances
      this.saveAppliances(validAppliances);

      // Save imported settings if valid
      if (parsed.settings && typeof parsed.settings === 'object') {
        const rate = Number(parsed.settings.electricityRate);
        if (!isNaN(rate) && rate > 0) {
          this.saveSettings({
            electricityRate: rate,
            currency: parsed.settings.currency || '₹',
            billingDays: Number(parsed.settings.billingDays) || 30
          });
        }
      }

      return { success: true, count: validAppliances.length };
    } catch (e) {
      return { success: false, error: 'Failed to parse JSON file: ' + e.message };
    }
  },

  /**
   * Clears all appliances and resets settings to default
   */
  clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.APPLIANCES);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error clearing data:', e);
      return false;
    }
  }
};
