/**
 * WATTWATCH - Storage Module
 * Manages localStorage persistence, sample data loading, historical snapshots,
 * advanced tariff & budget settings, and backward-compatible JSON export/import.
 */

const STORAGE_KEYS = {
  APPLIANCES: 'wattwatch_appliances_v1',
  SETTINGS: 'wattwatch_settings_v1',
  THEME: 'wattwatch_theme_v1',
  HISTORY: 'wattwatch_history_v1'
};

const DEFAULT_SETTINGS = {
  electricityRate: 8.00, // ₹ per kWh (flat rate)
  currency: '₹',
  currencyCode: 'INR',
  billingDays: 30,
  theme: 'light',

  // Advanced Settings Additions (Budget, Tariffs, Emissions)
  budgetInr: 2500, // Monthly electricity budget in INR (0 = unset)
  tariffModel: 'flat', // 'flat' | 'slab'
  slabConfig: [
    { upTo: 100, rate: 4.50 },
    { upTo: 300, rate: 7.50 },
    { upTo: null, rate: 10.00 } // null = and above
  ],
  fixedCharges: 110.00, // Fixed meter/sanctioned load charge (₹/month)
  additionalTaxPercent: 5.0, // Municipal tax / electricity duty %
  carbonEmissionFactor: 0.82 // Grid emission factor in kg CO2e / kWh (India CEA avg; null if cleared)
};

// Curated sample appliances representing a typical modern household
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
  activeUserId: null,

  /**
   * Sets active user context (null = Guest Mode, string = Authenticated User UID)
   * @param {string|null} uid
   */
  setActiveUser(uid) {
    this.activeUserId = (typeof uid === 'string' && uid.trim().length > 0) ? uid.trim() : null;
  },

  /**
   * Gets current active user ID or null for Guest Mode
   * @returns {string|null}
   */
  getActiveUser() {
    return this.activeUserId;
  },

  getActiveUid() {
    return this.activeUserId;
  },

  /**
   * Resolves storage key based on active user context
   * When in Guest Mode (activeUserId is null), returns the original guest keys.
   * When authenticated, returns a user-isolated key namespace.
   * @param {'APPLIANCES'|'SETTINGS'|'THEME'|'HISTORY'} entity
   * @returns {string}
   */
  _getKey(entity) {
    if (this.activeUserId && entity !== 'THEME') {
      return `wattwatch_user_${this.activeUserId}_${entity.toLowerCase()}`;
    }
    return STORAGE_KEYS[entity];
  },

  /**
   * Checks whether guest data currently exists in local storage
   * @returns {{ hasData: boolean, appliancesCount: number, historyCount: number }}
   */
  hasGuestData() {
    try {
      const appStr = localStorage.getItem(STORAGE_KEYS.APPLIANCES);
      const histStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const apps = appStr ? JSON.parse(appStr) : [];
      const hist = histStr ? JSON.parse(histStr) : [];
      const appCount = Array.isArray(apps) ? apps.length : 0;
      const histCount = Array.isArray(hist) ? hist.length : 0;
      return {
        hasData: appCount > 0 || histCount > 0,
        appliancesCount: appCount,
        historyCount: histCount
      };
    } catch (e) {
      return { hasData: false, appliancesCount: 0, historyCount: 0 };
    }
  },

  /**
   * Safely migrates guest mode appliances and history into a user's account namespace
   * Transfers guest mode data into the user's account namespace within this browser's localStorage.
   * Note: This is a local browser migration, NOT cross-device cloud synchronization.
   * Leaves original guest data in localStorage 100% intact and untouched.
   * Never overwrites existing account appliances, settings, or history.
   * Deduplicates appliances by normalized name and power rating.
   * Merges history by period (YYYY-MM), strictly preserving existing account snapshots.
   * Imports settings only when the destination account has no existing settings.
   * Repeated migrations are idempotent.
   *
   * @param {string} uid - User identifier
   * @param {Object} [options]
   * @returns {{
   *   success: boolean,
   *   transferredAppliances: number,
   *   transferredHistory: number,
   *   skippedAppliances: number,
   *   skippedHistory: number,
   *   importedSettings: boolean,
   *   totalAppliances: number,
   *   totalHistory: number,
   *   error?: string
   * }}
   */
  migrateGuestData(uid, options = {}) {
    if (!uid) {
      return {
        success: false,
        transferredAppliances: 0,
        transferredHistory: 0,
        skippedAppliances: 0,
        skippedHistory: 0,
        importedSettings: false,
        totalAppliances: 0,
        totalHistory: 0,
        error: 'No user ID provided'
      };
    }

    try {
      // 1. Read guest data defensively
      const guestAppliancesStr = localStorage.getItem(STORAGE_KEYS.APPLIANCES);
      const guestHistoryStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const guestSettingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);

      let guestAppliances = [];
      try {
        const parsed = guestAppliancesStr ? JSON.parse(guestAppliancesStr) : [];
        guestAppliances = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        guestAppliances = [];
      }

      let guestHistory = [];
      try {
        const parsed = guestHistoryStr ? JSON.parse(guestHistoryStr) : [];
        guestHistory = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        guestHistory = [];
      }

      let guestSettings = null;
      try {
        guestSettings = guestSettingsStr ? JSON.parse(guestSettingsStr) : null;
      } catch (e) {
        guestSettings = null;
      }

      // 2. Read existing user data
      const userAppKey = `wattwatch_user_${uid}_appliances`;
      const userHistKey = `wattwatch_user_${uid}_history`;
      const userSettKey = `wattwatch_user_${uid}_settings`;

      let userAppliances = [];
      try {
        const parsed = localStorage.getItem(userAppKey) ? JSON.parse(localStorage.getItem(userAppKey)) : [];
        userAppliances = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        userAppliances = [];
      }

      let userHistory = [];
      try {
        const parsed = localStorage.getItem(userHistKey) ? JSON.parse(localStorage.getItem(userHistKey)) : [];
        userHistory = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        userHistory = [];
      }

      let userSettings = null;
      try {
        const raw = localStorage.getItem(userSettKey);
        userSettings = raw ? JSON.parse(raw) : null;
      } catch (e) {
        userSettings = null;
      }

      let transferredAppliancesCount = 0;
      let skippedAppliancesCount = 0;
      let transferredHistoryCount = 0;
      let skippedHistoryCount = 0;

      // 3. Merge appliances avoiding duplicates (by normalized name and power rating)
      const mergedAppliances = [...userAppliances];
      for (const gApp of guestAppliances) {
        if (!gApp || typeof gApp !== 'object' || !gApp.name || isNaN(Number(gApp.powerWatts))) {
          skippedAppliancesCount++;
          continue;
        }

        const normGName = String(gApp.name).trim().toLowerCase();
        const gWatts = Number(gApp.powerWatts);

        const isDup = mergedAppliances.some(uApp =>
          uApp && uApp.name &&
          String(uApp.name).trim().toLowerCase() === normGName &&
          Number(uApp.powerWatts) === gWatts
        );

        if (!isDup) {
          const newApp = { ...gApp };
          // Ensure new unique ID in user space if conflicting ID exists
          if (mergedAppliances.some(a => a && a.id === newApp.id)) {
            newApp.id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          }
          mergedAppliances.push(newApp);
          transferredAppliancesCount++;
        } else {
          skippedAppliancesCount++;
        }
      }

      // 4. Merge history by period (YYYY-MM), strictly preserving existing account snapshots
      const mergedHistory = [...userHistory];
      for (const gSnap of guestHistory) {
        if (!gSnap || typeof gSnap !== 'object' || !gSnap.period) {
          skippedHistoryCount++;
          continue;
        }

        const existingIdx = mergedHistory.findIndex(uSnap => uSnap && uSnap.period === gSnap.period);
        if (existingIdx === -1) {
          const newSnap = { ...gSnap };
          if (mergedHistory.some(h => h && h.id === newSnap.id)) {
            newSnap.id = `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          }
          mergedHistory.push(newSnap);
          transferredHistoryCount++;
        } else {
          // Existing account history snapshot preserved; guest snapshot skipped
          skippedHistoryCount++;
        }
      }
      mergedHistory.sort((a, b) => String(b.period).localeCompare(String(a.period)));

      // 5. Import settings only when destination account has no existing settings
      let mergedSettings = userSettings;
      let importedSettings = false;
      if ((!userSettings || Object.keys(userSettings).length === 0) && guestSettings && typeof guestSettings === 'object') {
        mergedSettings = { ...guestSettings };
        importedSettings = true;
      }

      // 6. Transactional write to destination user namespace in localStorage with rollback defense
      const userSnapshot = {
        app: localStorage.getItem(userAppKey),
        hist: localStorage.getItem(userHistKey),
        sett: localStorage.getItem(userSettKey)
      };

      try {
        localStorage.setItem(userAppKey, JSON.stringify(mergedAppliances));
        localStorage.setItem(userHistKey, JSON.stringify(mergedHistory));
        if (mergedSettings) {
          localStorage.setItem(userSettKey, JSON.stringify(mergedSettings));
        }
      } catch (writeErr) {
        // Rollback state completely if QuotaExceededError or write failure occurs
        console.error('[WattWatch Storage] Write failure during migration, rolling back destination storage:', writeErr);
        try {
          if (userSnapshot.app !== null) localStorage.setItem(userAppKey, userSnapshot.app);
          else localStorage.removeItem(userAppKey);
        } catch (rbErr1) { /* ignore secondary error */ }

        try {
          if (userSnapshot.hist !== null) localStorage.setItem(userHistKey, userSnapshot.hist);
          else localStorage.removeItem(userHistKey);
        } catch (rbErr2) { /* ignore secondary error */ }

        try {
          if (userSnapshot.sett !== null) localStorage.setItem(userSettKey, userSnapshot.sett);
          else localStorage.removeItem(userSettKey);
        } catch (rbErr3) { /* ignore secondary error */ }

        return {
          success: false,
          rolledBack: true,
          transferredAppliances: 0,
          skippedAppliances: 0,
          transferredHistory: 0,
          skippedHistory: 0,
          importedSettings: false,
          totalAppliances: userAppliances.length,
          totalHistory: userHistory.length,
          error: `Storage write failure: ${writeErr.message}. Destination state was rolled back.`
        };
      }

      // Note: Guest records in localStorage are left 100% intact and untouched.

      return {
        success: true,
        transferredAppliances: transferredAppliancesCount,
        skippedAppliances: skippedAppliancesCount,
        transferredHistory: transferredHistoryCount,
        skippedHistory: skippedHistoryCount,
        importedSettings: importedSettings,
        totalAppliances: mergedAppliances.length,
        totalHistory: mergedHistory.length
      };
    } catch (e) {
      console.error('[WattWatch Storage] Error migrating guest data:', e);
      return {
        success: false,
        rolledBack: false,
        transferredAppliances: 0,
        skippedAppliances: 0,
        transferredHistory: 0,
        skippedHistory: 0,
        importedSettings: false,
        totalAppliances: 0,
        totalHistory: 0,
        error: e.message
      };
    }
  },

  /**
   * Copies guest mode data into user's account namespace with explicit consent
   * Leaves original guest data in localStorage 100% intact and untouched
   * @param {string} uid
   * @returns {boolean}
   */
  copyGuestDataToUser(uid) {
    const res = this.migrateGuestData(uid, { overwriteHistory: false });
    return res.success;
  },

  /**
   * Retrieves saved appliances from localStorage with safety fallback
   * @returns {Array} List of appliance objects
   */
  getAppliances() {
    try {
      const data = localStorage.getItem(this._getKey('APPLIANCES'));
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
      localStorage.setItem(this._getKey('APPLIANCES'), JSON.stringify(appliances));
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
      const data = localStorage.getItem(this._getKey('SETTINGS'));
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
      localStorage.setItem(this._getKey('SETTINGS'), JSON.stringify(merged));
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
      const theme = localStorage.getItem(this._getKey('THEME'));
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
      localStorage.setItem(this._getKey('THEME'), theme === 'dark' ? 'dark' : 'light');
    } catch (e) {
      console.error('[WattWatch Storage] Error saving theme:', e);
    }
  },

  /**
   * Retrieves historical bill snapshots
   * @returns {Array} List of snapshot objects
   */
  getHistory() {
    try {
      const data = localStorage.getItem(this._getKey('HISTORY'));
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[WattWatch Storage] Error reading history:', e);
      return [];
    }
  },

  /**
   * Saves historical bill snapshots array
   * @param {Array} history
   * @returns {boolean}
   */
  saveHistory(history) {
    try {
      if (!Array.isArray(history)) throw new Error('History must be an array');
      localStorage.setItem(this._getKey('HISTORY'), JSON.stringify(history));
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving history:', e);
      return false;
    }
  },

  /**
   * Adds or updates a monthly snapshot
   * @param {Object} snapshot
   * @returns {boolean}
   */
  saveSnapshot(snapshot) {
    const history = this.getHistory();
    const index = history.findIndex(h => h.period === snapshot.period);
    if (index !== -1) {
      history[index] = { ...history[index], ...snapshot, updatedAt: Date.now() };
    } else {
      history.push({ ...snapshot, id: snapshot.id || `snap_${Date.now()}`, createdAt: Date.now() });
    }
    // Sort descending by period (e.g. 2026-10 before 2026-09)
    history.sort((a, b) => b.period.localeCompare(a.period));
    return this.saveHistory(history);
  },

  /**
   * Deletes a monthly snapshot by ID
   * @param {string} id
   * @returns {boolean}
   */
  deleteSnapshot(id) {
    const history = this.getHistory();
    const filtered = history.filter(h => h.id !== id);
    return this.saveHistory(filtered);
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
      version: '2.0',
      exportedAt: new Date().toISOString(),
      generator: 'WattWatch Energy Analytics',
      settings: this.getSettings(),
      appliances: this.getAppliances(),
      history: this.getHistory()
    };
    return JSON.stringify(exportPayload, null, 2);
  },

  /**
   * Sanitizes an object by recursively stripping credentials, secrets, or sensitive tokens
   * @param {*} obj
   * @returns {*}
   */
  sanitizeImportPayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = ['password', 'token', 'authdomain', 'apikey', 'secret', 'credentials', 'privatekey', 'accesstoken', 'uid'];
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeImportPayload(item));
    }
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
      if (sensitiveKeys.includes(key.toLowerCase())) continue;
      if (val && typeof val === 'object') {
        clean[key] = this.sanitizeImportPayload(val);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  },

  /**
   * Validates and imports JSON application data with support for v1.0 and v2.0
   * Supports 'merge' (default, safe preservation of existing records) and 'replace' modes
   * @param {string} jsonString
   * @param {{ mode?: 'merge' | 'replace' }} [options={ mode: 'merge' }]
   * @returns {Object} { success: boolean, count?: number, historyCount?: number, skippedCount?: number, mode?: string, error?: string }
   */
  importDataJSON(jsonString, options = { mode: 'merge' }) {
    try {
      let parsed = JSON.parse(jsonString);

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON format' };
      }

      // Check version support
      if (parsed.version && parsed.version !== '1.0' && parsed.version !== '2.0') {
        return { success: false, error: `Unsupported backup version: ${parsed.version}` };
      }

      if (!Array.isArray(parsed.appliances)) {
        return { success: false, error: 'File missing "appliances" list' };
      }

      // Strip sensitive credentials/tokens
      parsed = this.sanitizeImportPayload(parsed);

      const mode = (options && options.mode === 'replace') ? 'replace' : 'merge';

      // Validate each appliance schema
      const validAppliances = [];
      for (const item of parsed.appliances) {
        if (!item || !item.name || typeof item.name !== 'string' || !item.name.trim()) {
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

      // Validate historical snapshots if present
      const validHistory = [];
      if (Array.isArray(parsed.history)) {
        for (const snap of parsed.history) {
          if (snap && snap.period && typeof snap.period === 'string' && !isNaN(Number(snap.totalKwh))) {
            validHistory.push({
              id: snap.id || `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              period: snap.period,
              periodLabel: snap.periodLabel || snap.period,
              totalKwh: Number(snap.totalKwh) || 0,
              totalCost: Number(snap.totalCost) || 0,
              electricityRate: Number(snap.electricityRate) || 8.00,
              tariffModel: snap.tariffModel || 'flat',
              tariffBreakdown: snap.tariffBreakdown || null,
              appliancesCount: Number(snap.appliancesCount) || 0,
              totalUnits: Number(snap.totalUnits) || 0,
              appliancesSnapshot: Array.isArray(snap.appliancesSnapshot) ? snap.appliancesSnapshot : [],
              createdAt: snap.createdAt || Date.now(),
              notes: snap.notes || ''
            });
          }
        }
      }

      let finalAppliances = [];
      let finalHistory = [];
      let importedAppsCount = 0;
      let skippedAppsCount = 0;
      let importedHistCount = 0;
      let skippedHistCount = 0;

      if (mode === 'replace') {
        finalAppliances = validAppliances;
        importedAppsCount = validAppliances.length;
        finalHistory = validHistory.sort((a, b) => b.period.localeCompare(a.period));
        importedHistCount = validHistory.length;
      } else {
        // Safe Merge mode: preserve existing records, skip duplicates
        const existingApps = this.getAppliances();
        finalAppliances = [...existingApps];

        for (const impApp of validAppliances) {
          const normName = impApp.name.toLowerCase();
          const power = impApp.powerWatts;
          const isDup = finalAppliances.some(a =>
            a && a.name &&
            a.name.trim().toLowerCase() === normName &&
            Number(a.powerWatts) === power
          );

          if (!isDup) {
            const newApp = { ...impApp };
            if (finalAppliances.some(a => a.id === newApp.id)) {
              newApp.id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            }
            finalAppliances.push(newApp);
            importedAppsCount++;
          } else {
            skippedAppsCount++;
          }
        }

        const existingHist = this.getHistory();
        finalHistory = [...existingHist];

        for (const impSnap of validHistory) {
          const isDup = finalHistory.some(h => h && h.period === impSnap.period);
          if (!isDup) {
            const newSnap = { ...impSnap };
            if (finalHistory.some(h => h.id === newSnap.id)) {
              newSnap.id = `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            }
            finalHistory.push(newSnap);
            importedHistCount++;
          } else {
            skippedHistCount++;
          }
        }
        finalHistory.sort((a, b) => b.period.localeCompare(a.period));
      }

      // Snapshot existing appliances, history and settings before writing
      const appKey = this._getKey('APPLIANCES');
      const histKey = this._getKey('HISTORY');
      const settKey = this._getKey('SETTINGS');

      const storageSnapshot = {
        appliances: localStorage.getItem(appKey),
        history: localStorage.getItem(histKey),
        settings: localStorage.getItem(settKey)
      };

      // Prepare merged or replaced settings
      let newSettings = null;
      if (parsed.settings && typeof parsed.settings === 'object') {
        const currentSettings = this.getSettings();
        newSettings = mode === 'replace' ? {} : { ...currentSettings };

        if (!isNaN(Number(parsed.settings.electricityRate)) && Number(parsed.settings.electricityRate) > 0) {
          newSettings.electricityRate = Number(parsed.settings.electricityRate);
        }
        if (parsed.settings.currency) newSettings.currency = parsed.settings.currency;
        if (parsed.settings.billingDays) newSettings.billingDays = Number(parsed.settings.billingDays) || 30;

        if (!isNaN(Number(parsed.settings.budgetInr))) newSettings.budgetInr = Number(parsed.settings.budgetInr);
        if (parsed.settings.tariffModel === 'slab' || parsed.settings.tariffModel === 'flat') {
          newSettings.tariffModel = parsed.settings.tariffModel;
        }
        if (Array.isArray(parsed.settings.slabConfig)) newSettings.slabConfig = parsed.settings.slabConfig;
        if (!isNaN(Number(parsed.settings.fixedCharges))) newSettings.fixedCharges = Number(parsed.settings.fixedCharges);
        if (!isNaN(Number(parsed.settings.additionalTaxPercent))) newSettings.additionalTaxPercent = Number(parsed.settings.additionalTaxPercent);
        if (parsed.settings.carbonEmissionFactor === null || !isNaN(Number(parsed.settings.carbonEmissionFactor))) {
          newSettings.carbonEmissionFactor = parsed.settings.carbonEmissionFactor;
        }
      }

      // Perform transactional write with restoration on failure
      try {
        localStorage.setItem(appKey, JSON.stringify(finalAppliances));
        if (validHistory.length > 0 || mode === 'replace') {
          localStorage.setItem(histKey, JSON.stringify(finalHistory));
        }
        if (newSettings !== null) {
          localStorage.setItem(settKey, JSON.stringify(newSettings));
        }
      } catch (writeErr) {
        console.error('[WattWatch Storage] Write failure during JSON import, attempting restoration:', writeErr);

        let restoredApps = false;
        let restoredHist = false;
        let restoredSett = false;

        try {
          if (storageSnapshot.appliances !== null) localStorage.setItem(appKey, storageSnapshot.appliances);
          else localStorage.removeItem(appKey);
          restoredApps = true;
        } catch (rErr1) {
          console.error('[WattWatch Storage] Failed to restore appliances:', rErr1);
        }

        try {
          if (storageSnapshot.history !== null) localStorage.setItem(histKey, storageSnapshot.history);
          else localStorage.removeItem(histKey);
          restoredHist = true;
        } catch (rErr2) {
          console.error('[WattWatch Storage] Failed to restore history:', rErr2);
        }

        try {
          if (storageSnapshot.settings !== null) localStorage.setItem(settKey, storageSnapshot.settings);
          else localStorage.removeItem(settKey);
          restoredSett = true;
        } catch (rErr3) {
          console.error('[WattWatch Storage] Failed to restore settings:', rErr3);
        }

        const fullRestoration = restoredApps && restoredHist && restoredSett;

        return {
          success: false,
          restored: fullRestoration,
          restorationSucceeded: fullRestoration,
          error: `Storage write failure: ${writeErr.message}. ${fullRestoration ? 'Pre-import state was successfully restored.' : 'Warning: Restoration failed or was incomplete.'}`
        };
      }

      return {
        success: true,
        count: importedAppsCount,
        skippedCount: skippedAppsCount,
        historyCount: importedHistCount,
        skippedHistoryCount: skippedHistCount,
        totalAppliances: finalAppliances.length,
        totalHistory: finalHistory.length,
        mode: mode
      };
    } catch (e) {
      return {
        success: false,
        restored: false,
        restorationSucceeded: false,
        error: 'Failed to parse JSON file: ' + e.message
      };
    }
  },

  /**
   * Helper key for storing first-time guidance dismissal state
   * @returns {string}
   */
  getGuideKey() {
    return this.activeUserId
      ? `wattwatch_user_${this.activeUserId}_guide_dismissed`
      : 'wattwatch_guest_guide_dismissed';
  },

  /**
   * Checks whether the first-time user guide has been dismissed for the active context
   * @returns {boolean}
   */
  isGuideDismissed() {
    try {
      return localStorage.getItem(this.getGuideKey()) === 'true';
    } catch (e) {
      return false;
    }
  },

  /**
   * Sets the dismissal status of the first-time user guide
   * @param {boolean} dismissed
   */
  setGuideDismissed(dismissed = true) {
    try {
      if (dismissed) {
        localStorage.setItem(this.getGuideKey(), 'true');
      } else {
        localStorage.removeItem(this.getGuideKey());
      }
    } catch (e) {
      console.warn('[WattWatch Storage] Error saving guide dismissal state:', e);
    }
  },

  /**
   * Universal helper to trigger a browser file download
   * @param {string} content - Text/CSV/JSON content
   * @param {string} filename - Filename to download as
   * @param {string} mimeType - MIME type string
   */
  downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 150);
  },

  /**
   * Checks whether a value represents a valid finite number
   * (including negative values such as -15.5 and exponential representations)
   * @param {*} val
   * @returns {boolean}
   */
  isLegitimateNumber(val) {
    if (typeof val === 'number') {
      return !Number.isNaN(val) && Number.isFinite(val);
    }
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed === '') return false;
    return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
  },

  /**
   * Safely formats and escapes a CSV field value in accordance with RFC 4180
   * and spreadsheet formula injection defenses (CSV injection / DDE attacks).
   * Neutralizes leading characters (=, +, -, @, \t, \r) by prepending a single quote (')
   * while strictly preserving legitimate negative/positive numeric values.
   * @param {*} val
   * @returns {string}
   */
  escapeCsvField(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);

    const firstChar = str.length > 0 ? str.charAt(0) : '';
    const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
    if (formulaChars.includes(firstChar) && !this.isLegitimateNumber(str)) {
      str = "'" + str;
    }

    return `"${str.replace(/"/g, '""')}"`;
  },

  /**
   * Generates CSV string for active user's appliance inventory
   * @returns {string}
   */
  generateAppliancesCSV() {
    const appliances = this.getAppliances();
    const settings = this.getSettings();
    const summary = (typeof WattWatchCalculations !== 'undefined' && WattWatchCalculations.calculateHouseholdSummary)
      ? WattWatchCalculations.calculateHouseholdSummary(appliances, settings)
      : null;

    const headers = ['Name', 'Category', 'Power Watts', 'Daily Hours', 'Operating Days', 'Quantity', 'Monthly kWh', 'Estimated Monthly Cost (INR)'];
    if (!Array.isArray(appliances) || appliances.length === 0) {
      return headers.join(',');
    }

    const rows = appliances.map(app => {
      const calcApp = summary && summary.appliances ? summary.appliances.find(a => a.id === app.id) : null;
      const monthlyKwh = calcApp
        ? calcApp.monthlyKwh.toFixed(2)
        : ((Number(app.powerWatts || 0) * Number(app.dailyHours || 0) * Number(app.operatingDays || 0) * Number(app.quantity || 1)) / 1000).toFixed(2);
      const monthlyCost = calcApp
        ? calcApp.monthlyCost.toFixed(2)
        : (Number(monthlyKwh) * Number(settings.electricityRate || 8)).toFixed(2);

      return [
        this.escapeCsvField(app.name || ''),
        this.escapeCsvField(app.category || 'Other'),
        Number(app.powerWatts || 0),
        Number(app.dailyHours || 0),
        Number(app.operatingDays || 0),
        Number(app.quantity || 1),
        monthlyKwh,
        monthlyCost
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Exports active user's appliance inventory as a CSV file
   * @returns {boolean}
   */
  exportAppliancesCSV() {
    try {
      const csvContent = '\uFEFF' + this.generateAppliancesCSV();
      const dateStr = new Date().toISOString().split('T')[0];
      this.downloadFile(csvContent, `wattwatch-appliances-${dateStr}.csv`, 'text/csv;charset=utf-8;');
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error exporting appliances CSV:', e);
      return false;
    }
  },

  /**
   * Generates CSV string for active user's bill history snapshots
   * @returns {string}
   */
  generateHistoryCSV() {
    const history = this.getHistory();
    const headers = ['Period', 'Period Label', 'Total Energy kWh', 'Estimated Bill INR', 'Tariff Model', 'Effective Rate INR per kWh', 'Appliances Count', 'Recorded Date'];
    if (!Array.isArray(history) || history.length === 0) {
      return headers.join(',');
    }

    const rows = history.map(rec => {
      const recordedDate = rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0] : '';
      const effRate = Number(rec.effectiveRate ?? rec.tariffBreakdown?.effectiveRatePerKwh ?? rec.electricityRate ?? 0).toFixed(2);
      return [
        this.escapeCsvField(rec.period || ''),
        this.escapeCsvField(rec.periodLabel || rec.period || ''),
        Number(rec.totalKwh || 0).toFixed(2),
        Number(rec.totalCost || 0).toFixed(2),
        this.escapeCsvField(rec.tariffModel || 'flat'),
        effRate,
        rec.appliancesCount || (rec.appliancesSnapshot ? rec.appliancesSnapshot.length : 0),
        this.escapeCsvField(recordedDate)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Exports active user's bill history snapshots as a CSV file
   * @returns {boolean}
   */
  exportHistoryCSV() {
    try {
      const csvContent = '\uFEFF' + this.generateHistoryCSV();
      const dateStr = new Date().toISOString().split('T')[0];
      this.downloadFile(csvContent, `wattwatch-history-${dateStr}.csv`, 'text/csv;charset=utf-8;');
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error exporting history CSV:', e);
      return false;
    }
  },

  /**
   * Exports full application data backup as a downloadable JSON file
   * @returns {boolean}
   */
  exportBackupJSONFile() {
    try {
      const jsonStr = this.exportDataJSON();
      const dateStr = new Date().toISOString().split('T')[0];
      this.downloadFile(jsonStr, `wattwatch-backup-${dateStr}.json`, 'application/json;charset=utf-8;');
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error exporting JSON backup:', e);
      return false;
    }
  },

  /**
   * Clears all appliances, history and resets settings to default
   */
  clearAllData() {
    try {
      localStorage.removeItem(this._getKey('APPLIANCES'));
      localStorage.removeItem(this._getKey('SETTINGS'));
      localStorage.removeItem(this._getKey('HISTORY'));
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error clearing data:', e);
      return false;
    }
  }
};
