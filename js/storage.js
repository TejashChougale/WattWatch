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
  testNamespace: null,
  corruptedState: null,

  ALLOWED_CATEGORIES: ['Cooling', 'Lighting', 'Kitchen', 'Entertainment', 'Computing', 'Other'],

  /**
   * Sets a test-only storage key prefix for isolated automated testing
   * @param {string|null} prefix
   */
  setTestNamespace(prefix) {
    this.testNamespace = (typeof prefix === 'string' && prefix.trim().length > 0) ? prefix.trim() : null;
  },

  /**
   * Gets current test storage namespace
   * @returns {string|null}
   */
  getTestNamespace() {
    return this.testNamespace;
  },

  /**
   * Checks whether corrupted storage has been detected and quarantined
   * @returns {boolean}
   */
  hasCorruptedData() {
    return this.corruptedState !== null;
  },

  /**
   * Safely escapes HTML special characters
   * @param {*} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Validates an appliance record against strict domain rules.
   * Rejects malformed values, decimal quantities, negative power ratings, and unwhitelisted categories.
   * @param {*} app
   * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
   */
  validateAppliance(app) {
    if (!app || typeof app !== 'object' || Array.isArray(app)) {
      return { valid: false, error: 'Appliance record must be an object' };
    }

    // Name validation
    if (typeof app.name !== 'string' || !app.name.trim()) {
      return { valid: false, error: 'Appliance name is required' };
    }
    const cleanName = app.name.trim();
    if (cleanName.length > 100) {
      return { valid: false, error: 'Appliance name must not exceed 100 characters' };
    }

    // Category validation against exact allowed whitelist
    const rawCategory = typeof app.category === 'string' ? app.category.trim() : '';
    const matchedCategory = this.ALLOWED_CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase());
    if (!matchedCategory) {
      return {
        valid: false,
        error: `Invalid category "${rawCategory}". Allowed categories are: ${this.ALLOWED_CATEGORIES.join(', ')}`
      };
    }

    // Power Rating (Watts): strictly positive finite number up to 50,000 W
    const numWatts = Number(app.powerWatts);
    if (typeof app.powerWatts === 'boolean' || isNaN(numWatts) || !Number.isFinite(numWatts) || numWatts <= 0) {
      return { valid: false, error: 'Power rating must be a positive number greater than 0 Watts' };
    }
    if (numWatts > 50000) {
      return { valid: false, error: 'Power rating cannot exceed 50,000 Watts' };
    }

    // Quantity: strictly whole positive integer >= 1 (reject decimals like 1.5)
    const numQty = Number(app.quantity);
    if (typeof app.quantity === 'boolean' || isNaN(numQty) || !Number.isFinite(numQty) || !Number.isInteger(numQty) || numQty < 1) {
      return { valid: false, error: 'Quantity must be a positive whole integer of at least 1 unit' };
    }
    if (numQty > 100) {
      return { valid: false, error: 'Quantity cannot exceed 100 units' };
    }

    // Daily hours: strictly finite number >= 0 and <= 24
    const numHours = Number(app.dailyHours);
    if (typeof app.dailyHours === 'boolean' || isNaN(numHours) || !Number.isFinite(numHours) || numHours < 0 || numHours > 24) {
      return { valid: false, error: 'Daily usage hours must be between 0 and 24 hours' };
    }

    // Operating days: strictly integer between 1 and 31
    const numDays = Number(app.operatingDays);
    if (typeof app.operatingDays === 'boolean' || isNaN(numDays) || !Number.isFinite(numDays) || !Number.isInteger(numDays) || numDays < 1 || numDays > 31) {
      return { valid: false, error: 'Operating days per month must be an integer between 1 and 31 days' };
    }

    // Safe ID
    let id = typeof app.id === 'string' && app.id.trim() ? app.id.trim() : null;
    if (!id || /[^a-zA-Z0-9_\-]/.test(id)) {
      id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // Timestamp
    let createdAt = Date.now();
    if (app.createdAt) {
      const parsedTime = typeof app.createdAt === 'number' ? app.createdAt : new Date(app.createdAt).getTime();
      if (!isNaN(parsedTime) && parsedTime > 0) {
        createdAt = parsedTime;
      }
    }

    const sanitized = {
      id,
      name: cleanName,
      category: matchedCategory,
      powerWatts: numWatts,
      quantity: numQty,
      dailyHours: numHours,
      operatingDays: numDays,
      createdAt
    };

    // Preserve optional calculation metrics if present (e.g. from historical snapshots)
    if (app.monthlyCost !== undefined && !isNaN(Number(app.monthlyCost))) {
      sanitized.monthlyCost = Math.max(0, Number(app.monthlyCost));
    }
    if (app.monthlyKwh !== undefined && !isNaN(Number(app.monthlyKwh))) {
      sanitized.monthlyKwh = Math.max(0, Number(app.monthlyKwh));
    }
    if (app.dailyCost !== undefined && !isNaN(Number(app.dailyCost))) {
      sanitized.dailyCost = Math.max(0, Number(app.dailyCost));
    }
    if (app.dailyKwh !== undefined && !isNaN(Number(app.dailyKwh))) {
      sanitized.dailyKwh = Math.max(0, Number(app.dailyKwh));
    }
    if (app.sharePercentage !== undefined && !isNaN(Number(app.sharePercentage))) {
      sanitized.sharePercentage = Math.max(0, Number(app.sharePercentage));
    }

    return {
      valid: true,
      sanitized
    };
  },

  /**
   * Validates billing period string format (strictly YYYY-MM)
   * @param {string} period
   * @returns {boolean}
   */
  validatePeriod(period) {
    if (typeof period !== 'string') return false;
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period.trim());
  },

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
   * Resolves storage key based on active user context and optional test namespace
   * When in Guest Mode (activeUserId is null), returns the guest key.
   * When authenticated, returns a user-isolated key namespace.
   * @param {'APPLIANCES'|'SETTINGS'|'THEME'|'HISTORY'} entity
   * @returns {string}
   */
  _getKey(entity) {
    const prefix = this.testNamespace || '';
    if (this.activeUserId && entity !== 'THEME') {
      return `${prefix}wattwatch_user_${this.activeUserId}_${entity.toLowerCase()}`;
    }
    return `${prefix}${STORAGE_KEYS[entity]}`;
  },

  /**
   * Resolves the guest storage key under active test namespace
   * @param {'APPLIANCES'|'SETTINGS'|'THEME'|'HISTORY'} entity
   * @returns {string}
   */
  _getGuestKey(entity) {
    const prefix = this.testNamespace || '';
    return `${prefix}${STORAGE_KEYS[entity]}`;
  },

  /**
   * Checks whether guest data currently exists in local storage
   * @returns {{ hasData: boolean, appliancesCount: number, historyCount: number }}
   */
  hasGuestData() {
    try {
      const appStr = localStorage.getItem(this._getGuestKey('APPLIANCES'));
      const histStr = localStorage.getItem(this._getGuestKey('HISTORY'));
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
      const prefix = this.testNamespace || '';
      // 1. Read guest data defensively
      const guestAppliancesStr = localStorage.getItem(this._getGuestKey('APPLIANCES'));
      const guestHistoryStr = localStorage.getItem(this._getGuestKey('HISTORY'));
      const guestSettingsStr = localStorage.getItem(this._getGuestKey('SETTINGS'));

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
      const userAppKey = `${prefix}wattwatch_user_${uid}_appliances`;
      const userHistKey = `${prefix}wattwatch_user_${uid}_history`;
      const userSettKey = `${prefix}wattwatch_user_${uid}_settings`;

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
        const validated = this.validateAppliance(gApp);
        if (!validated.valid) {
          skippedAppliancesCount++;
          continue;
        }

        const appItem = validated.sanitized;
        const normGName = appItem.name.toLowerCase();
        const gWatts = appItem.powerWatts;

        const isDup = mergedAppliances.some(uApp =>
          uApp && uApp.name &&
          String(uApp.name).trim().toLowerCase() === normGName &&
          Number(uApp.powerWatts) === gWatts
        );

        if (!isDup) {
          const newApp = { ...appItem };
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
        const valSnap = this.validateSnapshot(gSnap);
        if (!valSnap.valid) {
          skippedHistoryCount++;
          continue;
        }

        const existingIdx = mergedHistory.findIndex(uSnap => uSnap && uSnap.period === gSnap.period);
        if (existingIdx === -1) {
          const newSnap = { ...gSnap };
          if (mergedHistory.some(h => h && h.id === newSnap.id)) {
            newSnap.id = `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          }
          // Validate appliances in snapshot
          if (Array.isArray(newSnap.appliancesSnapshot)) {
            newSnap.appliancesSnapshot = newSnap.appliancesSnapshot
              .map(a => this.validateAppliance(a))
              .filter(v => v.valid)
              .map(v => v.sanitized);
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
   * Retrieves saved appliances from localStorage with safety validation and corrupted data preservation
   * @returns {Array} List of validated appliance objects
   */
  getAppliances() {
    const key = this._getKey('APPLIANCES');
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        throw new Error('Stored appliances payload is not an array');
      }
      const validated = [];
      for (const item of parsed) {
        const v = this.validateAppliance(item);
        if (v.valid) {
          validated.push(v.sanitized);
        } else {
          console.warn('[WattWatch Storage] Skipping invalid stored appliance record:', v.error, item);
        }
      }
      return validated;
    } catch (e) {
      console.error('[WattWatch Storage] Error reading appliances:', e);
      const raw = localStorage.getItem(key);
      if (raw) {
        const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
        try {
          localStorage.setItem(backupKey, raw);
          this.corruptedState = { key, backupKey, timestamp: Date.now() };
          console.warn(`[WattWatch Storage] Preserved raw corrupted appliances data in "${backupKey}".`);
        } catch (bErr) { /* ignore quota */ }
      }
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
    const key = this._getKey('SETTINGS');
    try {
      const data = localStorage.getItem(key);
      if (!data) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(data);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Stored settings payload is not a valid object');
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      console.error('[WattWatch Storage] Error reading settings:', e);
      const raw = localStorage.getItem(key);
      if (raw) {
        const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
        try {
          localStorage.setItem(backupKey, raw);
          this.corruptedState = { key, backupKey, timestamp: Date.now() };
          console.warn(`[WattWatch Storage] Preserved raw corrupted settings data in "${backupKey}".`);
        } catch (bErr) { /* ignore quota */ }
      }
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
   * Retrieves historical bill snapshots with safety validation and corrupted data preservation
   * @returns {Array} List of snapshot objects
   */
  getHistory() {
    const key = this._getKey('HISTORY');
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        throw new Error('Stored history payload is not an array');
      }
      const validated = [];
      const parseRate = (val, fallback = 8.00) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && num >= 0) return num;
        }
        return fallback;
      };

      for (const snap of parsed) {
        const v = this.validateSnapshot(snap);
        if (v.valid) {
          const sanitizedSnapApps = Array.isArray(snap.appliancesSnapshot)
            ? snap.appliancesSnapshot.map(a => this.validateAppliance(a)).filter(item => item.valid).map(item => item.sanitized)
            : [];

          let createdAt = null;
          if (typeof snap.createdAt === 'number' && !isNaN(snap.createdAt) && snap.createdAt > 0) {
            createdAt = snap.createdAt;
          } else if (typeof snap.createdAt === 'string' && snap.createdAt.trim()) {
            const parsedTime = new Date(snap.createdAt).getTime();
            if (!isNaN(parsedTime) && parsedTime > 0) {
              createdAt = parsedTime;
            }
          }

          const electRate = parseRate(snap.electricityRate, 8.00);
          const flatRate = parseRate(snap.flatRate, electRate);
          const effectiveRate = parseRate(snap.effectiveRate, electRate);

          validated.push({
            id: (typeof snap.id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(snap.id)) ? snap.id : `snap_${Date.now()}`,
            period: snap.period.trim(),
            periodLabel: typeof snap.periodLabel === 'string' ? snap.periodLabel.trim() : snap.period.trim(),
            totalKwh: Number(snap.totalKwh),
            totalCost: Number(snap.totalCost),
            electricityRate: electRate,
            flatRate: flatRate,
            effectiveRate: effectiveRate,
            tariffModel: (snap.tariffModel === 'slab' || snap.tariffModel === 'flat') ? snap.tariffModel : 'flat',
            tariffBreakdown: snap.tariffBreakdown && typeof snap.tariffBreakdown === 'object' ? snap.tariffBreakdown : null,
            appliancesCount: snap.appliancesCount !== undefined ? Number(snap.appliancesCount) : sanitizedSnapApps.length,
            totalUnits: snap.totalUnits !== undefined ? Number(snap.totalUnits) : sanitizedSnapApps.reduce((acc, a) => acc + (a.quantity || 1), 0),
            appliancesSnapshot: sanitizedSnapApps,
            createdAt: createdAt,
            notes: typeof snap.notes === 'string' ? snap.notes : ''
          });
        } else {
          console.warn('[WattWatch Storage] Skipping invalid stored snapshot record:', v.error, snap);
        }
      }
      return validated;
    } catch (e) {
      console.error('[WattWatch Storage] Error reading history:', e);
      const raw = localStorage.getItem(key);
      if (raw) {
        const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
        try {
          localStorage.setItem(backupKey, raw);
          this.corruptedState = { key, backupKey, timestamp: Date.now() };
          console.warn(`[WattWatch Storage] Preserved raw corrupted history data in "${backupKey}".`);
        } catch (bErr) { /* ignore quota */ }
      }
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
   * Validates a historical snapshot object.
   * Strictly verifies required numeric fields (totalKwh, totalCost, etc.).
   * Rejects null, undefined, empty strings, whitespace, booleans, NaN, Infinity,
   * negative values and malformed numeric strings.
   * @param {*} snapshot
   * @returns {{ valid: boolean, error?: string }}
   */
  validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return { valid: false, error: 'Snapshot must be a valid object' };
    }

    if (typeof snapshot.period !== 'string' || !this.validatePeriod(snapshot.period)) {
      return { valid: false, error: 'Snapshot period is required and must follow YYYY-MM format' };
    }

    const isStrictFiniteNonNegative = (val) => {
      if (val === null || val === undefined || typeof val === 'boolean') return false;
      if (typeof val === 'number') {
        return !Number.isNaN(val) && Number.isFinite(val) && val >= 0;
      }
      if (typeof val === 'string') {
        if (val.trim() === '' || /\s/.test(val)) return false;
        if (!/^\d+(\.\d+)?$/.test(val)) return false;
        const num = Number(val);
        return Number.isFinite(num) && num >= 0;
      }
      return false;
    };

    const isStrictFiniteInteger = (val) => {
      if (!isStrictFiniteNonNegative(val)) return false;
      if (typeof val === 'string' && val.includes('.')) return false;
      return Number.isInteger(Number(val));
    };

    // Required numeric fields
    if (!isStrictFiniteNonNegative(snapshot.totalKwh)) {
      return { valid: false, error: 'Snapshot totalKwh must be a non-negative finite number' };
    }
    if (!isStrictFiniteNonNegative(snapshot.totalCost)) {
      return { valid: false, error: 'Snapshot totalCost must be a non-negative finite number' };
    }

    // Optional numeric fields if present
    if (snapshot.effectiveRate !== undefined && !isStrictFiniteNonNegative(snapshot.effectiveRate)) {
      return { valid: false, error: 'Snapshot effectiveRate must be a non-negative finite number' };
    }
    if (snapshot.electricityRate !== undefined && !isStrictFiniteNonNegative(snapshot.electricityRate)) {
      return { valid: false, error: 'Snapshot electricityRate must be a non-negative finite number' };
    }
    if (snapshot.flatRate !== undefined && !isStrictFiniteNonNegative(snapshot.flatRate)) {
      return { valid: false, error: 'Snapshot flatRate must be a non-negative finite number' };
    }
    if (snapshot.appliancesCount !== undefined && !isStrictFiniteInteger(snapshot.appliancesCount)) {
      return { valid: false, error: 'Snapshot appliancesCount must be a non-negative whole integer' };
    }
    if (snapshot.totalUnits !== undefined && !isStrictFiniteInteger(snapshot.totalUnits)) {
      return { valid: false, error: 'Snapshot totalUnits must be a non-negative whole integer' };
    }
    if (snapshot.energyCharges !== undefined && !isStrictFiniteNonNegative(snapshot.energyCharges)) {
      return { valid: false, error: 'Snapshot energyCharges must be a non-negative finite number' };
    }
    if (snapshot.fixedCharges !== undefined && !isStrictFiniteNonNegative(snapshot.fixedCharges)) {
      return { valid: false, error: 'Snapshot fixedCharges must be a non-negative finite number' };
    }
    if (snapshot.taxCharges !== undefined && !isStrictFiniteNonNegative(snapshot.taxCharges)) {
      return { valid: false, error: 'Snapshot taxCharges must be a non-negative finite number' };
    }

    return { valid: true };
  },

  /**
   * Adds or updates a monthly snapshot
   * @param {Object} snapshot
   * @returns {boolean}
   */
  saveSnapshot(snapshot) {
    const val = this.validateSnapshot(snapshot);
    if (!val.valid) {
      console.warn('[WattWatch Storage] Refusing to persist invalid snapshot:', val.error, snapshot);
      return false;
    }
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
    const currentSettings = this.getSettings();
    currentSettings.theme = this.getTheme();
    const exportPayload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      generator: 'WattWatch Energy Analytics',
      settings: currentSettings,
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
      let firstApplianceError = null;
      for (const item of parsed.appliances) {
        const v = this.validateAppliance(item);
        if (!v.valid) {
          if (!firstApplianceError) firstApplianceError = v.error;
          continue;
        }
        validAppliances.push(v.sanitized);
      }

      if (validAppliances.length === 0 && parsed.appliances.length > 0) {
        return { success: false, error: `No valid appliance records found in imported file: ${firstApplianceError || 'Validation failed'}` };
      }

      // Validate historical snapshots if present
      const validHistory = [];
      const parseRate = (val, fallback = 8.00) => {
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && num >= 0) return num;
        }
        return fallback;
      };

      if (Array.isArray(parsed.history)) {
        for (const snap of parsed.history) {
          const valSnap = this.validateSnapshot(snap);
          if (!valSnap.valid) {
            skippedHistCount++;
            continue;
          }

          const sanitizedSnapApps = Array.isArray(snap.appliancesSnapshot)
            ? snap.appliancesSnapshot.map(a => this.validateAppliance(a)).filter(v => v.valid).map(v => v.sanitized)
            : [];

          let createdAt = null;
          if (typeof snap.createdAt === 'number' && !isNaN(snap.createdAt) && snap.createdAt > 0) {
            createdAt = snap.createdAt;
          } else if (typeof snap.createdAt === 'string' && snap.createdAt.trim()) {
            const parsedTime = new Date(snap.createdAt).getTime();
            if (!isNaN(parsedTime) && parsedTime > 0) {
              createdAt = parsedTime;
            }
          }

          const electRate = parseRate(snap.electricityRate, 8.00);
          const flatRate = parseRate(snap.flatRate, electRate);
          const effectiveRate = parseRate(snap.effectiveRate, electRate);

          validHistory.push({
            id: (typeof snap.id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(snap.id)) ? snap.id : `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            period: snap.period.trim(),
            periodLabel: typeof snap.periodLabel === 'string' ? snap.periodLabel.trim() : snap.period.trim(),
            totalKwh: Number(snap.totalKwh),
            totalCost: Number(snap.totalCost),
            electricityRate: electRate,
            flatRate: flatRate,
            effectiveRate: effectiveRate,
            tariffModel: (snap.tariffModel === 'slab' || snap.tariffModel === 'flat') ? snap.tariffModel : 'flat',
            tariffBreakdown: snap.tariffBreakdown && typeof snap.tariffBreakdown === 'object' ? snap.tariffBreakdown : null,
            appliancesCount: Math.max(0, Number(snap.appliancesCount) || sanitizedSnapApps.length),
            totalUnits: Math.max(0, Number(snap.totalUnits) || sanitizedSnapApps.reduce((acc, a) => acc + (a.quantity || 1), 0)),
            appliancesSnapshot: sanitizedSnapApps,
            createdAt: createdAt,
            notes: typeof snap.notes === 'string' ? snap.notes : ''
          });
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

      // Snapshot existing appliances, history, settings and theme before writing
      const appKey = this._getKey('APPLIANCES');
      const histKey = this._getKey('HISTORY');
      const settKey = this._getKey('SETTINGS');
      const themeKey = this._getKey('THEME');

      const storageSnapshot = {
        appliances: localStorage.getItem(appKey),
        history: localStorage.getItem(histKey),
        settings: localStorage.getItem(settKey),
        theme: localStorage.getItem(themeKey)
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
        if (Array.isArray(parsed.settings.slabConfig)) {
          const candidate = parsed.settings.slabConfig;
          const validSlabs = candidate.length > 0 && candidate.every((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
            const rate = Number(item.rate);
            if (!Number.isFinite(rate) || rate < 0) return false;
            if (item.upTo === null) return index === candidate.length - 1;
            const limit = Number(item.upTo);
            if (!Number.isFinite(limit) || limit <= 0) return false;
            return index === 0 || limit > Number(candidate[index - 1].upTo);
          }) && candidate[candidate.length - 1].upTo === null;
          if (validSlabs) newSettings.slabConfig = candidate.map(item => ({
            upTo: item.upTo === null ? null : Number(item.upTo),
            rate: Number(item.rate)
          }));
        }
        if (!isNaN(Number(parsed.settings.fixedCharges))) newSettings.fixedCharges = Number(parsed.settings.fixedCharges);
        if (!isNaN(Number(parsed.settings.additionalTaxPercent))) newSettings.additionalTaxPercent = Number(parsed.settings.additionalTaxPercent);
        if (parsed.settings.carbonEmissionFactor === null || !isNaN(Number(parsed.settings.carbonEmissionFactor))) {
          newSettings.carbonEmissionFactor = parsed.settings.carbonEmissionFactor;
        }
        if (parsed.settings.theme === 'dark' || parsed.settings.theme === 'light') {
          newSettings.theme = parsed.settings.theme;
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
          if (newSettings.theme) {
            localStorage.setItem(themeKey, newSettings.theme === 'dark' ? 'dark' : 'light');
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.setAttribute('data-theme', newSettings.theme);
            }
          }
        }
      } catch (writeErr) {
        console.error('[WattWatch Storage] Write failure during JSON import, attempting restoration:', writeErr);

        let restoredApps = false;
        let restoredHist = false;
        let restoredSett = false;
        let restoredTheme = false;

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

        try {
          if (storageSnapshot.theme !== null) {
            localStorage.setItem(themeKey, storageSnapshot.theme);
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.setAttribute('data-theme', storageSnapshot.theme);
            }
          } else {
            localStorage.removeItem(themeKey);
          }
          restoredTheme = true;
        } catch (rErr4) {
          console.error('[WattWatch Storage] Failed to restore theme:', rErr4);
        }

        const fullRestoration = restoredApps && restoredHist && restoredSett && restoredTheme;

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
    const prefix = this.testNamespace || '';
    return this.activeUserId
      ? `${prefix}wattwatch_user_${this.activeUserId}_guide_dismissed`
      : `${prefix}wattwatch_guest_guide_dismissed`;
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
   * Neutralizes leading characters (=, +, -, @, \t, \r, \n) including when preceded
   * by leading spaces by prepending a single quote (') while strictly preserving
   * legitimate negative/positive numeric values (e.g. -15.5, +100).
   * @param {*} val
   * @returns {string}
   */
  escapeCsvField(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);

    // Neutralize formula injection characters (=, +, -, @, \t, \r, \n)
    // even when preceded by leading spaces (without stripping tabs/newlines)
    const strippedSpaces = str.replace(/^[ \u00A0]+/, '');
    const formulaChars = ['=', '+', '-', '@', '\t', '\r', '\n'];
    if (strippedSpaces.length > 0 && formulaChars.includes(strippedSpaces.charAt(0)) && !this.isLegitimateNumber(str)) {
      str = "'" + str;
    }

    return `"${str.replace(/"/g, '""')}"`;
  },

  /**
   * Generates CSV string for active user's appliance inventory
   * @returns {string}
   */
  generateAppliancesCSV() {
    let appliances = [];
    const key = this._getKey('APPLIANCES');
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      appliances = Array.isArray(parsed) ? parsed : this.getAppliances();
    } catch (_) {
      appliances = this.getAppliances();
    }
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
      let monthlyKwh = 'N/A';
      let monthlyCost = 'N/A';

      if (calcApp) {
        if (Number.isFinite(calcApp.monthlyKwh) && calcApp.monthlyKwh >= 0) {
          monthlyKwh = calcApp.monthlyKwh.toFixed(2);
        }
        if (Number.isFinite(calcApp.monthlyCost) && calcApp.monthlyCost >= 0) {
          monthlyCost = calcApp.monthlyCost.toFixed(2);
        }
      } else {
        const pWatts = Number(app.powerWatts);
        const dHours = Number(app.dailyHours);
        const oDays = Number(app.operatingDays);
        const qty = Number(app.quantity);
        if (Number.isFinite(pWatts) && pWatts >= 0 &&
            Number.isFinite(dHours) && dHours >= 0 && dHours <= 24 &&
            Number.isFinite(oDays) && oDays >= 0 && oDays <= 31 && Number.isInteger(oDays) &&
            Number.isFinite(qty) && qty >= 1 && Number.isInteger(qty)) {
          const rawKwh = (pWatts * dHours * oDays * qty) / 1000;
          monthlyKwh = rawKwh.toFixed(2);
          const rate = Number(settings.electricityRate);
          if (Number.isFinite(rate) && rate >= 0) {
            monthlyCost = (rawKwh * rate).toFixed(2);
          }
        }
      }

      const pWattsSafe = (Number.isFinite(Number(app.powerWatts)) && Number(app.powerWatts) >= 0) ? Number(app.powerWatts) : 'N/A';
      const dHoursSafe = (Number.isFinite(Number(app.dailyHours)) && Number(app.dailyHours) >= 0 && Number(app.dailyHours) <= 24) ? Number(app.dailyHours) : 'N/A';
      const oDaysSafe = (Number.isFinite(Number(app.operatingDays)) && Number(app.operatingDays) >= 0 && Number(app.operatingDays) <= 31 && Number.isInteger(Number(app.operatingDays))) ? Number(app.operatingDays) : 'N/A';
      const qtySafe = (Number.isFinite(Number(app.quantity)) && Number(app.quantity) >= 0 && Number.isInteger(Number(app.quantity))) ? Number(app.quantity) : 'N/A';

      return [
        this.escapeCsvField(app.name || ''),
        this.escapeCsvField(app.category || 'Other'),
        pWattsSafe,
        dHoursSafe,
        oDaysSafe,
        qtySafe,
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
      const key = this._getKey('APPLIANCES');
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const hasInvalid = parsed.some(app => !this.validateAppliance(app).valid);
            if (hasInvalid) {
              if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
                WattWatchApp.showToast('Cannot export CSV: inventory contains invalid appliance records.', 'error', 'Export Error');
              }
              return false;
            }
          }
        } catch (_) {}
      }
      const appliances = this.getAppliances();
      const settings = this.getSettings();
      if (typeof WattWatchCalculations !== 'undefined') {
        const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
        if (!summary.isValid) {
          if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
            WattWatchApp.showToast('Cannot export CSV: inventory contains invalid appliance records or invalid rate.', 'error', 'Export Error');
          }
          return false;
        }
      }
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
   * Validates timestamps and guards each record against invalid formats
   * @returns {string}
   */
  generateHistoryCSV() {
    let history = [];
    const key = this._getKey('HISTORY');
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      history = Array.isArray(parsed) ? parsed : this.getHistory();
    } catch (_) {
      history = this.getHistory();
    }
    const headers = ['Period', 'Period Label', 'Total Energy kWh', 'Estimated Bill INR', 'Tariff Model', 'Effective Rate INR per kWh', 'Appliances Count', 'Recorded Date'];
    if (!Array.isArray(history) || history.length === 0) {
      return headers.join(',');
    }

    const rows = [];
    for (const rec of history) {
      if (!rec) continue;
      try {
        let recordedDate = '';
        if (rec.createdAt !== null && rec.createdAt !== undefined) {
          try {
            const d = new Date(rec.createdAt);
            if (!isNaN(d.getTime())) {
              recordedDate = d.toISOString().split('T')[0];
            }
          } catch (_) {
            recordedDate = '';
          }
        }
        const effRateVal = Number(rec.effectiveRate ?? rec.tariffBreakdown?.effectiveRatePerKwh ?? rec.electricityRate);
        const effRate = (Number.isFinite(effRateVal) && effRateVal >= 0) ? effRateVal.toFixed(2) : 'N/A';
        const kwhVal = Number(rec.totalKwh);
        const costVal = Number(rec.totalCost);
        const safeKwh = (Number.isFinite(kwhVal) && kwhVal >= 0) ? kwhVal.toFixed(2) : 'N/A';
        const safeCost = (Number.isFinite(costVal) && costVal >= 0) ? costVal.toFixed(2) : 'N/A';
        const appCount = (rec.appliancesCount !== undefined && Number.isInteger(Number(rec.appliancesCount)) && Number(rec.appliancesCount) >= 0)
          ? Number(rec.appliancesCount)
          : (Array.isArray(rec.appliancesSnapshot) ? rec.appliancesSnapshot.length : 'N/A');

        rows.push([
          this.escapeCsvField(rec.period || ''),
          this.escapeCsvField(rec.periodLabel || rec.period || ''),
          safeKwh,
          safeCost,
          this.escapeCsvField(rec.tariffModel || 'flat'),
          effRate,
          appCount,
          this.escapeCsvField(recordedDate)
        ].join(','));
      } catch (err) {
        console.warn('[WattWatch Storage] Error formatting history CSV row:', err, rec);
      }
    }

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Exports active user's bill history snapshots as a CSV file
   * @returns {boolean}
   */
  exportHistoryCSV() {
    try {
      const key = this._getKey('HISTORY');
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const hasCorrupted = parsed.some(rec => !this.validateSnapshot(rec).valid);
            if (hasCorrupted) {
              if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
                WattWatchApp.showToast('Cannot export CSV: history contains invalid snapshot records.', 'error', 'Export Error');
              }
              return false;
            }
          }
        } catch (_) {}
      }
      const history = this.getHistory();
      const hasCorrupted = history.some(rec => !this.validateSnapshot(rec).valid);
      if (hasCorrupted) {
        if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
          WattWatchApp.showToast('Cannot export CSV: history contains invalid snapshot records.', 'error', 'Export Error');
        }
        return false;
      }
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
      localStorage.removeItem(this.getGuideKey());
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error clearing data:', e);
      return false;
    }
  }
};
