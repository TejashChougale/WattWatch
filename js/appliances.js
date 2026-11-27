/**
 * WATTWATCH - Appliances Management Module
 * Handles appliance CRUD, input validation, live calculation preview, presets, search, filter, and sorting.
 */

// Standard appliance presets for convenient quick configuration
const APPLIANCE_PRESETS = [
  { name: '1.5 Ton 5-Star Inverter AC', category: 'Cooling', powerWatts: 1450, dailyHours: 6.0, operatingDays: 30, quantity: 1 },
  { name: '1.0 Ton 3-Star Inverter AC', category: 'Cooling', powerWatts: 1100, dailyHours: 6.0, operatingDays: 30, quantity: 1 },
  { name: 'BLDC Ceiling Fan (Energy Efficient)', category: 'Cooling', powerWatts: 35, dailyHours: 12.0, operatingDays: 30, quantity: 1 },
  { name: 'Standard Induction Motor Ceiling Fan', category: 'Cooling', powerWatts: 75, dailyHours: 12.0, operatingDays: 30, quantity: 1 },
  { name: 'Double Door Refrigerator 260L-350L', category: 'Kitchen', powerWatts: 180, dailyHours: 12.0, operatingDays: 30, quantity: 1 },
  { name: 'Single Door Direct Cool Refrigerator 190L', category: 'Kitchen', powerWatts: 120, dailyHours: 10.0, operatingDays: 30, quantity: 1 },
  { name: 'Microwave Oven (Convection)', category: 'Kitchen', powerWatts: 1200, dailyHours: 0.5, operatingDays: 30, quantity: 1 },
  { name: 'Induction Cooktop 2000W', category: 'Kitchen', powerWatts: 1800, dailyHours: 1.5, operatingDays: 30, quantity: 1 },
  { name: 'Instant Water Geyser 15L-25L', category: 'Other', powerWatts: 2000, dailyHours: 1.0, operatingDays: 30, quantity: 1 },
  { name: '55-inch 4K Smart TV', category: 'Entertainment', powerWatts: 110, dailyHours: 4.5, operatingDays: 30, quantity: 1 },
  { name: 'Gaming Desktop PC with Dedicated GPU', category: 'Computing', powerWatts: 380, dailyHours: 4.0, operatingDays: 30, quantity: 1 },
  { name: 'Office Laptop Workstation', category: 'Computing', powerWatts: 65, dailyHours: 8.0, operatingDays: 24, quantity: 1 },
  { name: 'LED Bulb 9W (Warm White / Daylight)', category: 'Lighting', powerWatts: 9, dailyHours: 6.0, operatingDays: 30, quantity: 1 },
  { name: 'LED Tube Light 20W / Batten', category: 'Lighting', powerWatts: 20, dailyHours: 6.0, operatingDays: 30, quantity: 1 },
  { name: 'Fully Automatic Washing Machine', category: 'Other', powerWatts: 500, dailyHours: 1.0, operatingDays: 20, quantity: 1 },
  { name: 'Electric Iron (Steam / Dry)', category: 'Other', powerWatts: 1000, dailyHours: 0.5, operatingDays: 16, quantity: 1 }
];

const WattWatchAppliances = {
  activeCategoryFilter: 'All',
  searchQuery: '',
  sortBy: 'consumption_desc',
  editingApplianceId: null,

  _eventsBound: false,
  previousActiveElement: null,

  /**
   * Initializes appliance module DOM events
   */
  init() {
    this.bindEvents();
    this.populatePresetsDropdown();
  },

  /**
   * Binds UI events for search, filters, form, and modal
   */
  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Search input
    const searchInput = document.getElementById('applianceSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderApplianceTable();
      });
    }

    // Category filter pills
    const filterContainer = document.getElementById('categoryFilters');
    if (filterContainer) {
      filterContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        filterContainer.querySelectorAll('.filter-pill').forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
          p.setAttribute('tabindex', '-1');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');
        pill.setAttribute('tabindex', '0');
        this.activeCategoryFilter = pill.getAttribute('data-category') || 'All';
        this.renderApplianceTable();
      });
    }

    // Sort selector
    const sortSelect = document.getElementById('applianceSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderApplianceTable();
      });
    }

    const btnEmptyAdd = document.getElementById('btnEmptyAddAppliance');
    if (btnEmptyAdd) {
      btnEmptyAdd.addEventListener('click', () => this.openModal());
    }
    const btnEmptyLoad = document.getElementById('btnEmptyLoadSample');
    if (btnEmptyLoad) {
      btnEmptyLoad.addEventListener('click', () => {
        const sampleBtn = document.getElementById('btnLoadSampleData');
        if (sampleBtn) sampleBtn.click();
      });
    }

    // Modal Live Preview Input Triggers
    const modalInputs = [
      'modalPowerWatts', 'modalQuantity', 'modalDailyHours', 'modalOperatingDays',
      'modalWeekdayHours', 'modalWeekendHours', 'modalActiveDaysWeek', 'modalDutyCycle', 'modalStandbyWatts'
    ];
    modalInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateModalLivePreview());
      }
    });

    // Advanced Usage Profile Toggle Button
    const btnToggleAdv = document.getElementById('btnToggleAdvancedAppliance');
    const advContainer = document.getElementById('applianceAdvancedFields');
    const advChevron = document.getElementById('advancedApplianceChevron');
    if (btnToggleAdv && advContainer) {
      btnToggleAdv.addEventListener('click', () => {
        const isCollapsed = advContainer.style.display === 'none' || !advContainer.style.display;
        advContainer.style.display = isCollapsed ? 'block' : 'none';
        btnToggleAdv.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        if (advChevron) advChevron.textContent = isCollapsed ? '▴' : '▾';
      });
    }

    // Preset selection change in modal
    const presetSelect = document.getElementById('modalPresetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }

    // Form Submission
    const form = document.getElementById('applianceForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Safe delegated event handling for appliance table action buttons (no inline onclicks)
    const tableBody = document.getElementById('applianceTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'simulate') {
          this.simulateAppliance(id);
        } else if (action === 'edit') {
          this.openModal(id);
        } else if (action === 'delete') {
          this.confirmDelete(id);
        }
      });
    }
  },

  /**
   * Populates the quick preset dropdown inside the modal
   */
  populatePresetsDropdown() {
    const select = document.getElementById('modalPresetSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose from standard presets (Optional) --</option>';
    APPLIANCE_PRESETS.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = idx.toString();
      opt.textContent = `${p.name} (${p.powerWatts}W, ${p.dailyHours}h)`;
      select.appendChild(opt);
    });
  },

  /**
   * Applies selected preset data into the modal inputs
   * @param {string} indexStr
   */
  applyPreset(indexStr) {
    if (indexStr === '') return;
    const idx = parseInt(indexStr, 10);
    const preset = APPLIANCE_PRESETS[idx];
    if (!preset) return;

    document.getElementById('modalApplianceName').value = preset.name;
    document.getElementById('modalCategory').value = preset.category;
    document.getElementById('modalPowerWatts').value = preset.powerWatts;
    document.getElementById('modalQuantity').value = preset.quantity;
    document.getElementById('modalDailyHours').value = preset.dailyHours;
    document.getElementById('modalOperatingDays').value = preset.operatingDays;

    this.clearValidationErrors();
    this.updateModalLivePreview();
  },

  _modalElements: null,

  _getModalElements() {
    if (!this._modalElements) {
      this._modalElements = {
        powerWatts: document.getElementById('modalPowerWatts'),
        quantity: document.getElementById('modalQuantity'),
        dailyHours: document.getElementById('modalDailyHours'),
        operatingDays: document.getElementById('modalOperatingDays'),
        weekdayHours: document.getElementById('modalWeekdayHours'),
        weekendHours: document.getElementById('modalWeekendHours'),
        activeDaysWeek: document.getElementById('modalActiveDaysWeek'),
        dutyCycle: document.getElementById('modalDutyCycle'),
        standbyWatts: document.getElementById('modalStandbyWatts'),
        elDaily: document.getElementById('previewDailyKwh'),
        elMonthly: document.getElementById('previewMonthlyKwh'),
        elCost: document.getElementById('previewMonthlyCost'),
        elAssumptions: document.getElementById('modalPreviewAssumptions')
      };
    }
    return this._modalElements;
  },

  /**
   * Calculates and refreshes the live calculation preview box inside the modal
   */
  updateModalLivePreview() {
    const dom = this._getModalElements();
    const rawPower = dom.powerWatts?.value;
    const power = (rawPower !== undefined && rawPower !== null && rawPower.trim() !== '') ? Number(rawPower) : NaN;

    const rawQty = dom.quantity?.value;
    const qty = (rawQty !== undefined && rawQty !== null && rawQty.trim() !== '') ? Number(rawQty) : NaN;

    const rawHours = dom.dailyHours?.value;
    const hours = (rawHours !== undefined && rawHours !== null && rawHours.trim() !== '') ? Number(rawHours) : NaN;

    const rawDays = dom.operatingDays?.value;
    const days = (rawDays !== undefined && rawDays !== null && rawDays.trim() !== '') ? Number(rawDays) : NaN;

    const rawWd = dom.weekdayHours?.value;
    const rawWe = dom.weekendHours?.value;
    const rawAdw = dom.activeDaysWeek?.value;
    const rawDc = dom.dutyCycle?.value;
    const rawSb = dom.standbyWatts?.value;

    const settings = WattWatchStorage.getSettings();
    let rate = 8.00;
    if (settings.tariffModel === 'slab') {
      const curAppliances = WattWatchStorage.getAppliances();
      const curSummary = WattWatchCalculations.calculateHouseholdSummary(curAppliances, settings);
      rate = curSummary.isValid ? curSummary.effectiveRatePerKwh : NaN;
    } else {
      const rawRate = Number(settings.electricityRate);
      rate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate) && rawRate >= 0)
        ? rawRate
        : 8.00;
    }

    const candidate = {
      powerWatts: power,
      quantity: qty,
      dailyHours: hours,
      operatingDays: days
    };
    if (rawWd !== undefined && rawWd !== null && rawWd.trim() !== '') candidate.weekdayHours = Number(rawWd);
    if (rawWe !== undefined && rawWe !== null && rawWe.trim() !== '') candidate.weekendHours = Number(rawWe);
    if (rawAdw !== undefined && rawAdw !== null && rawAdw.trim() !== '') candidate.activeDaysPerWeek = Number(rawAdw);
    if (rawDc !== undefined && rawDc !== null && rawDc.trim() !== '') candidate.dutyCyclePercent = Number(rawDc);
    if (rawSb !== undefined && rawSb !== null && rawSb.trim() !== '') candidate.standbyWatts = Number(rawSb);

    let dailyKwh, monthlyKwh;
    if (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.calculateApplianceMetrics === 'function') {
      const metrics = WattWatchCalculations.calculateApplianceMetrics(candidate);
      dailyKwh = metrics.dailyKwh;
      monthlyKwh = metrics.monthlyKwh;
    } else {
      dailyKwh = WattWatchCalculations.calculateDailyKwh(power, qty, hours);
      monthlyKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, hours, days);
    }
    const monthlyCost = WattWatchCalculations.calculateCost(monthlyKwh, rate);

    if (dom.elDaily) dom.elDaily.textContent = WattWatchCalculations.formatKwh(dailyKwh);
    if (dom.elMonthly) dom.elMonthly.textContent = WattWatchCalculations.formatKwh(monthlyKwh);
    if (dom.elCost) dom.elCost.textContent = WattWatchCalculations.formatCurrency(monthlyCost, settings.currency);

    if (dom.elAssumptions) {
      const parts = [];
      if (candidate.dutyCyclePercent !== undefined && candidate.dutyCyclePercent < 100) {
        parts.push(`${candidate.dutyCyclePercent}% duty cycle`);
      }
      if (candidate.standbyWatts !== undefined && candidate.standbyWatts > 0) {
        parts.push(`${candidate.standbyWatts}W standby draw`);
      }
      const hasWd = candidate.weekdayHours !== undefined && Number.isFinite(candidate.weekdayHours);
      const hasWe = candidate.weekendHours !== undefined && Number.isFinite(candidate.weekendHours);
      if (hasWd || hasWe) {
        const wdDisp = hasWd ? candidate.weekdayHours : hours;
        const weDisp = hasWe ? candidate.weekendHours : hours;
        if (wdDisp !== weDisp) {
          parts.push(`${wdDisp}h weekday / ${weDisp}h weekend`);
        }
      }
      if (candidate.activeDaysPerWeek !== undefined && candidate.activeDaysPerWeek < 7) {
        parts.push(`${candidate.activeDaysPerWeek} active days/week`);
      }
      if (parts.length > 0) {
        dom.elAssumptions.textContent = `Modeled with: ${parts.join(' · ')}`;
        dom.elAssumptions.style.display = 'block';
      } else {
        dom.elAssumptions.textContent = '';
        dom.elAssumptions.style.display = 'none';
      }
    }
  },

  /**
   * Validates form inputs and displays clear error messages
   * @returns {Object|null} Validated appliance payload or null if invalid
   */
  validateForm() {
    this.clearValidationErrors();
    let isValid = true;

    const nameInput = document.getElementById('modalApplianceName');
    const categoryInput = document.getElementById('modalCategory');
    const powerInput = document.getElementById('modalPowerWatts');
    const qtyInput = document.getElementById('modalQuantity');
    const hoursInput = document.getElementById('modalDailyHours');
    const daysInput = document.getElementById('modalOperatingDays');

    const name = nameInput.value.trim();
    const category = categoryInput.value;
    const power = Number(powerInput.value);
    const rawQty = qtyInput.value ? Number(qtyInput.value) : NaN;
    const hours = Number(hoursInput.value);
    const rawDays = daysInput.value ? Number(daysInput.value) : NaN;

    // Validate Name
    if (!name) {
      this.showFieldError('modalApplianceName', 'Appliance name is required');
      isValid = false;
    } else if (name.length > 100) {
      this.showFieldError('modalApplianceName', 'Name cannot exceed 100 characters');
      isValid = false;
    }

    // Validate Category against allowed whitelist
    if (!category || !WattWatchStorage.ALLOWED_CATEGORIES.includes(category)) {
      this.showFieldError('modalCategory', `Please select an allowed category (${WattWatchStorage.ALLOWED_CATEGORIES.join(', ')})`);
      isValid = false;
    }

    // Validate Power
    if (isNaN(power) || power < 1) {
      this.showFieldError('modalPowerWatts', 'Power must be at least 1 Watt (max 50,000 W)');
      isValid = false;
    } else if (power > 50000) {
      this.showFieldError('modalPowerWatts', 'Power rating seems unrealistically high (max 50,000 W)');
      isValid = false;
    }

    // Validate Quantity: reject decimals, require whole integer >= 1
    if (isNaN(rawQty) || !Number.isInteger(rawQty) || rawQty < 1) {
      this.showFieldError('modalQuantity', 'Quantity must be a positive whole integer of at least 1 unit');
      isValid = false;
    } else if (rawQty > 100) {
      this.showFieldError('modalQuantity', 'Quantity cannot exceed 100 units');
      isValid = false;
    }

    // Validate Daily Hours
    if (isNaN(hours) || hours < 0 || hours > 24) {
      this.showFieldError('modalDailyHours', 'Daily usage hours must be between 0 and 24');
      isValid = false;
    }

    // Validate Operating Days
    if (isNaN(rawDays) || !Number.isInteger(rawDays) || rawDays < 1 || rawDays > 31) {
      this.showFieldError('modalOperatingDays', 'Operating days must be an integer between 1 and 31');
      isValid = false;
    }

    if (!isValid) return null;

    const candidate = {
      name,
      category,
      powerWatts: power,
      quantity: rawQty,
      dailyHours: hours,
      operatingDays: rawDays
    };

    const wdInput = document.getElementById('modalWeekdayHours');
    const weInput = document.getElementById('modalWeekendHours');
    const adwInput = document.getElementById('modalActiveDaysWeek');
    const dcInput = document.getElementById('modalDutyCycle');
    const sbInput = document.getElementById('modalStandbyWatts');

    if (wdInput && wdInput.value !== undefined && wdInput.value !== null && wdInput.value.trim() !== '') {
      candidate.weekdayHours = Number(wdInput.value);
    }
    if (weInput && weInput.value !== undefined && weInput.value !== null && weInput.value.trim() !== '') {
      candidate.weekendHours = Number(weInput.value);
    }
    if (adwInput && adwInput.value !== undefined && adwInput.value !== null && adwInput.value.trim() !== '') {
      candidate.activeDaysPerWeek = Number(adwInput.value);
    }
    if (dcInput && dcInput.value !== undefined && dcInput.value !== null && dcInput.value.trim() !== '') {
      candidate.dutyCyclePercent = Number(dcInput.value);
    }
    if (sbInput && sbInput.value !== undefined && sbInput.value !== null && sbInput.value.trim() !== '') {
      candidate.standbyWatts = Number(sbInput.value);
    }

    const validated = WattWatchStorage.validateAppliance(candidate);
    if (!validated.valid) {
      this.showFieldError('modalApplianceName', validated.error);
      return null;
    }

    return validated.sanitized;
  },

  showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.add('is-invalid');
    const group = input.closest('.form-group');
    if (group) {
      const errorEl = group.querySelector('.form-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
      }
    }
  },

  clearValidationErrors() {
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
  },

  /**
   * Opens Add/Edit modal dialog
   * @param {string|null} applianceId - If provided, opens in edit mode
   */
  openModal(applianceId = null) {
    this.editingApplianceId = applianceId;
    this.clearValidationErrors();

    const titleEl = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const presetSelect = document.getElementById('modalPresetSelect');

    if (applianceId) {
      const appliances = WattWatchStorage.getAppliances();
      const existing = appliances.find(a => a.id === applianceId);
      if (!existing) return;

      if (titleEl) titleEl.textContent = 'Edit Appliance';
      if (submitBtn) submitBtn.textContent = 'Update Appliance';

      const nameEl = document.getElementById('modalApplianceName');
      if (nameEl) nameEl.value = existing.name;
      const catEl = document.getElementById('modalCategory');
      if (catEl) catEl.value = existing.category;
      const pwrEl = document.getElementById('modalPowerWatts');
      if (pwrEl) pwrEl.value = existing.powerWatts;
      const qtyEl = document.getElementById('modalQuantity');
      if (qtyEl) qtyEl.value = existing.quantity;
      const hrsEl = document.getElementById('modalDailyHours');
      if (hrsEl) hrsEl.value = existing.dailyHours;
      const daysEl = document.getElementById('modalOperatingDays');
      if (daysEl) daysEl.value = existing.operatingDays;

      const wdEl = document.getElementById('modalWeekdayHours');
      const weEl = document.getElementById('modalWeekendHours');
      const adwEl = document.getElementById('modalActiveDaysWeek');
      const dcEl = document.getElementById('modalDutyCycle');
      const sbEl = document.getElementById('modalStandbyWatts');

      if (wdEl) wdEl.value = existing.weekdayHours !== undefined ? existing.weekdayHours : '';
      if (weEl) weEl.value = existing.weekendHours !== undefined ? existing.weekendHours : '';
      if (adwEl) adwEl.value = existing.activeDaysPerWeek !== undefined ? existing.activeDaysPerWeek : '';
      if (dcEl) dcEl.value = existing.dutyCyclePercent !== undefined ? existing.dutyCyclePercent : '';
      if (sbEl) sbEl.value = existing.standbyWatts !== undefined ? existing.standbyWatts : '';

      const hasAdv = (existing.weekdayHours !== undefined) || (existing.weekendHours !== undefined) ||
        (existing.activeDaysPerWeek !== undefined && existing.activeDaysPerWeek < 7) ||
        (existing.dutyCyclePercent !== undefined && existing.dutyCyclePercent < 100) ||
        (existing.standbyWatts !== undefined && existing.standbyWatts > 0);

      const advContainer = document.getElementById('applianceAdvancedFields');
      const btnToggleAdv = document.getElementById('btnToggleAdvancedAppliance');
      const advChevron = document.getElementById('advancedApplianceChevron');
      if (advContainer) advContainer.style.display = hasAdv ? 'block' : 'none';
      if (btnToggleAdv) btnToggleAdv.setAttribute('aria-expanded', hasAdv ? 'true' : 'false');
      if (advChevron) advChevron.textContent = hasAdv ? '▴' : '▾';

      if (presetSelect) presetSelect.value = '';
    } else {
      if (titleEl) titleEl.textContent = 'Add New Appliance';
      if (submitBtn) submitBtn.textContent = 'Save Appliance';

      const form = document.getElementById('applianceForm');
      if (form) form.reset();
      const qty = document.getElementById('modalQuantity');
      if (qty) qty.value = '1';
      const opDays = document.getElementById('modalOperatingDays');
      if (opDays) opDays.value = '30';
      const dailyHrs = document.getElementById('modalDailyHours');
      if (dailyHrs) dailyHrs.value = '4';

      const wdEl = document.getElementById('modalWeekdayHours');
      const weEl = document.getElementById('modalWeekendHours');
      const adwEl = document.getElementById('modalActiveDaysWeek');
      const dcEl = document.getElementById('modalDutyCycle');
      const sbEl = document.getElementById('modalStandbyWatts');
      if (wdEl) wdEl.value = '';
      if (weEl) weEl.value = '';
      if (adwEl) adwEl.value = '';
      if (dcEl) dcEl.value = '';
      if (sbEl) sbEl.value = '';

      const advContainer = document.getElementById('applianceAdvancedFields');
      const btnToggleAdv = document.getElementById('btnToggleAdvancedAppliance');
      const advChevron = document.getElementById('advancedApplianceChevron');
      if (advContainer) advContainer.style.display = 'none';
      if (btnToggleAdv) btnToggleAdv.setAttribute('aria-expanded', 'false');
      if (advChevron) advChevron.textContent = '▾';

      if (presetSelect) presetSelect.value = '';
    }

    this.updateModalLivePreview();

    const backdrop = document.getElementById('applianceModal');
    if (backdrop) {
      this.previousActiveElement = document.activeElement;
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.open(backdrop, this.previousActiveElement);
      } else {
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
      }
      document.getElementById('modalApplianceName')?.focus();
    }
  },

  /**
   * Closes the modal
   */
  closeModal() {
    const backdrop = document.getElementById('applianceModal');
    if (backdrop) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.close(backdrop);
      } else {
        backdrop.classList.remove('is-open');
        backdrop.setAttribute('aria-hidden', 'true');
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          try {
            this.previousActiveElement.focus();
          } catch (e) {
            // ignore
          }
        }
      }
    }
    this.editingApplianceId = null;
    this.clearValidationErrors();
  },

  /**
   * Handles Form Submission (Add or Update)
   */
  handleFormSubmit() {
    const payload = this.validateForm();
    if (!payload) return;

    const appliances = WattWatchStorage.getAppliances();

    if (this.editingApplianceId) {
      // Update existing (rebuild cleanly so cleared optional advanced fields are not retained)
      const index = appliances.findIndex(a => a.id === this.editingApplianceId);
      if (index !== -1) {
        const existing = appliances[index];
        appliances[index] = {
          ...payload,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: Date.now()
        };
        const saved = WattWatchStorage.saveAppliances(appliances);
        if (!saved) {
          WattWatchApp.showToast('Failed to save appliance to storage.', 'error', 'Save Failed');
          return;
        }
        this._lastHighlightedId = existing.id;
        WattWatchApp.showToast('Appliance updated successfully', 'success', 'Saved');
      }
    } else {
      // Add new
      const newAppliance = {
        id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        ...payload,
        createdAt: Date.now()
      };
      appliances.push(newAppliance);
      const saved = WattWatchStorage.saveAppliances(appliances);
      if (!saved) {
        WattWatchApp.showToast('Failed to save appliance to storage.', 'error', 'Save Failed');
        return;
      }
      this._lastHighlightedId = newAppliance.id;
      WattWatchApp.showToast(`"${payload.name}" added to inventory`, 'success', 'Appliance Added');
    }

    this.closeModal();
    WattWatchApp.refreshAll();
    this._lastHighlightedId = null;
  },

  /**
   * Initiates deletion of an appliance with confirmation dialog
   * @param {string} id
   */
  confirmDelete(id) {
    const appliances = WattWatchStorage.getAppliances();
    const target = appliances.find(a => a.id === id);
    if (!target) return;

    WattWatchApp.openConfirmDialog({
      title: 'Delete Appliance',
      message: `Are you sure you want to remove "${target.name}"? This action cannot be undone.`,
      confirmText: 'Delete Appliance',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        this.deleteAppliance(id);
      }
    });
  },

  /**
   * Deletes appliance by ID
   * @param {string} id
   */
  deleteAppliance(id) {
    const appliances = WattWatchStorage.getAppliances();
    const updated = appliances.filter(a => a.id !== id);
    const saved = WattWatchStorage.saveAppliances(updated);
    if (!saved) {
      WattWatchApp.showToast('Failed to delete appliance from storage.', 'error', 'Delete Failed');
      return;
    }
    WattWatchApp.showToast('Appliance deleted from inventory', 'info', 'Removed');
    WattWatchApp.refreshAll();
  },

  /**
   * Filters and sorts appliances based on user controls
   * @param {Array} appliances
   * @param {number} rate
   * @returns {Array} Enriched and sorted appliances
   */
  getFilteredAndSortedAppliances(appliances, rate) {
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, rate);
    let list = summary.appliances;

    // Filter by Category
    if (this.activeCategoryFilter && this.activeCategoryFilter !== 'All') {
      list = list.filter(a => a.category === this.activeCategoryFilter);
    }

    // Filter by Search Query
    if (this.searchQuery) {
      list = list.filter(a =>
        a.name.toLowerCase().includes(this.searchQuery) ||
        a.category.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sorting
    switch (this.sortBy) {
      case 'consumption_desc':
        list.sort((a, b) => b.monthlyKwh - a.monthlyKwh);
        break;
      case 'consumption_asc':
        list.sort((a, b) => a.monthlyKwh - b.monthlyKwh);
        break;
      case 'cost_desc':
        list.sort((a, b) => b.monthlyCost - a.monthlyCost);
        break;
      case 'cost_asc':
        list.sort((a, b) => a.monthlyCost - b.monthlyCost);
        break;
      case 'power_desc':
        list.sort((a, b) => b.powerWatts - a.powerWatts);
        break;
      case 'hours_desc':
        list.sort((a, b) => b.dailyHours - a.dailyHours);
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        list.sort((a, b) => b.monthlyKwh - a.monthlyKwh);
    }

    return list;
  },

  /**
   * Renders the appliance table rows and handles empty state
   */
  renderApplianceTable() {
    const tbody = document.getElementById('applianceTableBody');
    const emptyState = document.getElementById('appliancesEmptyState');
    const tableWrap = document.getElementById('appliancesTableWrap');
    const countEl = document.getElementById('applianceFilterCount');
    if (!tbody) return;

    const rawAppliances = WattWatchStorage.getAppliances();
    const settings = WattWatchStorage.getSettings();

    const filteredList = this.getFilteredAndSortedAppliances(rawAppliances, settings);

    if (countEl) {
      if (rawAppliances.length === 0) {
        countEl.textContent = 'Showing 0 appliances';
      } else {
        countEl.textContent = `Showing ${filteredList.length} of ${rawAppliances.length} appliance${rawAppliances.length === 1 ? '' : 's'}`;
      }
    }

    if (rawAppliances.length === 0) {
      if (tableWrap) tableWrap.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.querySelector('.empty-state-title').textContent = 'No Appliances Added Yet';
        emptyState.querySelector('.empty-state-desc').textContent =
          'Start tracking your household electrical consumption by adding your first appliance, or load our curated sample household to explore features instantly.';
      }
      return;
    }

    if (filteredList.length === 0) {
      if (tableWrap) tableWrap.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.querySelector('.empty-state-title').textContent = 'No Matching Appliances';
        emptyState.querySelector('.empty-state-desc').textContent =
          `No appliances matched your filter "${this.activeCategoryFilter}" and search "${this.searchQuery}". Try clearing filters.`;
      }
      return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = '';

    const nameCounts = {};
    filteredList.forEach(a => {
      const key = String(a?.name || 'Appliance').trim() || 'Appliance';
      nameCounts[key] = (nameCounts[key] || 0) + 1;
    });
    const nameSeen = {};

    filteredList.forEach(app => {
      const rawLabelName = String(app?.name || 'Appliance').trim() || 'Appliance';
      nameSeen[rawLabelName] = (nameSeen[rawLabelName] || 0) + 1;
      const ariaNameSuffix = nameCounts[rawLabelName] > 1
        ? ` (${Number(app.powerWatts) || 0}W, #${nameSeen[rawLabelName]})`
        : '';
      const uniqueAriaName = this.escapeHtml(`${rawLabelName}${ariaNameSuffix}`);
      const tr = document.createElement('tr');
      if (this._lastHighlightedId && app.id === this._lastHighlightedId) {
        tr.classList.add('row-flash');
      }
      const safeCat = this.escapeHtml(app.category || 'Other');
      const badgeClass = `badge-${encodeURIComponent(String(app.category || 'other').toLowerCase().replace(/[^a-z0-9]/g, ''))}`;
      const isHighLoad = (Number(app.sharePercentage) || 0) >= 20;
      const hasSplitHours = (app.weekdayHours !== undefined || app.weekendHours !== undefined) &&
        ((app.weekdayHours !== undefined ? app.weekdayHours : app.dailyHours) !== (app.weekendHours !== undefined ? app.weekendHours : app.dailyHours));
      const hasAdv = (app.dutyCyclePercent !== undefined && app.dutyCyclePercent < 100) ||
        (app.standbyWatts !== undefined && app.standbyWatts > 0) ||
        hasSplitHours ||
        (app.activeDaysPerWeek !== undefined && app.activeDaysPerWeek < 7);

      let advDesc = '';
      if (hasAdv) {
        const parts = [];
        if (app.dutyCyclePercent !== undefined && app.dutyCyclePercent < 100) parts.push(`${app.dutyCyclePercent}% duty`);
        if (app.standbyWatts !== undefined && app.standbyWatts > 0) parts.push(`${app.standbyWatts}W standby`);
        if (hasSplitHours) {
          const wd = app.weekdayHours !== undefined ? app.weekdayHours : app.dailyHours;
          const we = app.weekendHours !== undefined ? app.weekendHours : app.dailyHours;
          parts.push(`${wd}h/${we}h`);
        }
        if (app.activeDaysPerWeek !== undefined && app.activeDaysPerWeek < 7) parts.push(`${app.activeDaysPerWeek}d/wk`);
        if (parts.length > 0) advDesc = parts.join(' · ');
      }

      tr.innerHTML = `
        <td>
          <div class="appliance-name-cell">
            <span class="appliance-main-name">
              ${this.escapeHtml(app.name)}
              ${isHighLoad ? '<span class="badge badge-burgundy" style="margin-left: 0.35rem; font-size: 0.65rem;">High Load</span>' : ''}
              ${hasAdv ? `<span class="badge badge-cooling" style="margin-left: 0.35rem; font-size: 0.65rem;" title="${this.escapeHtml(advDesc || 'Advanced usage profile active')}">Advanced</span>` : ''}
            </span>
            <span class="appliance-sub-qty">Qty: ${Number(app.quantity) || 1} unit${(Number(app.quantity) || 1) > 1 ? 's' : ''}</span>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${safeCat}</span>
        </td>
        <td>
          <strong>${Number(app.powerWatts) || 0} W</strong>
        </td>
        <td>
          ${Number(app.dailyHours) || 0} hrs / day
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${Number(app.operatingDays) || 30} days/mo</div>
          ${advDesc ? `<div style="font-size: 0.70rem; color: var(--royal-blue); margin-top: 0.15rem;" title="${this.escapeHtml(advDesc)}">${this.escapeHtml(advDesc)}</div>` : ''}
        </td>
        <td>
          <span class="kwh-val">${WattWatchCalculations.formatKwh(app.monthlyKwh)}</span>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${WattWatchCalculations.isFiniteNumber(app.dailyKwh) ? Number(app.dailyKwh).toFixed(2) : '--'} kWh/day</div>
        </td>
        <td>
          <span class="cost-val">${this.escapeHtml(WattWatchCalculations.formatCurrency(app.monthlyCost))}</span>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${WattWatchCalculations.isFiniteNumber(app.sharePercentage) ? Number(app.sharePercentage).toFixed(1) : '0.0'}% of bill</div>
        </td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Simulate Energy-Efficient Upgrade" data-action="simulate" data-id="${this.escapeHtml(app.id)}" aria-label="Simulate Replacement for ${uniqueAriaName}" style="color: var(--text-gold);">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Edit Appliance" data-action="edit" data-id="${this.escapeHtml(app.id)}" aria-label="Edit ${uniqueAriaName}">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Delete Appliance" data-action="delete" data-id="${this.escapeHtml(app.id)}" aria-label="Delete ${uniqueAriaName}" style="color: #A92639;">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  },

  _isRemovingAll: false,

  /**
   * Prompts user confirmation and removes all appliances from the active workspace only.
   * Works consistently in guest mode and authenticated mode without affecting other accounts.
   * Preserves billing history snapshots and settings intact.
   */
  removeAllAppliances() {
    if (this._isRemovingAll) return;

    const appliances = WattWatchStorage.getAppliances();
    if (!Array.isArray(appliances) || appliances.length === 0) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('No appliances in your active inventory to remove.', 'info', 'Inventory Empty');
      }
      return;
    }

    const count = appliances.length;
    const isGuest = WattWatchStorage.getActiveUser() === null;
    const workspaceDesc = isGuest ? 'Guest inventory' : 'Account inventory';

    WattWatchApp.openConfirmDialog({
      title: 'Remove All Appliances?',
      message: `Are you sure you want to remove all ${count} appliance(s) from your ${workspaceDesc}? This action cannot be undone. Only your active workspace inventory will be cleared; your historical billing snapshots and custom settings will remain completely untouched.`,
      confirmText: `Remove All (${count})`,
      cancelText: 'Cancel',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        try {
          this._isRemovingAll = true;
          // Save empty array to active workspace only
          const saved = WattWatchStorage.saveAppliances([]);
          if (!saved) {
            if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
              WattWatchApp.showToast('Failed to clear inventory in storage.', 'error', 'Clear Failed');
            }
            return;
          }

          if (typeof WattWatchApp !== 'undefined') {
            if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
            if (WattWatchApp.showToast) {
              WattWatchApp.showToast(`Removed all ${count} appliance(s) from active inventory.`, 'info', 'Inventory Cleared');
            }
          }
        } finally {
          this._isRemovingAll = false;
        }
      }
    });
  },

  simulateAppliance(id) {
    if (!id || typeof id !== 'string') {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('Cannot launch simulator: invalid appliance reference.', 'error', 'Appliance Missing');
      }
      return false;
    }

    const appliances = WattWatchStorage.getAppliances();
    const targetApp = appliances.find(a => a.id === id);
    if (!targetApp) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('Cannot launch simulator: this appliance was removed or no longer exists in your inventory.', 'error', 'Appliance Missing');
      }
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.refreshAll) {
        WattWatchApp.refreshAll();
      }
      return false;
    }

    if (typeof WattWatchSimulator !== 'undefined') {
      WattWatchSimulator._activeScenarioPreview = null;
    }
    WattWatchApp.navigateTo('simulator');
    const select = document.getElementById('simApplianceSelect');
    if (select) {
      select.value = targetApp.id;
      WattWatchSimulator.handleApplianceSelect();
    }
    const focusTarget = document.getElementById('simAltWatts') || select;
    if (focusTarget && !focusTarget.disabled && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (_) {}
    }
    return true;
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchAppliances = WattWatchAppliances;
}
