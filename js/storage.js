/**
 * WATTWATCH - Storage Module
 * Manages localStorage persistence, sample data loading, historical snapshots,
 * advanced tariff & budget settings, and backward-compatible JSON export/import.
 */

const STORAGE_KEYS = {
  APPLIANCES: 'wattwatch_appliances_v1',
  SETTINGS: 'wattwatch_settings_v1',
  THEME: 'wattwatch_theme_v1',
  HISTORY: 'wattwatch_history_v1',
  METER: 'wattwatch_meter_v1'
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
  fixedCharges: 0.00, // Fixed meter/sanctioned load charge (₹/month; 0 for standard flat tariff)
  additionalTaxPercent: 0.0, // Municipal tax / electricity duty % (0 for standard flat tariff)
  freeUnits: 0, // Free monthly electricity units quota (kWh/month)
  billCreditInr: 0, // Government subsidy or bill credit (₹/month)
  carbonEmissionFactor: 0.82 // Grid emission factor in kg CO2e / kWh (India CEA avg; null if cleared)
};

// Curated sample presets representing diverse household scenarios for demonstration & estimation
const SAMPLE_PRESETS = {
  studio_1bhk: {
    id: 'studio_1bhk',
    name: '1 BHK Studio',
    badge: 'Compact Urban',
    description: 'Energy-conscious urban apartment featuring essential cooling, efficient refrigeration, work laptop, and solid-state LED illumination.',
    appliances: [
      {
        name: '1.0 Ton 3-Star Inverter AC',
        category: 'Cooling',
        powerWatts: 1100,
        dailyHours: 5.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Single Door Refrigerator 190L',
        category: 'Kitchen',
        powerWatts: 120,
        dailyHours: 10.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'BLDC Ultra-Quiet Ceiling Fan',
        category: 'Cooling',
        powerWatts: 35,
        dailyHours: 10.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Office Laptop Workstation',
        category: 'Computing',
        powerWatts: 65,
        dailyHours: 8.0,
        operatingDays: 24,
        quantity: 1
      },
      {
        name: 'Microwave Oven (Solo)',
        category: 'Kitchen',
        powerWatts: 800,
        dailyHours: 0.4,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'LED Bulbs 9W (Warm White)',
        category: 'Lighting',
        powerWatts: 9,
        dailyHours: 6.0,
        operatingDays: 30,
        quantity: 4
      }
    ]
  },
  family_2bhk: {
    id: 'family_2bhk',
    name: '2 BHK Family Home',
    badge: 'Standard Household',
    description: 'Comprehensive 4-person family residence equipped with dual ACs, frost-free refrigeration, BLDC fans, smart entertainment, washing machine, and water geyser.',
    appliances: [
      {
        name: '1.5 Ton 5-Star Inverter AC (Living Room)',
        category: 'Cooling',
        powerWatts: 1450,
        dailyHours: 6.5,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Double-Door Frost Free Refrigerator 340L',
        category: 'Kitchen',
        powerWatts: 180,
        dailyHours: 12.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'BLDC Ultra-Quiet Ceiling Fans',
        category: 'Cooling',
        powerWatts: 35,
        dailyHours: 14.0,
        operatingDays: 30,
        quantity: 3
      },
      {
        name: 'Instant Water Geyser 15L',
        category: 'Other',
        powerWatts: 2000,
        dailyHours: 1.5,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: '65" 4K OLED Smart TV & Surround Audio',
        category: 'Entertainment',
        powerWatts: 140,
        dailyHours: 4.5,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Architectural LED Warm Downlights (Pack of 8)',
        category: 'Lighting',
        powerWatts: 10,
        dailyHours: 6.0,
        operatingDays: 30,
        quantity: 8
      },
      {
        name: 'Executive Workstation (Laptop + Dual 4K Displays)',
        category: 'Computing',
        powerWatts: 160,
        dailyHours: 8.0,
        operatingDays: 24,
        quantity: 1
      },
      {
        name: 'Fully Automatic Front Load Washing Machine',
        category: 'Other',
        powerWatts: 450,
        dailyHours: 1.0,
        operatingDays: 20,
        quantity: 1
      }
    ]
  },
  wfh_setup: {
    id: 'wfh_setup',
    name: 'Work-from-Home Setup',
    badge: 'Professional Remote',
    description: 'High-draw home office configuration with dual 4K workstations, enterprise networking equipment, continuous climate moderation, and pantry appliances.',
    appliances: [
      {
        name: 'High-Performance Workstation PC (Dual 4K Displays)',
        category: 'Computing',
        powerWatts: 240,
        dailyHours: 9.0,
        operatingDays: 24,
        quantity: 1
      },
      {
        name: 'Gigabit Wi-Fi Router & Managed Switch',
        category: 'Computing',
        powerWatts: 25,
        dailyHours: 24.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: '1.5 Ton Inverter AC (Home Office)',
        category: 'Cooling',
        powerWatts: 1350,
        dailyHours: 7.0,
        operatingDays: 26,
        quantity: 1
      },
      {
        name: 'BLDC Variable Speed Ceiling Fan',
        category: 'Cooling',
        powerWatts: 35,
        dailyHours: 12.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Compact Direct Cool Refrigerator 210L',
        category: 'Kitchen',
        powerWatts: 130,
        dailyHours: 11.0,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Electric Kettle & Espresso Station',
        category: 'Kitchen',
        powerWatts: 1500,
        dailyHours: 0.6,
        operatingDays: 30,
        quantity: 1
      },
      {
        name: 'Ergonomic Task & Bias LED Lighting',
        category: 'Lighting',
        powerWatts: 12,
        dailyHours: 8.0,
        operatingDays: 26,
        quantity: 3
      }
    ]
  }
};

// Backward-compatible reference for curated sample appliances
const SAMPLE_APPLIANCES = SAMPLE_PRESETS.family_2bhk.appliances.map((app, idx) => ({
  id: `app_sample_${idx + 1}`,
  name: app.name,
  category: app.category,
  powerWatts: app.powerWatts,
  dailyHours: app.dailyHours,
  operatingDays: app.operatingDays,
  quantity: app.quantity,
  createdAt: Date.now() - ((7 - idx) * 100000)
}));

const WattWatchStorage = {
  activeUserId: null,
  testNamespace: null,
  corruptedState: null,
  corruptedItems: [],
  _cachedAppliances: null,
  _cachedAppliancesRaw: null,
  _cachedSettings: null,
  _cachedSettingsRaw: null,
  _cachedHistory: null,
  _cachedHistoryRaw: null,

  /**
   * Invalidates in-memory storage cache so future reads fetch fresh persisted records
   */
  invalidateCache() {
    this._cachedAppliances = null;
    this._cachedAppliancesRaw = null;
    this._cachedSettings = null;
    this._cachedSettingsRaw = null;
    this._cachedHistory = null;
    this._cachedHistoryRaw = null;
  },

  ALLOWED_CATEGORIES: ['Cooling', 'Lighting', 'Kitchen', 'Entertainment', 'Computing', 'Other'],

  /**
   * Sets a test-only storage key prefix for isolated automated testing
   * @param {string|null} prefix
   */
  setTestNamespace(prefix) {
    this.testNamespace = (typeof prefix === 'string' && prefix.trim().length > 0) ? prefix.trim() : null;
    this.invalidateCache();
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
    return this.corruptedState !== null || (Array.isArray(this.corruptedItems) && this.corruptedItems.length > 0);
  },

  /**
   * Returns list of all quarantined corrupted items
   * @returns {Array<Object>}
   */
  getCorruptedItems() {
    if (Array.isArray(this.corruptedItems) && this.corruptedItems.length > 0) {
      return [...this.corruptedItems];
    }
    return this.corruptedState ? [this.corruptedState] : [];
  },

  /**
   * Clears in-memory corrupted tracking states
   */
  clearCorruptedData() {
    this.corruptedState = null;
    this.corruptedItems = [];
    this.invalidateCache();
  },

  /**
   * Discovers and retrieves all quarantined invalid appliance backup records in localStorage
   * @returns {Array<Object>}
   */
  getInvalidApplianceBackups() {
    const key = this._getKey('APPLIANCES');
    const backups = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const lk = localStorage.key(i);
        if (lk && lk.startsWith('wattwatch_invalid_appliances_') && lk.endsWith(`_${key}`)) {
          const raw = localStorage.getItem(lk);
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (_) {}
          backups.push({
            backupKey: lk,
            targetKey: key,
            rawData: raw,
            parsedData: Array.isArray(parsed) ? parsed : null,
            count: Array.isArray(parsed) ? parsed.length : 0
          });
        }
      }
    } catch (_) {}
    return backups;
  },

  /**
   * Safely inspects and extracts quarantined records from an invalid-appliance backup
   * @param {string} backupKey
   * @returns {{ success: boolean, error?: string, backupKey?: string, totalCount?: number, validCount?: number, invalidCount?: number, validRecords?: Array, invalidRecords?: Array, rawData?: string }}
   */
  recoverInvalidAppliances(backupKey) {
    if (!backupKey || typeof backupKey !== 'string') {
      return { success: false, error: 'Backup key must be a valid string' };
    }
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) {
        return { success: false, error: `Backup key "${backupKey}" does not exist in storage` };
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { success: false, error: 'Quarantined backup data is not an array', rawData: raw };
      }
      const validItems = [];
      const invalidItems = [];
      parsed.forEach(item => {
        const val = this.validateAppliance(item);
        if (val.valid) {
          validItems.push(val.sanitized);
        } else {
          invalidItems.push({ raw: item, error: val.error });
        }
      });
      return {
        success: true,
        backupKey,
        totalCount: parsed.length,
        validCount: validItems.length,
        invalidCount: invalidItems.length,
        validRecords: validItems,
        invalidRecords: invalidItems,
        rawData: raw
      };
    } catch (e) {
      return { success: false, error: `Error recovering invalid appliances: ${e.message}` };
    }
  },

  /**
   * Safely clears a quarantined invalid-appliance backup after verification or user recovery
   * @param {string} backupKey
   * @returns {boolean}
   */
  clearInvalidApplianceBackup(backupKey) {
    if (!backupKey || typeof backupKey !== 'string') return false;
    try {
      localStorage.removeItem(backupKey);
      if (this.invalidApplianceBackup && this.invalidApplianceBackup.backupKey === backupKey) {
        this.invalidApplianceBackup = null;
      }
      return true;
    } catch (_) {
      return false;
    }
  },

  /**
   * Validates and returns a positive numeric epoch millisecond timestamp, or null if invalid
   * @param {*} val
   * @returns {number|null}
   */
  validateTimestamp(val) {
    if (val === null || val === undefined || typeof val === 'boolean') return null;
    if (typeof val === 'number') {
      return (!isNaN(val) && Number.isFinite(val) && val > 0) ? Math.floor(val) : null;
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      const parsed = new Date(val.trim()).getTime();
      return (!isNaN(parsed) && parsed > 0) ? parsed : null;
    }
    return null;
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

    // Power Rating (Watts): strictly positive finite number of at least 1 Watt up to 50,000 W
    const numWatts = Number(app.powerWatts);
    if (typeof app.powerWatts === 'boolean' || isNaN(numWatts) || !Number.isFinite(numWatts) || numWatts < 1) {
      return { valid: false, error: 'Power rating must be a positive number of at least 1 Watt' };
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

    // Optional Advanced Fields: Weekday / Weekend hours, Active days/week, Duty Cycle, Standby power
    let optWeekdayHours = undefined;
    if (app.weekdayHours !== undefined && app.weekdayHours !== null && app.weekdayHours !== '') {
      const wdh = Number(app.weekdayHours);
      if (typeof app.weekdayHours === 'boolean' || isNaN(wdh) || !Number.isFinite(wdh) || wdh < 0 || wdh > 24) {
        return { valid: false, error: 'Weekday usage hours must be between 0 and 24' };
      }
      optWeekdayHours = wdh;
    }

    let optWeekendHours = undefined;
    if (app.weekendHours !== undefined && app.weekendHours !== null && app.weekendHours !== '') {
      const weh = Number(app.weekendHours);
      if (typeof app.weekendHours === 'boolean' || isNaN(weh) || !Number.isFinite(weh) || weh < 0 || weh > 24) {
        return { valid: false, error: 'Weekend usage hours must be between 0 and 24' };
      }
      optWeekendHours = weh;
    }

    let optActiveDaysWeek = undefined;
    if (app.activeDaysPerWeek !== undefined && app.activeDaysPerWeek !== null && app.activeDaysPerWeek !== '') {
      const adw = Number(app.activeDaysPerWeek);
      if (typeof app.activeDaysPerWeek === 'boolean' || isNaN(adw) || !Number.isFinite(adw) || !Number.isInteger(adw) || adw < 1 || adw > 7) {
        return { valid: false, error: 'Active days per week must be an integer between 1 and 7' };
      }
      optActiveDaysWeek = adw;
    }

    let optDutyCycle = undefined;
    if (app.dutyCyclePercent !== undefined && app.dutyCyclePercent !== null && app.dutyCyclePercent !== '') {
      const dc = Number(app.dutyCyclePercent);
      if (typeof app.dutyCyclePercent === 'boolean' || isNaN(dc) || !Number.isFinite(dc) || dc <= 0 || dc > 100) {
        return { valid: false, error: 'Duty cycle must be between 1% and 100%' };
      }
      optDutyCycle = dc;
    }

    let optStandbyWatts = undefined;
    if (app.standbyWatts !== undefined && app.standbyWatts !== null && app.standbyWatts !== '') {
      const sbw = Number(app.standbyWatts);
      if (typeof app.standbyWatts === 'boolean' || isNaN(sbw) || !Number.isFinite(sbw) || sbw < 0 || sbw > 500) {
        return { valid: false, error: 'Standby power must be between 0 and 500 Watts' };
      }
      optStandbyWatts = sbw;
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

    // Attach validated optional advanced profile fields if provided
    if (optWeekdayHours !== undefined) sanitized.weekdayHours = optWeekdayHours;
    if (optWeekendHours !== undefined) sanitized.weekendHours = optWeekendHours;
    if (optActiveDaysWeek !== undefined) sanitized.activeDaysPerWeek = optActiveDaysWeek;
    if (optDutyCycle !== undefined) sanitized.dutyCyclePercent = optDutyCycle;
    if (optStandbyWatts !== undefined) sanitized.standbyWatts = optStandbyWatts;

    // Preserve optional calculation metrics if present (e.g. from historical snapshots)
    const metricFields = ['monthlyCost', 'monthlyKwh', 'dailyCost', 'dailyKwh', 'sharePercentage'];
    for (const mf of metricFields) {
      if (app[mf] !== undefined && app[mf] !== null && app[mf] !== '') {
        const val = Number(app[mf]);
        if (typeof app[mf] === 'boolean' || isNaN(val) || !Number.isFinite(val) || val < 0) {
          return { valid: false, error: `Appliance ${mf} must be a non-negative finite number` };
        }
        sanitized[mf] = val;
      }
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
    this.invalidateCache();
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
      const validApps = Array.isArray(apps) ? apps.filter(a => this.validateAppliance(a).valid) : [];
      const validHist = Array.isArray(hist) ? hist.filter(h => this.validateSnapshot(h).valid) : [];
      const appCount = validApps.length;
      const histCount = validHist.length;
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
          if (newSnap.createdAt !== undefined && newSnap.createdAt !== null) {
            newSnap.createdAt = this.validateTimestamp(newSnap.createdAt) || Date.now();
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
      if ((!userSettings || Object.keys(userSettings).length === 0) && guestSettings && typeof guestSettings === 'object' && !Array.isArray(guestSettings)) {
        let isGuestSettingsValid = true;
        const candidateSettings = { ...guestSettings };

        const nonNegFields = ['electricityRate', 'budgetInr', 'fixedCharges', 'freeUnits', 'billCreditInr'];
        for (const f of nonNegFields) {
          if (candidateSettings[f] !== undefined) {
            const v = Number(candidateSettings[f]);
            if (typeof candidateSettings[f] === 'boolean' || isNaN(v) || v < 0 || !Number.isFinite(v)) {
              console.warn(`[WattWatch Storage] Refusing to migrate invalid guest setting "${f}":`, candidateSettings[f]);
              isGuestSettingsValid = false;
              break;
            }
            candidateSettings[f] = v;
          }
        }

        if (isGuestSettingsValid && candidateSettings.additionalTaxPercent !== undefined) {
          const tax = Number(candidateSettings.additionalTaxPercent);
          if (typeof candidateSettings.additionalTaxPercent === 'boolean' || isNaN(tax) || tax < 0 || tax > 100 || !Number.isFinite(tax)) {
            console.warn('[WattWatch Storage] Refusing to migrate invalid guest additionalTaxPercent:', candidateSettings.additionalTaxPercent);
            isGuestSettingsValid = false;
          } else {
            candidateSettings.additionalTaxPercent = tax;
          }
        }

        if (isGuestSettingsValid && candidateSettings.carbonEmissionFactor !== undefined && candidateSettings.carbonEmissionFactor !== null) {
          const cf = Number(candidateSettings.carbonEmissionFactor);
          if (typeof candidateSettings.carbonEmissionFactor === 'boolean' || isNaN(cf) || cf < 0 || !Number.isFinite(cf)) {
            console.warn('[WattWatch Storage] Refusing to migrate invalid guest carbonEmissionFactor:', candidateSettings.carbonEmissionFactor);
            isGuestSettingsValid = false;
          } else {
            candidateSettings.carbonEmissionFactor = cf;
          }
        }

        if (isGuestSettingsValid && candidateSettings.billingDays !== undefined) {
          const bd = Number(candidateSettings.billingDays);
          if (typeof candidateSettings.billingDays === 'boolean' || isNaN(bd) || !Number.isFinite(bd) || bd <= 0) {
            console.warn('[WattWatch Storage] Refusing to migrate invalid guest billingDays:', candidateSettings.billingDays);
            isGuestSettingsValid = false;
          } else {
            candidateSettings.billingDays = bd;
          }
        }

        if (isGuestSettingsValid && candidateSettings.tariffModel !== undefined && candidateSettings.tariffModel !== 'flat' && candidateSettings.tariffModel !== 'slab') {
          console.warn('[WattWatch Storage] Refusing to migrate invalid guest tariffModel:', candidateSettings.tariffModel);
          isGuestSettingsValid = false;
        }

        if (isGuestSettingsValid && (candidateSettings.tariffModel === 'slab' || Array.isArray(candidateSettings.slabConfig))) {
          if (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.validateSlabConfig === 'function') {
            const valSlab = WattWatchCalculations.validateSlabConfig(candidateSettings.slabConfig, { requireOpenEnded: true });
            if (!valSlab.valid) {
              console.warn('[WattWatch Storage] Refusing to migrate invalid guest slab configuration:', valSlab.error);
              isGuestSettingsValid = false;
            } else {
              candidateSettings.slabConfig = valSlab.sanitized;
            }
          } else {
            console.warn('[WattWatch Storage] Refusing to migrate guest slab configuration: WattWatchCalculations.validateSlabConfig is unavailable');
            isGuestSettingsValid = false;
          }
        }

        if (isGuestSettingsValid) {
          mergedSettings = candidateSettings;
          importedSettings = true;
        } else {
          console.warn('[WattWatch Storage] Guest settings contained invalid parameters; skipping settings migration');
          mergedSettings = null;
          importedSettings = false;
        }
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

      if (this.activeUserId === uid) {
        this.invalidateCache();
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
   * Migrates guest data to a user account, validating settings and schemas
   * @param {string} uid
   * @param {Object} [options]
   * @returns {Object}
   */
  migrateGuestDataToUser(uid, options = {}) {
    return this.migrateGuestData(uid, options);
  },

  /**
   * Retrieves saved appliances from localStorage with safety validation and corrupted data preservation
   * @returns {Array} List of validated appliance objects
   */
  getAppliances() {
    const key = this._getKey('APPLIANCES');
    try {
      const data = localStorage.getItem(key);
      if (data === this._cachedAppliancesRaw && this._cachedAppliances !== null) {
        return this._cachedAppliances.map(a => ({ ...a }));
      }
      if (!data) {
        this._cachedAppliances = [];
        this._cachedAppliancesRaw = data;
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        throw new Error('Stored appliances payload is not an array');
      }
      const validated = [];
      const invalidRecords = [];
      for (const item of parsed) {
        const v = this.validateAppliance(item);
        if (v.valid) {
          validated.push(v.sanitized);
        } else {
          invalidRecords.push(item);
          console.warn('[WattWatch Storage] Skipping invalid stored appliance record:', v.error, item);
        }
      }

      // Preserve the complete original payload before any later save can replace it.
      if (invalidRecords.length > 0) {
        let existingBackupKey = null;

        // 1. Verify in-memory reference against actual storage if present
        if (this.invalidApplianceBackup && this.invalidApplianceBackup.key === key) {
          try {
            if (localStorage.getItem(this.invalidApplianceBackup.backupKey) === data) {
              existingBackupKey = this.invalidApplianceBackup.backupKey;
            }
          } catch (_) {}
        }

        // 2. If not verified from memory, inspect localStorage keys for an existing valid backup of this payload
        if (!existingBackupKey) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const lk = localStorage.key(i);
              if (lk && lk.startsWith('wattwatch_invalid_appliances_') && lk.endsWith(`_${key}`)) {
                if (localStorage.getItem(lk) === data) {
                  existingBackupKey = lk;
                  break;
                }
              }
            }
          } catch (_) {}
        }

        if (existingBackupKey) {
          this.invalidApplianceBackup = {
            key,
            backupKey: existingBackupKey,
            count: invalidRecords.length,
            timestamp: Date.now(),
            sourceData: data
          };
          this._appliancePreservationBlocked = false;
        } else {
          const backupKey = `wattwatch_invalid_appliances_${Date.now()}_${key}`;
          try {
            localStorage.setItem(backupKey, data);
            if (localStorage.getItem(backupKey) === data) {
              this.invalidApplianceBackup = {
                key,
                backupKey,
                count: invalidRecords.length,
                timestamp: Date.now(),
                sourceData: data
              };
              this._appliancePreservationBlocked = false;
              console.warn(`[WattWatch Storage] Preserved ${invalidRecords.length} invalid appliance record(s) in "${backupKey}".`);
            } else {
              this._appliancePreservationBlocked = true;
              console.error('[WattWatch Storage] Backup verification failed for invalid appliances; writes are blocked.');
            }
          } catch (backupError) {
            this._appliancePreservationBlocked = true;
            console.error('[WattWatch Storage] Could not preserve invalid appliance records; writes are blocked to prevent data loss.', backupError);
          }
        }
      } else {
        this._appliancePreservationBlocked = false;
      }
      this._cachedAppliances = validated;
      this._cachedAppliancesRaw = data;
      return validated.map(a => ({ ...a }));
    } catch (e) {
      this.invalidateCache();
      console.error('[WattWatch Storage] Error reading appliances:', e);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
          localStorage.setItem(backupKey, raw);
          const item = { key, backupKey, timestamp: Date.now() };
          this.corruptedState = item;
          if (!Array.isArray(this.corruptedItems)) this.corruptedItems = [];
          this.corruptedItems.push(item);
          console.warn(`[WattWatch Storage] Preserved raw corrupted appliances data in "${backupKey}".`);
        }
      } catch (bErr) { /* ignore storage access or quota errors */ }
      return [];
    }
  },

  /**
   * Checks whether localStorage is supported and accessible in the current browser session.
   * @returns {boolean}
   */
  isStorageAvailable() {
    try {
      const testKey = '__wattwatch_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (_) {
      return false;
    }
  },

  /**
   * Detects if an error was caused by local storage quota exhaustion
   * @param {*} e
   * @returns {boolean}
   */
  isQuotaExceeded(e) {
    return e && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    );
  },

  /**
   * Detects if an error was caused by browser security/privacy storage restrictions
   * @param {*} e
   * @returns {boolean}
   */
  isStorageRestricted(e) {
    return e && (
      e.name === 'SecurityError' ||
      e.code === 18
    );
  },

  /**
   * Dispatches a clear non-blocking alert when local persistence fails due to quota or restriction
   * @param {*} e
   * @param {string} context
   */
  handleStorageError(e, context = 'Data') {
    if (this.isQuotaExceeded(e)) {
      this.notifyStorageUnavailable(`Browser storage quota exceeded. Unable to save ${context}. Please free browser storage or export and trim your snapshots.`);
    } else if (this.isStorageRestricted(e)) {
      this.notifyStorageUnavailable(`Browser storage is restricted or disabled. ${context} cannot be persisted across sessions.`);
    }
  },

  /**
   * Dispatches non-blocking user notice
   * @param {string} msg
   */
  notifyStorageUnavailable(msg) {
    if (typeof WattWatchApp !== 'undefined' && typeof WattWatchApp.showToast === 'function') {
      WattWatchApp.showToast(msg, 'warning', 'Storage Notice');
    } else {
      console.warn('[WattWatch Storage]', msg);
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
      if (this._appliancePreservationBlocked) {
        console.error('[WattWatch Storage] Refusing to overwrite appliance data because invalid records could not be backed up.');
        return false;
      }
      const sanitized = appliances.map(item => {
        const val = this.validateAppliance(item);
        return val.valid ? val.sanitized : item;
      });
      localStorage.setItem(this._getKey('APPLIANCES'), JSON.stringify(sanitized));
      this.invalidateCache();
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving appliances:', e);
      this.handleStorageError(e, 'Appliances');
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
      if (data === this._cachedSettingsRaw && this._cachedSettings !== null) {
        return { ...this._cachedSettings };
      }
      if (!data) {
        this._cachedSettings = { ...DEFAULT_SETTINGS };
        this._cachedSettingsRaw = data;
        return { ...DEFAULT_SETTINGS };
      }
      const parsed = JSON.parse(data);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Stored settings payload is not a valid object');
      }
      this._cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      this._cachedSettingsRaw = data;
      return { ...this._cachedSettings };
    } catch (e) {
      this.invalidateCache();
      console.error('[WattWatch Storage] Error reading settings:', e);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
          localStorage.setItem(backupKey, raw);
          const item = { key, backupKey, timestamp: Date.now() };
          this.corruptedState = item;
          if (!Array.isArray(this.corruptedItems)) this.corruptedItems = [];
          this.corruptedItems.push(item);
          console.warn(`[WattWatch Storage] Preserved raw corrupted settings data in "${backupKey}".`);
        }
      } catch (bErr) { /* ignore storage access or quota errors */ }
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
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        console.warn('[WattWatch Storage] Refusing to persist non-object settings payload:', settings);
        return false;
      }
      const current = this.getSettings();
      const merged = { ...current, ...settings };

      // Explicit validation to reject negative, NaN, or non-finite values
      if (settings.electricityRate !== undefined) {
        const er = Number(settings.electricityRate);
        if (typeof settings.electricityRate === 'boolean' || isNaN(er) || er < 0 || !Number.isFinite(er)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid electricityRate:', settings.electricityRate);
          return false;
        }
        merged.electricityRate = er;
      }

      if (settings.budgetInr !== undefined) {
        const b = Number(settings.budgetInr);
        if (typeof settings.budgetInr === 'boolean' || isNaN(b) || b < 0 || !Number.isFinite(b)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid budgetInr:', settings.budgetInr);
          return false;
        }
        merged.budgetInr = b;
      }

      if (settings.carbonEmissionFactor !== undefined && settings.carbonEmissionFactor !== null) {
        const cf = Number(settings.carbonEmissionFactor);
        if (typeof settings.carbonEmissionFactor === 'boolean' || isNaN(cf) || cf < 0 || !Number.isFinite(cf)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid carbonEmissionFactor:', settings.carbonEmissionFactor);
          return false;
        }
        merged.carbonEmissionFactor = cf;
      } else if (settings.carbonEmissionFactor === null) {
        merged.carbonEmissionFactor = null;
      }

      if (settings.fixedCharges !== undefined) {
        const fc = Number(settings.fixedCharges);
        if (typeof settings.fixedCharges === 'boolean' || isNaN(fc) || fc < 0 || !Number.isFinite(fc)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid fixedCharges:', settings.fixedCharges);
          return false;
        }
        merged.fixedCharges = fc;
      }

      if (settings.additionalTaxPercent !== undefined) {
        const tax = Number(settings.additionalTaxPercent);
        if (typeof settings.additionalTaxPercent === 'boolean' || isNaN(tax) || tax < 0 || tax > 100 || !Number.isFinite(tax)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid additionalTaxPercent:', settings.additionalTaxPercent);
          return false;
        }
        merged.additionalTaxPercent = tax;
      }

      if (settings.freeUnits !== undefined) {
        const fu = Number(settings.freeUnits);
        if (typeof settings.freeUnits === 'boolean' || isNaN(fu) || fu < 0 || !Number.isFinite(fu)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid freeUnits:', settings.freeUnits);
          return false;
        }
        merged.freeUnits = fu;
      }

      if (settings.billCreditInr !== undefined) {
        const bc = Number(settings.billCreditInr);
        if (typeof settings.billCreditInr === 'boolean' || isNaN(bc) || bc < 0 || !Number.isFinite(bc)) {
          console.warn('[WattWatch Storage] Refusing to persist invalid billCreditInr:', settings.billCreditInr);
          return false;
        }
        merged.billCreditInr = bc;
      }

      if (settings.billingDays !== undefined) {
        const bd = Number(settings.billingDays);
        if (typeof settings.billingDays === 'boolean' || isNaN(bd) || !Number.isFinite(bd) || bd <= 0) {
          console.warn('[WattWatch Storage] Refusing to persist invalid billingDays:', settings.billingDays);
          return false;
        }
        merged.billingDays = bd;
      }

      if (merged.tariffModel === 'slab') {
        if (typeof WattWatchCalculations === 'undefined' || typeof WattWatchCalculations.validateSlabConfig !== 'function') {
          console.warn('[WattWatch Storage] Refusing to persist slab configuration: WattWatchCalculations.validateSlabConfig is unavailable');
          return false;
        }
        const valSlab = WattWatchCalculations.validateSlabConfig(merged.slabConfig, { requireOpenEnded: true });
        if (!valSlab.valid) {
          console.warn('[WattWatch Storage] Refusing to persist invalid slab configuration:', valSlab.error);
          return false;
        }
        merged.slabConfig = valSlab.sanitized;
      }

      localStorage.setItem(this._getKey('SETTINGS'), JSON.stringify(merged));
      this.invalidateCache();
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving settings:', e);
      this.handleStorageError(e, 'Settings');
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
      this.handleStorageError(e, 'Theme');
    }
  },

  /**
   * Retrieves historical bill snapshots with safety validation and corrupted data preservation
   * @returns {Array} List of snapshot objects
   */
  getHistory() {
    const key = this._getKey('HISTORY');
    const cloneSnapshotItem = (h) => ({
      ...h,
      tariffBreakdown: (h.tariffBreakdown && typeof h.tariffBreakdown === 'object')
        ? JSON.parse(JSON.stringify(h.tariffBreakdown))
        : h.tariffBreakdown,
      appliancesSnapshot: Array.isArray(h.appliancesSnapshot)
        ? h.appliancesSnapshot.map(a => ({ ...a }))
        : []
    });
    try {
      const data = localStorage.getItem(key);
      if (data === this._cachedHistoryRaw && this._cachedHistory !== null) {
        return this._cachedHistory.map(cloneSnapshotItem);
      }
      if (!data) {
        this._cachedHistory = [];
        this._cachedHistoryRaw = data;
        return [];
      }
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
            notes: typeof snap.notes === 'string' ? snap.notes : '',
            actualKwh: (snap.actualKwh !== undefined && snap.actualKwh !== null && !isNaN(Number(snap.actualKwh))) ? Number(snap.actualKwh) : null,
            actualCost: (snap.actualCost !== undefined && snap.actualCost !== null && !isNaN(Number(snap.actualCost))) ? Number(snap.actualCost) : null,
            cycleStartDate: typeof snap.cycleStartDate === 'string' ? snap.cycleStartDate : null,
            cycleEndDate: typeof snap.cycleEndDate === 'string' ? snap.cycleEndDate : null,
            meterReadingStart: (snap.meterReadingStart !== undefined && snap.meterReadingStart !== null && !isNaN(Number(snap.meterReadingStart))) ? Number(snap.meterReadingStart) : null,
            meterReadingEnd: (snap.meterReadingEnd !== undefined && snap.meterReadingEnd !== null && !isNaN(Number(snap.meterReadingEnd))) ? Number(snap.meterReadingEnd) : null
          });
        } else {
          console.warn('[WattWatch Storage] Skipping invalid stored snapshot record:', v.error, snap);
        }
      }
      this._cachedHistory = validated;
      this._cachedHistoryRaw = data;
      return validated.map(cloneSnapshotItem);
    } catch (e) {
      this.invalidateCache();
      console.error('[WattWatch Storage] Error reading history:', e);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const backupKey = `wattwatch_corrupted_${Date.now()}_${key}`;
          localStorage.setItem(backupKey, raw);
          const item = { key, backupKey, timestamp: Date.now() };
          this.corruptedState = item;
          if (!Array.isArray(this.corruptedItems)) this.corruptedItems = [];
          this.corruptedItems.push(item);
          console.warn(`[WattWatch Storage] Preserved raw corrupted history data in "${backupKey}".`);
        }
      } catch (bErr) { /* ignore storage access or quota errors */ }
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
      this.invalidateCache();
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving history:', e);
      this.handleStorageError(e, 'History');
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
    if (snapshot.actualKwh !== undefined && snapshot.actualKwh !== null && snapshot.actualKwh !== '' && !isStrictFiniteNonNegative(snapshot.actualKwh)) {
      return { valid: false, error: 'Snapshot actualKwh must be a non-negative finite number' };
    }
    if (snapshot.actualCost !== undefined && snapshot.actualCost !== null && snapshot.actualCost !== '' && !isStrictFiniteNonNegative(snapshot.actualCost)) {
      return { valid: false, error: 'Snapshot actualCost must be a non-negative finite number' };
    }
    if (snapshot.meterReadingStart !== undefined && snapshot.meterReadingStart !== null && snapshot.meterReadingStart !== '' && !isStrictFiniteNonNegative(snapshot.meterReadingStart)) {
      return { valid: false, error: 'Snapshot meterReadingStart must be a non-negative finite number' };
    }
    if (snapshot.meterReadingEnd !== undefined && snapshot.meterReadingEnd !== null && snapshot.meterReadingEnd !== '' && !isStrictFiniteNonNegative(snapshot.meterReadingEnd)) {
      return { valid: false, error: 'Snapshot meterReadingEnd must be a non-negative finite number' };
    }

    const hasMeterStart = snapshot.meterReadingStart !== undefined && snapshot.meterReadingStart !== null && snapshot.meterReadingStart !== '';
    const hasMeterEnd = snapshot.meterReadingEnd !== undefined && snapshot.meterReadingEnd !== null && snapshot.meterReadingEnd !== '';
    if (hasMeterStart && hasMeterEnd) {
      if (Number(snapshot.meterReadingEnd) < Number(snapshot.meterReadingStart)) {
        return { valid: false, error: 'Meter end reading cannot be less than start reading' };
      }
    }

    if (snapshot.cycleStartDate !== undefined && snapshot.cycleStartDate !== null && snapshot.cycleStartDate !== '' &&
        snapshot.cycleEndDate !== undefined && snapshot.cycleEndDate !== null && snapshot.cycleEndDate !== '') {
      if (String(snapshot.cycleEndDate).trim() < String(snapshot.cycleStartDate).trim()) {
        return { valid: false, error: 'Cycle end date cannot be earlier than cycle start date' };
      }
    }

    let sanitizedCreatedAt = Date.now();
    if (snapshot.createdAt !== undefined) {
      if (snapshot.createdAt === null) {
        sanitizedCreatedAt = null;
      } else if (typeof snapshot.createdAt === 'boolean') {
        return { valid: false, error: 'Snapshot createdAt cannot be boolean' };
      } else if (typeof snapshot.createdAt === 'number') {
        if (isNaN(snapshot.createdAt) || !Number.isFinite(snapshot.createdAt) || snapshot.createdAt <= 0) {
          return { valid: false, error: 'Snapshot createdAt must be a positive finite number' };
        }
        sanitizedCreatedAt = Math.floor(snapshot.createdAt);
      } else if (typeof snapshot.createdAt === 'string') {
        const validTime = this.validateTimestamp(snapshot.createdAt);
        sanitizedCreatedAt = validTime !== null ? validTime : null;
      } else {
        return { valid: false, error: 'Snapshot createdAt has invalid type' };
      }
    }

    const sanitized = {
      id: (typeof snapshot.id === 'string' && snapshot.id.trim() && /^[a-zA-Z0-9_\-]+$/.test(snapshot.id.trim()))
        ? snapshot.id.trim()
        : `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      period: snapshot.period.trim(),
      periodLabel: (typeof snapshot.periodLabel === 'string' && snapshot.periodLabel.trim())
        ? snapshot.periodLabel.trim()
        : snapshot.period.trim(),
      totalKwh: Number(snapshot.totalKwh),
      totalCost: Number(snapshot.totalCost),
      createdAt: sanitizedCreatedAt
    };

    if (snapshot.effectiveRate !== undefined && snapshot.effectiveRate !== null && snapshot.effectiveRate !== '') {
      sanitized.effectiveRate = Number(snapshot.effectiveRate);
    }
    if (snapshot.electricityRate !== undefined && snapshot.electricityRate !== null && snapshot.electricityRate !== '') {
      sanitized.electricityRate = Number(snapshot.electricityRate);
    }
    if (snapshot.flatRate !== undefined && snapshot.flatRate !== null && snapshot.flatRate !== '') {
      sanitized.flatRate = Number(snapshot.flatRate);
    }
    if (snapshot.appliancesCount !== undefined && snapshot.appliancesCount !== null && snapshot.appliancesCount !== '') {
      sanitized.appliancesCount = Number(snapshot.appliancesCount);
    }
    if (snapshot.totalUnits !== undefined && snapshot.totalUnits !== null && snapshot.totalUnits !== '') {
      sanitized.totalUnits = Number(snapshot.totalUnits);
    }
    if (snapshot.energyCharges !== undefined && snapshot.energyCharges !== null && snapshot.energyCharges !== '') {
      sanitized.energyCharges = Number(snapshot.energyCharges);
    }
    if (snapshot.fixedCharges !== undefined && snapshot.fixedCharges !== null && snapshot.fixedCharges !== '') {
      sanitized.fixedCharges = Number(snapshot.fixedCharges);
    }
    if (snapshot.taxCharges !== undefined && snapshot.taxCharges !== null && snapshot.taxCharges !== '') {
      sanitized.taxCharges = Number(snapshot.taxCharges);
    }
    if (snapshot.tariffModel === 'slab' || snapshot.tariffModel === 'flat') {
      sanitized.tariffModel = snapshot.tariffModel;
    }
    if (snapshot.tariffBreakdown && typeof snapshot.tariffBreakdown === 'object') {
      sanitized.tariffBreakdown = snapshot.tariffBreakdown;
    }
    if (Array.isArray(snapshot.appliancesSnapshot)) {
      sanitized.appliancesSnapshot = snapshot.appliancesSnapshot
        .map(a => this.validateAppliance(a))
        .filter(v => v.valid)
        .map(v => v.sanitized);
      if (sanitized.appliancesCount === undefined) {
        sanitized.appliancesCount = sanitized.appliancesSnapshot.length;
      }
      if (sanitized.totalUnits === undefined) {
        sanitized.totalUnits = sanitized.appliancesSnapshot.reduce((acc, a) => acc + (a.quantity || 1), 0);
      }
    }
    if (typeof snapshot.notes === 'string') {
      sanitized.notes = snapshot.notes.slice(0, 500);
    }
    if (snapshot.actualKwh !== undefined && snapshot.actualKwh !== null && snapshot.actualKwh !== '') {
      sanitized.actualKwh = Number(snapshot.actualKwh);
    }
    if (snapshot.actualCost !== undefined && snapshot.actualCost !== null && snapshot.actualCost !== '') {
      sanitized.actualCost = Number(snapshot.actualCost);
    }
    if (snapshot.cycleStartDate !== undefined && snapshot.cycleStartDate !== null && snapshot.cycleStartDate !== '') {
      sanitized.cycleStartDate = String(snapshot.cycleStartDate).trim();
    }
    if (snapshot.cycleEndDate !== undefined && snapshot.cycleEndDate !== null && snapshot.cycleEndDate !== '') {
      sanitized.cycleEndDate = String(snapshot.cycleEndDate).trim();
    }
    if (hasMeterStart) {
      sanitized.meterReadingStart = Number(snapshot.meterReadingStart);
    }
    if (hasMeterEnd) {
      sanitized.meterReadingEnd = Number(snapshot.meterReadingEnd);
    }
    if (snapshot.updatedAt !== undefined && typeof snapshot.updatedAt === 'number') {
      sanitized.updatedAt = snapshot.updatedAt;
    }

    return { valid: true, sanitized };
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
    const index = history.findIndex(h => h.period === val.sanitized.period);
    if (index !== -1) {
      const mergedCandidate = {
        ...history[index],
        ...val.sanitized,
        updatedAt: Date.now()
      };
      const reval = this.validateSnapshot(mergedCandidate);
      if (!reval.valid) {
        console.warn('[WattWatch Storage] Refusing to update snapshot resulting in invalid state:', reval.error);
        return false;
      }
      history[index] = reval.sanitized;
    } else {
      history.push(val.sanitized);
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
   * Retrieves available sample household presets metadata
   * @returns {Array<{ id: string, name: string, badge: string, description: string, applianceCount: number, totalUnits: number, estimatedMonthlyKwh: number }>}
   */
  getSamplePresets() {
    return Object.keys(SAMPLE_PRESETS).map(key => {
      const p = SAMPLE_PRESETS[key];
      const appCount = p.appliances.length;
      const totalUnits = p.appliances.reduce((sum, a) => sum + (a.quantity || 1), 0);
      let estKwh = 0;
      p.appliances.forEach(a => {
        const kwh = WattWatchCalculations.calculateMonthlyKwh(a.powerWatts, a.quantity || 1, a.dailyHours, a.operatingDays);
        if (!isNaN(kwh) && kwh >= 0) estKwh += kwh;
      });
      return {
        id: p.id,
        name: p.name,
        badge: p.badge,
        description: p.description,
        applianceCount: appCount,
        totalUnits,
        estimatedMonthlyKwh: estKwh
      };
    });
  },

  /**
   * Loads sample appliances from a selected preset into storage.
   * Defaults to 'family_2bhk' for complete backward compatibility.
   * Preserves settings and historical billing snapshots intact.
   * @param {string} [presetKey='family_2bhk'] - 'studio_1bhk' | 'family_2bhk' | 'wfh_setup'
   * @returns {Array} Loaded sample appliances
   */
  loadSampleHousehold(presetKey = 'family_2bhk') {
    const safeKey = (typeof presetKey === 'string' && SAMPLE_PRESETS[presetKey]) ? presetKey : 'family_2bhk';
    const preset = SAMPLE_PRESETS[safeKey] || SAMPLE_PRESETS.family_2bhk;
    const now = Date.now();
    const samples = preset.appliances.map((app, idx) => ({
      id: `app_sample_${safeKey}_${idx + 1}`,
      name: app.name,
      category: app.category,
      powerWatts: app.powerWatts,
      dailyHours: app.dailyHours,
      operatingDays: app.operatingDays,
      quantity: app.quantity,
      createdAt: now - ((preset.appliances.length - idx) * 50000)
    }));
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
      backupVersion: '2.0',
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      generator: 'WattWatch Energy Analytics',
      accountType: this.activeUserId ? 'authenticated' : 'guest',
      settings: currentSettings,
      appliances: this.getAppliances(),
      history: this.getHistory(),
      meterTracking: this.getMeterTracking() || null
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
      if (typeof jsonString !== 'string' || !jsonString.trim()) {
        return { success: false, error: 'JSON payload is empty or invalid' };
      }

      if (jsonString.length > 5 * 1024 * 1024) {
        return { success: false, error: 'Backup data exceeds maximum allowed size (5 MB)' };
      }

      let parsed = null;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseErr) {
        return { success: false, error: 'Invalid JSON format: ' + parseErr.message };
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, error: 'Invalid backup structure: root must be a JSON object' };
      }

      // Check version support
      const ver = parsed.backupVersion || parsed.version;
      if (ver !== undefined && ver !== null && ver !== '1.0' && ver !== '2.0') {
        return { success: false, error: `Unsupported backup version: ${ver}` };
      }

      // Check account type isolation (Guest vs Authenticated User)
      const currentAccountType = this.activeUserId ? 'authenticated' : 'guest';
      const backupAccountType = parsed.accountType;
      if (backupAccountType !== undefined && backupAccountType !== null) {
        if (backupAccountType === 'guest' && currentAccountType === 'authenticated') {
          return {
            success: false,
            error: 'Account type mismatch: cannot import a Guest backup into an Authenticated account. Please sign out to import guest data.'
          };
        }
        if (backupAccountType === 'authenticated' && currentAccountType === 'guest') {
          return {
            success: false,
            error: 'Account type mismatch: cannot import an Authenticated account backup into Guest mode. Please sign in to import account data.'
          };
        }
        if (backupAccountType !== 'guest' && backupAccountType !== 'authenticated') {
          return {
            success: false,
            error: `Invalid account type in backup: "${backupAccountType}". Expected "guest" or "authenticated".`
          };
        }
      }

      if (!Array.isArray(parsed.appliances)) {
        return { success: false, error: 'File missing "appliances" list' };
      }

      if (parsed.appliances.length > 500) {
        return { success: false, error: 'Backup contains too many appliances (max 500 allowed)' };
      }

      if (Array.isArray(parsed.history) && parsed.history.length > 200) {
        return { success: false, error: 'Backup contains too many history snapshots (max 200 allowed)' };
      }

      // Strip sensitive credentials/tokens
      parsed = this.sanitizeImportPayload(parsed);

      const mode = (options === 'replace' || (options && options.mode === 'replace')) ? 'replace' : 'merge';

      let finalAppliances = [];
      let finalHistory = [];
      let importedAppsCount = 0;
      let skippedAppsCount = 0;
      let importedHistCount = 0;
      let skippedHistCount = 0;

      // Validate each appliance schema
      const validAppliances = [];
      let firstApplianceError = null;
      for (const item of parsed.appliances) {
        const v = this.validateAppliance(item);
        if (!v.valid) {
          if (!firstApplianceError) firstApplianceError = v.error;
          if (mode === 'replace') {
            return {
              success: false,
              error: `Backup contains invalid appliance record: ${v.error}`
            };
          }
          skippedAppsCount++;
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
          const snapToValidate = { ...snap };
          if (typeof snapToValidate.createdAt === 'string' && this.validateTimestamp(snapToValidate.createdAt) === null) {
            snapToValidate.createdAt = null;
          }
          const valSnap = this.validateSnapshot(snapToValidate);
          if (!valSnap.valid) {
            skippedHistCount++;
            continue;
          }
          validHistory.push(valSnap.sanitized);
        }
      }

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

      // Validate meter tracking if present in imported payload
      let validatedMeterTracking = null;
      if (parsed.meterTracking !== undefined && parsed.meterTracking !== null) {
        if (typeof parsed.meterTracking !== 'object' || Array.isArray(parsed.meterTracking)) {
          return { success: false, error: 'Invalid meter tracking data: root meterTracking must be a JSON object' };
        }
        const valMeter = this.validateMeterTracking(parsed.meterTracking);
        if (!valMeter.valid) {
          return { success: false, error: `Invalid meter tracking data: ${valMeter.error}` };
        }
        validatedMeterTracking = valMeter.sanitized;
      }

      // Snapshot existing appliances, history, settings, theme, and meter tracking before writing
      const appKey = this._getKey('APPLIANCES');
      const histKey = this._getKey('HISTORY');
      const settKey = this._getKey('SETTINGS');
      const themeKey = this._getKey('THEME');
      const meterKey = this._getKey('METER');

      const storageSnapshot = {
        appliances: localStorage.getItem(appKey),
        history: localStorage.getItem(histKey),
        settings: localStorage.getItem(settKey),
        theme: localStorage.getItem(themeKey),
        meter: localStorage.getItem(meterKey)
      };

      // Prepare merged or replaced settings
      let newSettings = null;
      let settingsWarning = null;
      if (parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)) {
        const currentSettings = this.getSettings();
        newSettings = mode === 'replace' ? { ...DEFAULT_SETTINGS } : { ...currentSettings };

        if (parsed.settings.electricityRate !== undefined) {
          const er = Number(parsed.settings.electricityRate);
          if (typeof parsed.settings.electricityRate === 'boolean' || isNaN(er) || !Number.isFinite(er) || er < 0) {
            return { success: false, error: `Invalid electricityRate in backup settings: ${parsed.settings.electricityRate}` };
          }
          newSettings.electricityRate = er;
        }

        if (parsed.settings.budgetInr !== undefined) {
          const b = Number(parsed.settings.budgetInr);
          if (typeof parsed.settings.budgetInr === 'boolean' || isNaN(b) || !Number.isFinite(b) || b < 0) {
            return { success: false, error: `Invalid budgetInr in backup settings: ${parsed.settings.budgetInr}` };
          }
          newSettings.budgetInr = b;
        }

        if (parsed.settings.fixedCharges !== undefined) {
          const fc = Number(parsed.settings.fixedCharges);
          if (typeof parsed.settings.fixedCharges === 'boolean' || isNaN(fc) || !Number.isFinite(fc) || fc < 0) {
            return { success: false, error: `Invalid fixedCharges in backup settings: ${parsed.settings.fixedCharges}` };
          }
          newSettings.fixedCharges = fc;
        }

        if (parsed.settings.additionalTaxPercent !== undefined) {
          const tax = Number(parsed.settings.additionalTaxPercent);
          if (typeof parsed.settings.additionalTaxPercent === 'boolean' || isNaN(tax) || !Number.isFinite(tax) || tax < 0 || tax > 100) {
            return { success: false, error: `Invalid additionalTaxPercent in backup settings: ${parsed.settings.additionalTaxPercent}` };
          }
          newSettings.additionalTaxPercent = tax;
        }

        if (parsed.settings.freeUnits !== undefined) {
          const fu = Number(parsed.settings.freeUnits);
          if (typeof parsed.settings.freeUnits === 'boolean' || isNaN(fu) || !Number.isFinite(fu) || fu < 0) {
            return { success: false, error: `Invalid freeUnits in backup settings: ${parsed.settings.freeUnits}` };
          }
          newSettings.freeUnits = fu;
        }

        if (parsed.settings.billCreditInr !== undefined) {
          const bc = Number(parsed.settings.billCreditInr);
          if (typeof parsed.settings.billCreditInr === 'boolean' || isNaN(bc) || !Number.isFinite(bc) || bc < 0) {
            return { success: false, error: `Invalid billCreditInr in backup settings: ${parsed.settings.billCreditInr}` };
          }
          newSettings.billCreditInr = bc;
        }

        if (parsed.settings.carbonEmissionFactor !== undefined && parsed.settings.carbonEmissionFactor !== null) {
          const cf = Number(parsed.settings.carbonEmissionFactor);
          if (typeof parsed.settings.carbonEmissionFactor === 'boolean' || isNaN(cf) || !Number.isFinite(cf) || cf < 0) {
            return { success: false, error: `Invalid carbonEmissionFactor in backup settings: ${parsed.settings.carbonEmissionFactor}` };
          }
          newSettings.carbonEmissionFactor = cf;
        } else if (parsed.settings.carbonEmissionFactor === null) {
          newSettings.carbonEmissionFactor = null;
        }

        if (parsed.settings.billingDays !== undefined) {
          const bd = Number(parsed.settings.billingDays);
          if (typeof parsed.settings.billingDays !== 'boolean' && !isNaN(bd) && Number.isFinite(bd) && bd > 0) {
            newSettings.billingDays = bd;
          }
        }

        if (parsed.settings.currency && typeof parsed.settings.currency === 'string') {
          newSettings.currency = parsed.settings.currency;
        }

        let importedSlabConfigValid = true;
        let slabValidationError = null;
        if (Array.isArray(parsed.settings.slabConfig)) {
          const candidate = parsed.settings.slabConfig;
          let valSlab = null;
          if (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.validateSlabConfig === 'function') {
            valSlab = WattWatchCalculations.validateSlabConfig(candidate, { requireOpenEnded: true });
          } else {
            valSlab = { valid: false, error: 'WattWatchCalculations.validateSlabConfig is unavailable' };
          }

          if (valSlab && valSlab.valid) {
            newSettings.slabConfig = valSlab.sanitized;
          } else {
            importedSlabConfigValid = false;
            slabValidationError = valSlab?.error || 'Invalid slab configuration';
            console.warn('[WattWatch Storage] Refusing to import invalid slab configuration:', slabValidationError);
          }
        } else if (parsed.settings.tariffModel === 'slab') {
          importedSlabConfigValid = false;
          slabValidationError = 'Slab tariff model specified without valid slabConfig array';
        }

        if (parsed.settings.tariffModel === 'flat') {
          newSettings.tariffModel = 'flat';
        } else if (parsed.settings.tariffModel === 'slab') {
          if (importedSlabConfigValid) {
            newSettings.tariffModel = 'slab';
          } else {
            console.warn('[WattWatch Storage] Refusing to set slab tariffModel on import with invalid slabConfig');
            if (mode === 'replace') {
              newSettings.tariffModel = 'flat';
              settingsWarning = `Invalid slab tariff settings in backup (${slabValidationError || 'validation failed'}); fell back to flat tariff mode.`;
            } else {
              settingsWarning = `Invalid slab tariff settings in backup (${slabValidationError || 'validation failed'}) were skipped; existing settings preserved.`;
            }
          }
        } else if (!importedSlabConfigValid && Array.isArray(parsed.settings.slabConfig)) {
          if (mode === 'replace') {
            settingsWarning = `Invalid slab configuration in backup (${slabValidationError || 'validation failed'}) was omitted; fell back to flat tariff mode.`;
          } else {
            settingsWarning = `Invalid slab configuration in backup (${slabValidationError || 'validation failed'}) was skipped; existing settings preserved.`;
          }
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
        if (validatedMeterTracking !== null) {
          if (mode === 'replace' || !localStorage.getItem(meterKey)) {
            const savedMeter = this.saveMeterTracking(validatedMeterTracking);
            if (!savedMeter) {
              throw new Error('Failed to save meter tracking data');
            }
          }
        } else if (mode === 'replace') {
          localStorage.removeItem(meterKey);
        }
        this.invalidateCache();
      } catch (writeErr) {
        console.error('[WattWatch Storage] Write failure during JSON import, attempting restoration:', writeErr);

        let restoredApps = false;
        let restoredHist = false;
        let restoredSett = false;
        let restoredTheme = false;
        let restoredMeter = false;

        // 1. Restore & verify appliances
        try {
          if (storageSnapshot.appliances !== null) {
            localStorage.setItem(appKey, storageSnapshot.appliances);
          } else {
            localStorage.removeItem(appKey);
          }
          if (localStorage.getItem(appKey) === storageSnapshot.appliances) {
            restoredApps = true;
          } else {
            console.error('[WattWatch Storage] Verification failed for restored appliances');
          }
        } catch (rErr1) {
          console.error('[WattWatch Storage] Failed to restore appliances:', rErr1);
        }

        // 2. Restore & verify history
        try {
          if (storageSnapshot.history !== null) {
            localStorage.setItem(histKey, storageSnapshot.history);
          } else {
            localStorage.removeItem(histKey);
          }
          if (localStorage.getItem(histKey) === storageSnapshot.history) {
            restoredHist = true;
          } else {
            console.error('[WattWatch Storage] Verification failed for restored history');
          }
        } catch (rErr2) {
          console.error('[WattWatch Storage] Failed to restore history:', rErr2);
        }

        // 3. Restore & verify settings
        try {
          if (storageSnapshot.settings !== null) {
            localStorage.setItem(settKey, storageSnapshot.settings);
          } else {
            localStorage.removeItem(settKey);
          }
          if (localStorage.getItem(settKey) === storageSnapshot.settings) {
            restoredSett = true;
          } else {
            console.error('[WattWatch Storage] Verification failed for restored settings');
          }
        } catch (rErr3) {
          console.error('[WattWatch Storage] Failed to restore settings:', rErr3);
        }

        // 4. Restore & verify theme
        try {
          if (storageSnapshot.theme !== null) {
            localStorage.setItem(themeKey, storageSnapshot.theme);
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.setAttribute('data-theme', storageSnapshot.theme);
            }
          } else {
            localStorage.removeItem(themeKey);
            if (typeof document !== 'undefined' && document.documentElement) {
              document.documentElement.removeAttribute('data-theme');
            }
          }
          if (localStorage.getItem(themeKey) === storageSnapshot.theme) {
            restoredTheme = true;
          } else {
            console.error('[WattWatch Storage] Verification failed for restored theme');
          }
        } catch (rErr4) {
          console.error('[WattWatch Storage] Failed to restore theme:', rErr4);
        }

        // 5. Restore & verify meter tracking
        try {
          if (storageSnapshot.meter !== null) {
            localStorage.setItem(meterKey, storageSnapshot.meter);
          } else {
            localStorage.removeItem(meterKey);
          }
          if (localStorage.getItem(meterKey) === storageSnapshot.meter) {
            restoredMeter = true;
          } else {
            console.error('[WattWatch Storage] Verification failed for restored meter tracking');
          }
        } catch (rErr5) {
          console.error('[WattWatch Storage] Failed to restore meter:', rErr5);
        }

        this.invalidateCache();
        const fullRestoration = restoredApps && restoredHist && restoredSett && restoredTheme && restoredMeter;

        const failedRestorations = [];
        if (!restoredApps) failedRestorations.push('appliances');
        if (!restoredHist) failedRestorations.push('history');
        if (!restoredSett) failedRestorations.push('settings');
        if (!restoredTheme) failedRestorations.push('theme');
        if (!restoredMeter) failedRestorations.push('meter tracking');

        return {
          success: false,
          restored: fullRestoration,
          restorationSucceeded: fullRestoration,
          failedRestorations: failedRestorations,
          error: `Storage write failure: ${writeErr.message}. ${
            fullRestoration
              ? 'Pre-import state was successfully restored across all 5 storage keys.'
              : `Warning: Restoration failed or was incomplete for: ${failedRestorations.join(', ')}.`
          }`
        };
      }

      const importResult = {
        success: true,
        count: importedAppsCount,
        skippedCount: skippedAppsCount,
        historyCount: importedHistCount,
        skippedHistoryCount: skippedHistCount,
        totalAppliances: finalAppliances.length,
        totalHistory: finalHistory.length,
        mode: mode
      };

      if (settingsWarning) {
        importResult.warning = settingsWarning;
        importResult.settingsWarning = settingsWarning;
      }

      return importResult;
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
        let recordedDate = 'Unknown date';
        if (rec.createdAt !== null && rec.createdAt !== undefined) {
          try {
            const d = new Date(rec.createdAt);
            if (!isNaN(d.getTime())) {
              recordedDate = d.toISOString().split('T')[0];
            }
          } catch (_) {
            recordedDate = 'Unknown date';
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
   * Validates active billing cycle meter tracking record against strict domain rules.
   * Validates numeric fields for finite, non-negative values, dates, and reading relationships.
   * @param {*} meterData
   * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
   */
  validateMeterTracking(meterData) {
    if (!meterData || typeof meterData !== 'object' || Array.isArray(meterData)) {
      return { valid: false, error: 'Meter tracking data must be a valid JSON object' };
    }

    // Helper to validate optional non-negative numeric fields
    const validateNonNegativeNumber = (val, fieldName, max = 10000000) => {
      if (val === null || val === undefined || val === '') {
        return { valid: true, value: 0, specified: false };
      }
      if (typeof val === 'boolean') {
        return { valid: false, error: `${fieldName} must be a number, not boolean` };
      }
      const num = Number(val);
      if (isNaN(num) || !Number.isFinite(num)) {
        return { valid: false, error: `${fieldName} must be a finite number` };
      }
      if (num < 0) {
        return { valid: false, error: `${fieldName} cannot be negative` };
      }
      if (num > max) {
        return { valid: false, error: `${fieldName} cannot exceed ${max}` };
      }
      return { valid: true, value: num, specified: true };
    };

    // 1. Validate numeric fields
    const valStart = validateNonNegativeNumber(meterData.startReading, 'startReading');
    if (!valStart.valid) return { valid: false, error: valStart.error };

    const valCurrent = validateNonNegativeNumber(meterData.currentReading, 'currentReading');
    if (!valCurrent.valid) return { valid: false, error: valCurrent.error };

    const valUnits = validateNonNegativeNumber(meterData.actualUnits, 'actualUnits');
    if (!valUnits.valid) return { valid: false, error: valUnits.error };

    const valCost = validateNonNegativeNumber(meterData.actualCost, 'actualCost');
    if (!valCost.valid) return { valid: false, error: valCost.error };

    // 2. Validate reading relationship: currentReading >= startReading
    if (valStart.specified && valCurrent.specified) {
      if (valCurrent.value < valStart.value) {
        return {
          valid: false,
          error: `Current meter reading (${valCurrent.value}) cannot be lower than start meter reading (${valStart.value})`
        };
      }
    }

    // Helper to validate exact YYYY-MM-DD calendar dates
    const isValidCalendarDate = (dateStr) => {
      if (typeof dateStr !== 'string') return false;
      const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return false;
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);

      if (year < 1900 || year > 2100) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;

      // Check number of days in month (accurately accounts for leap years)
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return day <= daysInMonth;
    };

    // 3. Validate date fields: cycleStartDate and cycleEndDate
    let cleanStartDate = '';
    if (meterData.cycleStartDate !== null && meterData.cycleStartDate !== undefined && meterData.cycleStartDate !== '') {
      if (typeof meterData.cycleStartDate !== 'string' || !isValidCalendarDate(meterData.cycleStartDate)) {
        return {
          valid: false,
          error: `Invalid cycleStartDate "${meterData.cycleStartDate}": must be a valid calendar date in YYYY-MM-DD format`
        };
      }
      cleanStartDate = meterData.cycleStartDate.trim();
    }

    let cleanEndDate = '';
    if (meterData.cycleEndDate !== null && meterData.cycleEndDate !== undefined && meterData.cycleEndDate !== '') {
      if (typeof meterData.cycleEndDate !== 'string' || !isValidCalendarDate(meterData.cycleEndDate)) {
        return {
          valid: false,
          error: `Invalid cycleEndDate "${meterData.cycleEndDate}": must be a valid calendar date in YYYY-MM-DD format`
        };
      }
      cleanEndDate = meterData.cycleEndDate.trim();
    }

    // 4. Validate date relationship: cycleEndDate >= cycleStartDate
    if (cleanStartDate && cleanEndDate) {
      if (cleanEndDate < cleanStartDate) {
        return {
          valid: false,
          error: `Cycle end date (${cleanEndDate}) cannot be earlier than cycle start date (${cleanStartDate})`
        };
      }
    }

    // 5. Compute actualUnits if readings are available, or use validated actualUnits
    let computedUnits = valUnits.value;
    if (valCurrent.specified && valStart.specified && valCurrent.value >= valStart.value && valStart.value >= 0) {
      computedUnits = valCurrent.value - valStart.value;
    }

    // 6. Validate notes
    let cleanNotes = '';
    if (meterData.notes !== undefined && meterData.notes !== null) {
      if (typeof meterData.notes !== 'string') {
        return { valid: false, error: 'notes must be a string' };
      }
      cleanNotes = meterData.notes.slice(0, 500);
    }

    // 7. Validate updatedAt
    let updatedAt = Date.now();
    if (meterData.updatedAt !== undefined && meterData.updatedAt !== null) {
      const validTime = this.validateTimestamp(meterData.updatedAt);
      if (validTime !== null) {
        updatedAt = validTime;
      }
    }

    return {
      valid: true,
      sanitized: {
        cycleStartDate: cleanStartDate,
        cycleEndDate: cleanEndDate,
        startReading: valStart.value,
        currentReading: valCurrent.value,
        actualUnits: computedUnits,
        actualCost: valCost.value,
        notes: cleanNotes,
        updatedAt
      }
    };
  },

  /**
   * Retrieves active billing cycle meter tracking record
   * @returns {Object|null}
   */
  getMeterTracking() {
    const key = this._getKey('METER');
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (typeof parsed !== 'object' || parsed === null) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  /**
   * Saves active billing cycle meter tracking record
   * @param {Object} meterData
   * @returns {boolean} Success status
   */
  saveMeterTracking(meterData) {
    const val = this.validateMeterTracking(meterData);
    if (!val.valid) {
      console.warn('[WattWatch Storage] Refusing to save invalid meter tracking data:', val.error);
      return false;
    }
    try {
      localStorage.setItem(this._getKey('METER'), JSON.stringify(val.sanitized));
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error saving meter tracking:', e);
      this.handleStorageError(e, 'Meter Tracking');
      return false;
    }
  },

  /**
   * Parses CSV text containing appliance records using strict RFC 4180 rules.
   * Validates required and optional fields with detailed row-by-row error reporting.
   * @param {string} csvText
   * @returns {{ success: boolean, totalRows: number, validRecords: Array, errors: Array }}
   */
  parseAppliancesCSV(csvText) {
    if (typeof csvText !== 'string' || !csvText.trim()) {
      return { success: false, totalRows: 0, validRecords: [], errors: ['CSV content is empty or invalid'] };
    }

    // Strip BOM
    const text = csvText.replace(/^\uFEFF/, '');

    // RFC 4180 state machine parser handling quotes and newlines within fields
    const rows = [];
    let curRow = [];
    let curVal = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"') {
          if (next === '"') {
            curVal += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          curVal += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          curRow.push(curVal.trim());
          curVal = '';
        } else if (c === '\r' || c === '\n') {
          curRow.push(curVal.trim());
          curVal = '';
          if (curRow.some(cell => cell.length > 0)) {
            rows.push(curRow);
          }
          curRow = [];
          if (c === '\r' && next === '\n') {
            i++; // skip \n
          }
        } else {
          curVal += c;
        }
      }
    }
    if (curVal.length > 0 || curRow.length > 0) {
      curRow.push(curVal.trim());
      if (curRow.some(cell => cell.length > 0)) {
        rows.push(curRow);
      }
    }

    if (rows.length < 2) {
      return { success: false, totalRows: rows.length, validRecords: [], errors: ['CSV file must contain a header row and at least one data row'] };
    }

    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/[\r\n]+/g, ''));
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'appliance' || h === 'appliance name');
    const catIdx = headers.findIndex(h => h === 'category');
    const wattsIdx = headers.findIndex(h => h.includes('watt') || h.includes('power'));
    const hoursIdx = headers.findIndex(h => h.includes('hour') || h.includes('daily'));
    const daysIdx = headers.findIndex(h => h.includes('day') || h.includes('operating'));
    const qtyIdx = headers.findIndex(h => h.includes('quantity') || h === 'qty' || h === 'count');
    const standbyIdx = headers.findIndex(h => h.includes('standby'));
    const dutyIdx = headers.findIndex(h => h.includes('duty') || h.includes('inverter'));
    const weekdayIdx = headers.findIndex(h => h.includes('weekday'));
    const weekendIdx = headers.findIndex(h => h.includes('weekend'));
    const activeDaysIdx = headers.findIndex(h => h.includes('active days') || h.includes('days per week') || h === 'active_days');

    if (nameIdx === -1 || wattsIdx === -1 || hoursIdx === -1) {
      return {
        success: false,
        totalRows: rows.length - 1,
        validRecords: [],
        errors: ['CSV is missing required headers. Required: Name, Power Watts, Daily Hours (Optional: Category, Operating Days, Quantity)']
      };
    }

    const validRecords = [];
    const errors = [];
    const validCategories = ['Cooling', 'Kitchen', 'Lighting', 'Entertainment', 'Computing', 'Other'];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const lineNum = r + 1;
      const rowErrors = [];

      const rawName = row[nameIdx];
      const rawWatts = row[wattsIdx];
      const rawHours = row[hoursIdx];
      const rawDays = daysIdx !== -1 ? row[daysIdx] : '30';
      const rawQty = qtyIdx !== -1 ? row[qtyIdx] : '1';
      const rawCat = catIdx !== -1 ? row[catIdx] : 'Other';

      if (!rawName || !rawName.trim()) {
        rowErrors.push('Appliance name cannot be empty');
      }

      const pWatts = Number(rawWatts);
      if (isNaN(pWatts) || pWatts <= 0 || pWatts > 50000) {
        rowErrors.push(`Power rating (${rawWatts}) must be between 1 and 50,000 W`);
      }

      const dHours = Number(rawHours);
      if (isNaN(dHours) || dHours < 0 || dHours > 24) {
        rowErrors.push(`Daily hours (${rawHours}) must be between 0 and 24`);
      }

      const oDays = rawDays ? Number(rawDays) : 30;
      if (isNaN(oDays) || oDays < 0 || oDays > 31 || !Number.isInteger(oDays)) {
        rowErrors.push(`Operating days (${rawDays}) must be an integer between 0 and 31`);
      }

      const qty = rawQty ? Number(rawQty) : 1;
      if (isNaN(qty) || qty < 1 || qty > 1000 || !Number.isInteger(qty)) {
        rowErrors.push(`Quantity (${rawQty}) must be an integer >= 1`);
      }

      let category = 'Other';
      if (rawCat && rawCat.trim()) {
        const matched = validCategories.find(c => c.toLowerCase() === rawCat.trim().toLowerCase());
        category = matched || 'Other';
      }

      const record = {
        id: `app_csv_${Date.now()}_${r}_${Math.random().toString(36).substr(2, 5)}`,
        name: rawName ? rawName.trim().slice(0, 100) : `Appliance #${r}`,
        category,
        powerWatts: pWatts,
        dailyHours: dHours,
        operatingDays: oDays,
        quantity: qty,
        createdAt: Date.now() - ((rows.length - r) * 1000)
      };

      if (standbyIdx !== -1 && row[standbyIdx]) {
        const sb = Number(row[standbyIdx]);
        if (!isNaN(sb) && sb >= 0 && sb <= 500) record.standbyWatts = sb;
      }
      if (dutyIdx !== -1 && row[dutyIdx]) {
        const dc = Number(row[dutyIdx]);
        if (!isNaN(dc) && dc > 0 && dc <= 100) record.dutyCyclePercent = dc;
      }
      if (weekdayIdx !== -1 && row[weekdayIdx]) {
        const wd = Number(row[weekdayIdx]);
        if (!isNaN(wd) && wd >= 0 && wd <= 24) record.weekdayHours = wd;
      }
      if (weekendIdx !== -1 && row[weekendIdx]) {
        const we = Number(row[weekendIdx]);
        if (!isNaN(we) && we >= 0 && we <= 24) record.weekendHours = we;
      }
      if (activeDaysIdx !== -1 && row[activeDaysIdx]) {
        const ad = Number(row[activeDaysIdx]);
        if (!isNaN(ad) && ad >= 1 && ad <= 7) record.activeDaysPerWeek = Math.round(ad);
      }

      if (rowErrors.length > 0) {
        errors.push(`Row ${lineNum}: ${rowErrors.join(', ')}`);
      } else {
        validRecords.push(record);
      }
    }

    return {
      success: errors.length === 0,
      totalRows: rows.length - 1,
      validRecords,
      errors
    };
  },

  /**
   * Clears all appliances, history and resets settings to default
   */
  clearAllData() {
    try {
      localStorage.removeItem(this._getKey('APPLIANCES'));
      localStorage.removeItem(this._getKey('SETTINGS'));
      localStorage.removeItem(this._getKey('HISTORY'));
      localStorage.removeItem(this._getKey('METER'));
      localStorage.removeItem(this.getGuideKey());
      this.invalidateCache();
      return true;
    } catch (e) {
      console.error('[WattWatch Storage] Error clearing data:', e);
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchStorage = WattWatchStorage;
}
