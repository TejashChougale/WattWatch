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
        filterContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
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

    // Modal Live Preview Input Triggers
    const modalInputs = ['modalPowerWatts', 'modalQuantity', 'modalDailyHours', 'modalOperatingDays'];
    modalInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateModalLivePreview());
      }
    });

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

  /**
   * Calculates and refreshes the live calculation preview box inside the modal
   */
  updateModalLivePreview() {
    const power = parseFloat(document.getElementById('modalPowerWatts')?.value) || 0;
    const qty = parseInt(document.getElementById('modalQuantity')?.value, 10) || 0;
    const hours = parseFloat(document.getElementById('modalDailyHours')?.value) || 0;
    const days = parseInt(document.getElementById('modalOperatingDays')?.value, 10) || 0;

    const settings = WattWatchStorage.getSettings();
    let rate = 8.00;
    if (settings.tariffModel === 'slab') {
      const curAppliances = WattWatchStorage.getAppliances();
      const curSummary = WattWatchCalculations.calculateHouseholdSummary(curAppliances, settings);
      rate = curSummary.effectiveRatePerKwh;
    } else {
      const rawRate = Number(settings.electricityRate);
      rate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate) && rawRate >= 0)
        ? rawRate
        : 8.00;
    }

    const dailyKwh = WattWatchCalculations.calculateDailyKwh(power, qty, hours);
    const monthlyKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, hours, days);
    const monthlyCost = WattWatchCalculations.calculateCost(monthlyKwh, rate);

    const elDaily = document.getElementById('previewDailyKwh');
    const elMonthly = document.getElementById('previewMonthlyKwh');
    const elCost = document.getElementById('previewMonthlyCost');

    if (elDaily) elDaily.textContent = `${dailyKwh.toFixed(2)} kWh`;
    if (elMonthly) elMonthly.textContent = `${monthlyKwh.toFixed(2)} kWh`;
    if (elCost) elCost.textContent = `₹${monthlyCost.toFixed(2)}`;
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
    const power = parseFloat(powerInput.value);
    const qty = parseInt(qtyInput.value, 10);
    const hours = parseFloat(hoursInput.value);
    const days = parseInt(daysInput.value, 10);

    // Validate Name
    if (!name) {
      this.showFieldError('modalApplianceName', 'Appliance name is required');
      isValid = false;
    } else if (name.length > 80) {
      this.showFieldError('modalApplianceName', 'Name cannot exceed 80 characters');
      isValid = false;
    }

    // Validate Category
    if (!category) {
      this.showFieldError('modalCategory', 'Please select a valid category');
      isValid = false;
    }

    // Validate Power
    if (isNaN(power) || power <= 0) {
      this.showFieldError('modalPowerWatts', 'Power must be greater than 0 Watts');
      isValid = false;
    } else if (power > 50000) {
      this.showFieldError('modalPowerWatts', 'Power rating seems unrealistically high (max 50,000 W)');
      isValid = false;
    }

    // Validate Quantity
    if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      this.showFieldError('modalQuantity', 'Quantity must be a positive whole number (min 1)');
      isValid = false;
    } else if (qty > 100) {
      this.showFieldError('modalQuantity', 'Quantity cannot exceed 100');
      isValid = false;
    }

    // Validate Daily Hours
    if (isNaN(hours) || hours < 0 || hours > 24) {
      this.showFieldError('modalDailyHours', 'Daily usage hours must be between 0 and 24');
      isValid = false;
    }

    // Validate Operating Days
    if (isNaN(days) || days < 1 || days > 31 || !Number.isInteger(days)) {
      this.showFieldError('modalOperatingDays', 'Operating days must be an integer between 1 and 31');
      isValid = false;
    }

    if (!isValid) return null;

    return {
      name,
      category,
      powerWatts: power,
      quantity: qty,
      dailyHours: hours,
      operatingDays: days
    };
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

      document.getElementById('modalApplianceName').value = existing.name;
      document.getElementById('modalCategory').value = existing.category;
      document.getElementById('modalPowerWatts').value = existing.powerWatts;
      document.getElementById('modalQuantity').value = existing.quantity;
      document.getElementById('modalDailyHours').value = existing.dailyHours;
      document.getElementById('modalOperatingDays').value = existing.operatingDays;

      if (presetSelect) presetSelect.value = '';
    } else {
      if (titleEl) titleEl.textContent = 'Add New Appliance';
      if (submitBtn) submitBtn.textContent = 'Save Appliance';

      document.getElementById('applianceForm').reset();
      document.getElementById('modalQuantity').value = '1';
      document.getElementById('modalOperatingDays').value = '30';
      document.getElementById('modalDailyHours').value = '4';
      if (presetSelect) presetSelect.value = '';
    }

    this.updateModalLivePreview();

    const backdrop = document.getElementById('applianceModal');
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.getElementById('modalApplianceName')?.focus();
    }
  },

  /**
   * Closes the modal
   */
  closeModal() {
    const backdrop = document.getElementById('applianceModal');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
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
      // Update existing
      const index = appliances.findIndex(a => a.id === this.editingApplianceId);
      if (index !== -1) {
        appliances[index] = {
          ...appliances[index],
          ...payload,
          updatedAt: Date.now()
        };
        WattWatchStorage.saveAppliances(appliances);
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
      WattWatchStorage.saveAppliances(appliances);
      WattWatchApp.showToast(`"${payload.name}" added to inventory`, 'success', 'Appliance Added');
    }

    this.closeModal();
    WattWatchApp.refreshAll();
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
    WattWatchStorage.saveAppliances(updated);
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
      case 'power_desc':
        list.sort((a, b) => b.powerWatts - a.powerWatts);
        break;
      case 'hours_desc':
        list.sort((a, b) => b.dailyHours - a.dailyHours);
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
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
    if (!tbody) return;

    const rawAppliances = WattWatchStorage.getAppliances();
    const settings = WattWatchStorage.getSettings();

    const filteredList = this.getFilteredAndSortedAppliances(rawAppliances, settings);

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

    filteredList.forEach(app => {
      const tr = document.createElement('tr');
      const badgeClass = `badge-${app.category.toLowerCase()}`;

      tr.innerHTML = `
        <td>
          <div class="appliance-name-cell">
            <span class="appliance-main-name">${this.escapeHtml(app.name)}</span>
            <span class="appliance-sub-qty">Qty: ${app.quantity} unit${app.quantity > 1 ? 's' : ''}</span>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${app.category}</span>
        </td>
        <td>
          <strong>${app.powerWatts} W</strong>
        </td>
        <td>
          ${app.dailyHours} hrs / day
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${app.operatingDays} days/mo</div>
        </td>
        <td>
          <span class="kwh-val">${WattWatchCalculations.formatKwh(app.monthlyKwh)}</span>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${app.dailyKwh.toFixed(2)} kWh/day</div>
        </td>
        <td>
          <span class="cost-val">${WattWatchCalculations.formatCurrency(app.monthlyCost)}</span>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${app.sharePercentage.toFixed(1)}% of bill</div>
        </td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Simulate Energy-Efficient Upgrade" data-action="simulate" data-id="${this.escapeHtml(app.id)}" aria-label="Simulate Replacement for ${this.escapeHtml(app.name)}" style="color: var(--text-gold);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Edit Appliance" data-action="edit" data-id="${this.escapeHtml(app.id)}" aria-label="Edit ${this.escapeHtml(app.name)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Delete Appliance" data-action="delete" data-id="${this.escapeHtml(app.id)}" aria-label="Delete ${this.escapeHtml(app.name)}" style="color: #A92639;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

  simulateAppliance(id) {
    WattWatchApp.navigateTo('simulator');
    const select = document.getElementById('simApplianceSelect');
    if (select) {
      select.value = id;
      WattWatchSimulator.handleApplianceSelect();
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
