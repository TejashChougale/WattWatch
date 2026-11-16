/**
 * WATTWATCH - Simulators Module
 * Contains the Appliance Replacement Simulator and the Advanced Electricity Tariff Calculator.
 */

const WattWatchSimulator = {
  _eventsBound: false,

  init() {
    this.bindReplacementEvents();
    this.bindTariffEvents();
  },

  /**
   * Binds Appliance Replacement Simulator controls
   */
  bindReplacementEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const applianceSelect = document.getElementById('simApplianceSelect');
    if (applianceSelect) {
      applianceSelect.addEventListener('change', () => this.handleApplianceSelect());
    }

    const triggerInputs = ['simAltWatts', 'simAltHours', 'simAltDays', 'simAltQty', 'simPurchaseCost'];
    triggerInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.calculateReplacement());
    });
  },

  /**
   * Populates appliance dropdown for replacement simulator
   */
  populateApplianceSelect() {
    const select = document.getElementById('simApplianceSelect');
    if (!select) return;

    const appliances = WattWatchStorage.getAppliances();
    const curVal = select.value;

    select.innerHTML = '<option value="">-- Choose an appliance from your inventory --</option>';
    appliances.forEach(app => {
      const opt = document.createElement('option');
      opt.value = app.id;
      opt.textContent = `${app.name} (${app.powerWatts}W, ${app.dailyHours}h/day, ${app.quantity} qty)`;
      select.appendChild(opt);
    });

    if (curVal && appliances.some(a => a.id === curVal)) {
      select.value = curVal;
    } else if (appliances.length > 0) {
      select.value = appliances[0].id;
    }

    this.handleApplianceSelect();
  },

  /**
   * Auto-fills baseline details when an appliance is chosen
   */
  handleApplianceSelect() {
    const select = document.getElementById('simApplianceSelect');
    if (!select) return;

    const id = select.value;
    const appliances = WattWatchStorage.getAppliances();
    const app = appliances.find(a => a.id === id);

    const baseInfo = document.getElementById('simBaselineInfo');
    if (!app) {
      if (baseInfo) baseInfo.innerHTML = '<span style="color: var(--text-secondary);">Select an appliance to view current baseline ratings.</span>';
      return;
    }

    const settings = WattWatchStorage.getSettings();
    const curAppliances = WattWatchStorage.getAppliances();
    const curSummary = WattWatchCalculations.calculateHouseholdSummary(curAppliances, settings);
    const enriched = curSummary.appliances.find(a => a.id === id) || WattWatchCalculations.enrichAppliance(app, curSummary.effectiveRatePerKwh);

    if (baseInfo) {
      baseInfo.innerHTML = `
        <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; margin-bottom: 0.35rem;">
          ${WattWatchAppliances.escapeHtml(app.name)}
        </div>
        <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.5;">
          <strong>${Number(app.powerWatts) || 0} Watts</strong> · ${Number(app.dailyHours) || 0} hrs/day · ${Number(app.operatingDays) || 30} days/mo · ${Number(app.quantity) || 1} unit(s)<br>
          Current Monthly Energy: <strong style="color: var(--royal-blue);">${WattWatchCalculations.formatKwh(enriched.monthlyKwh)}</strong><br>
          Current Monthly Cost: <strong style="color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(enriched.monthlyCost)}</strong>${settings.tariffModel === 'slab' ? ` <span style="font-size: 0.72rem; color: var(--text-secondary);">(at ₹${curSummary.effectiveRatePerKwh.toFixed(2)}/u eff.)</span>` : ''}
        </div>
      `;
    }

    // Default replacement inputs to baseline operational schedule if empty
    const hoursInput = document.getElementById('simAltHours');
    const daysInput = document.getElementById('simAltDays');
    const qtyInput = document.getElementById('simAltQty');

    if (hoursInput && !hoursInput.value) hoursInput.value = app.dailyHours;
    if (daysInput && !daysInput.value) daysInput.value = app.operatingDays;
    if (qtyInput && !qtyInput.value) qtyInput.value = app.quantity;

    this.calculateReplacement();
  },

  /**
   * Executes replacement comparison and updates simulation UI
   */
  calculateReplacement() {
    const select = document.getElementById('simApplianceSelect');
    const id = select?.value;
    const appliances = WattWatchStorage.getAppliances();
    const baseApp = appliances.find(a => a.id === id);

    const resultBox = document.getElementById('simResultsContainer');
    if (!resultBox) return;

    if (!baseApp) {
      resultBox.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Select an existing appliance to run replacement simulation.</div>';
      return;
    }

    const parseSimInput = (val, defaultVal) => {
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        return defaultVal;
      }
      const num = Number(val);
      return Number.isFinite(num) ? num : NaN;
    };

    const altWatts = parseSimInput(document.getElementById('simAltWatts')?.value, NaN);
    const altHours = parseSimInput(document.getElementById('simAltHours')?.value, baseApp.dailyHours);
    const altDays = parseSimInput(document.getElementById('simAltDays')?.value, baseApp.operatingDays);
    const altQty = parseSimInput(document.getElementById('simAltQty')?.value, baseApp.quantity);
    const purchaseCost = parseSimInput(document.getElementById('simPurchaseCost')?.value, 0);

    if (isNaN(altWatts) || altWatts <= 0) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--antique-gold)" stroke-width="1.5" style="margin-bottom: 0.5rem;">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <div style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--text-primary);">Enter Alternative Power Rating</div>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Specify the wattage of the prospective energy-efficient model above to calculate estimated savings.</p>
        </div>
      `;
      return;
    }

    const settings = WattWatchStorage.getSettings();
    const curAppliances = WattWatchStorage.getAppliances();
    const curSummary = WattWatchCalculations.calculateHouseholdSummary(curAppliances, settings);

    const sim = WattWatchCalculations.simulateReplacement(
      baseApp,
      altWatts,
      altHours,
      altDays,
      altQty,
      settings,
      purchaseCost,
      curSummary.totalMonthlyKwh
    );

    if (!sim || !sim.isValid) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          ${WattWatchAppliances.escapeHtml(sim?.error || 'Invalid simulation input parameters. Please verify that daily usage hours are between 0 and 24, operating days are between 0 and 31, quantity is a non-negative integer, and purchase cost is non-negative.')}
        </div>
      `;
      return;
    }

    const isSaving = sim.savings.isSaving;
    const percentStr = `${Math.abs(sim.savings.percentSaved).toFixed(1)}%`;
    const paybackInfo = sim.savings.paybackMonths !== null
      ? `<div style="font-size: 0.85rem; color: var(--text-gold); font-weight: 600; margin-top: 0.4rem;">
          Est. Payback Period: ${sim.savings.paybackMonths < 1 ? 'Under 1 Month' : sim.savings.paybackMonths.toFixed(1) + ' Months'} (${sim.tariffMode === 'slab' ? 'at active slab tariff' : 'at ₹' + Number(sim.effectiveRate).toFixed(2) + '/u'})
        </div>`
      : '';

    resultBox.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1.5rem;">
        <div class="metric-card">
          <span class="metric-title">Baseline Model</span>
          <div class="metric-value">${WattWatchCalculations.formatCurrency(sim.baseline.monthlyCost)}</div>
          <div class="metric-subtext">${sim.baseline.monthlyKwh.toFixed(2)} kWh/mo · ${sim.baseline.watts}W</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">Replacement Model</span>
          <div class="metric-value" style="color: ${isSaving ? 'var(--royal-blue)' : 'var(--deep-burgundy)'};">
            ${WattWatchCalculations.formatCurrency(sim.replacement.monthlyCost)}
          </div>
          <div class="metric-subtext">${sim.replacement.monthlyKwh.toFixed(2)} kWh/mo · ${sim.replacement.watts}W</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Monthly Savings</span>
            <span class="badge ${isSaving ? 'badge-cooling' : 'badge-burgundy'}">${isSaving ? '▼ ' + percentStr : '▲ Higher'}</span>
          </div>
          <div class="metric-value" style="color: ${isSaving ? 'var(--deep-burgundy)' : 'var(--text-primary)'};">
            ${isSaving ? '+' : '-'}${WattWatchCalculations.formatCurrency(Math.abs(sim.savings.monthlyCostSaved))}
          </div>
          <div class="metric-subtext">${isSaving ? (sim.tariffMode === 'slab' ? `Slab marginal savings (${sim.savings.monthlyKwhSaved.toFixed(1)} kWh)` : `Saves ${sim.savings.monthlyKwhSaved.toFixed(1)} kWh/mo`) : 'Consumes more energy'}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Annualized Savings</span>
            <span class="badge badge-gold">12 Months</span>
          </div>
          <div class="metric-value" style="color: var(--text-gold);">
            ${isSaving ? '+' : '-'}${WattWatchCalculations.formatCurrency(Math.abs(sim.savings.annualCostSaved))}
          </div>
          <div class="metric-subtext">${isSaving ? 'Saves ' + sim.savings.annualKwhSaved.toFixed(1) + ' kWh/year' : 'Additional yearly cost'}</div>
        </div>
      </div>

      ${paybackInfo ? `<div class="card" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem; background: var(--antique-gold-subtle); border-color: var(--antique-gold);">${paybackInfo}</div>` : ''}

      <div class="disclaimer-banner">
        <svg class="disclaimer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>Efficiency Simulation Disclaimer:</strong> Calculations compare physical energy consumption based on user-entered wattages and hours. Actual appliance draw may vary based on temperature, compressor duty cycles, BEE star ratings, and real-world conditions.
        </div>
      </div>
    `;
  },

  /**
   * Advanced Tariff Calculator Events & Sandbox
   */
  bindTariffEvents() {
    const modelSelect = document.getElementById('calcTariffModelSelect');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        const isSlab = e.target.value === 'slab';
        const slabContainer = document.getElementById('tariffSlabsEditorGroup');
        if (slabContainer) slabContainer.style.display = isSlab ? 'block' : 'none';
        this.runTariffCalculation();
      });
    }

    const inputs = ['calcFixedCharges', 'calcTaxPercent', 'calcFlatRateInput', 'calcTestKwhInput'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.runTariffCalculation());
    });

    const btnAddSlab = document.getElementById('btnAddTariffSlab');
    if (btnAddSlab) {
      btnAddSlab.addEventListener('click', () => this.addNewSlabRow());
    }

    const btnApplySettings = document.getElementById('btnApplyTariffToSettings');
    if (btnApplySettings) {
      btnApplySettings.addEventListener('click', () => this.applyTariffToSettings());
    }

    // Safe delegated click listener for removing slab rows
    const slabTableBody = document.getElementById('tariffSlabsTableBody');
    if (slabTableBody) {
      slabTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-slab"]');
        if (!btn) return;
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          this.removeSlabRow(idx);
        }
      });
    }
  },

  /**
   * Initializes Tariff Sandbox with current settings
   */
  populateTariffSandbox() {
    const settings = WattWatchStorage.getSettings();
    const modelSelect = document.getElementById('calcTariffModelSelect');
    const flatInput = document.getElementById('calcFlatRateInput');
    const fixedInput = document.getElementById('calcFixedCharges');
    const taxInput = document.getElementById('calcTaxPercent');
    const slabGroup = document.getElementById('tariffSlabsEditorGroup');

    const valRate = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTariffRate(settings.electricityRate, 8.00)
      : Number(settings.electricityRate || 8.00);
    const flatRate = !isNaN(valRate) ? valRate : 8.00;

    const valFixed = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateFixedCharge(settings.fixedCharges, 110.00)
      : Number(settings.fixedCharges || 110.00);
    const fixedCharges = !isNaN(valFixed) ? valFixed : 110.00;

    const valTax = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTaxPercent(settings.additionalTaxPercent, 5.0)
      : Number(settings.additionalTaxPercent || 5.0);
    const taxPercent = !isNaN(valTax) ? valTax : 5.0;

    if (modelSelect) modelSelect.value = settings.tariffModel || 'flat';
    if (flatInput) flatInput.value = flatRate.toFixed(2);
    if (fixedInput) fixedInput.value = fixedCharges.toFixed(2);
    if (taxInput) taxInput.value = taxPercent.toFixed(1);

    if (slabGroup) slabGroup.style.display = settings.tariffModel === 'slab' ? 'block' : 'none';

    this.renderSlabRows(settings.slabConfig || []);

    // Set test kWh to current household total monthly kWh
    const testKwhInput = document.getElementById('calcTestKwhInput');
    if (testKwhInput) {
      const appliances = WattWatchStorage.getAppliances();
      const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
      testKwhInput.value = summary.totalMonthlyKwh > 0 ? summary.totalMonthlyKwh.toFixed(1) : '350.0';
    }

    this.runTariffCalculation();
  },

  /**
   * Renders editable slab rows in the table
   */
  renderSlabRows(slabs) {
    const tbody = document.getElementById('tariffSlabsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    slabs.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const isLast = idx === slabs.length - 1;

      tr.innerHTML = `
        <td style="font-weight: 600;">Tier ${idx + 1}</td>
        <td>
          ${isLast && s.upTo === null
            ? '<span style="font-size: 0.85rem; color: var(--text-secondary);">Above previous limit (Open)</span><input type="hidden" class="slab-upto-input" value="null">'
            : `<input type="number" class="form-control slab-upto-input" value="${s.upTo || 100}" min="1" step="50" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;">`
          }
        </td>
        <td>
          <input type="number" class="form-control slab-rate-input" value="${Number(s.rate).toFixed(2)}" min="0.5" step="0.25" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;">
        </td>
        <td>
          ${slabs.length > 1
            ? `<button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="remove-slab" data-index="${idx}" title="Remove Tier" style="color: #A92639;">&times;</button>`
            : '<span style="color: var(--text-secondary);">—</span>'
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Re-bind change listeners
    tbody.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => this.runTariffCalculation());
    });
  },

  addNewSlabRow() {
    const currentSlabs = this.readCurrentSlabsFromUI();
    const last = currentSlabs[currentSlabs.length - 1];
    const prevLimit = (last && last.upTo !== null) ? last.upTo : (currentSlabs.length * 150);

    // Make previous last have a numeric limit
    if (last && last.upTo === null) {
      last.upTo = prevLimit + 100;
    }

    currentSlabs.push({ upTo: null, rate: (last ? last.rate + 2.0 : 10.0) });
    this.renderSlabRows(currentSlabs);
    this.runTariffCalculation();
  },

  removeSlabRow(idx) {
    const currentSlabs = this.readCurrentSlabsFromUI();
    if (currentSlabs.length <= 1) return;
    currentSlabs.splice(idx, 1);
    // ensure last slab is open-ended
    currentSlabs[currentSlabs.length - 1].upTo = null;
    this.renderSlabRows(currentSlabs);
    this.runTariffCalculation();
  },

  readCurrentSlabsFromUI() {
    const tbody = document.getElementById('tariffSlabsTableBody');
    if (!tbody) return [];

    const rows = tbody.querySelectorAll('tr');
    const slabs = [];

    rows.forEach(r => {
      const upToInp = r.querySelector('.slab-upto-input');
      const rateInp = r.querySelector('.slab-rate-input');

      const val = upToInp ? upToInp.value : null;
      const upTo = (val === 'null' || val === '' || isNaN(Number(val))) ? null : Number(val);
      const rate = rateInp ? (parseFloat(rateInp.value) || 5.0) : 5.0;

      slabs.push({ upTo, rate });
    });

    return slabs;
  },

  /**
   * Executes advanced tariff computation and displays detailed bill breakdown
   */
  runTariffCalculation() {
    const rawTestKwh = document.getElementById('calcTestKwhInput')?.value;
    const testKwh = (rawTestKwh !== undefined && rawTestKwh !== null && rawTestKwh.trim() !== '') ? Number(rawTestKwh) : 0;
    const model = document.getElementById('calcTariffModelSelect')?.value || 'flat';
    const rawFlat = document.getElementById('calcFlatRateInput')?.value;
    const flatRate = (rawFlat !== undefined && rawFlat !== null && rawFlat.trim() !== '') ? Number(rawFlat) : 8.00;
    const rawFixed = document.getElementById('calcFixedCharges')?.value;
    const fixedCharges = (rawFixed !== undefined && rawFixed !== null && rawFixed.trim() !== '') ? Number(rawFixed) : 0;
    const rawTax = document.getElementById('calcTaxPercent')?.value;
    const taxPercent = (rawTax !== undefined && rawTax !== null && rawTax.trim() !== '') ? Number(rawTax) : 0;
    const slabs = this.readCurrentSlabsFromUI();

    const mockSettings = {
      tariffModel: model,
      electricityRate: flatRate,
      fixedCharges,
      additionalTaxPercent: taxPercent,
      slabConfig: slabs
    };

    const result = WattWatchCalculations.calculateAdvancedTariff(testKwh, mockSettings);

    const breakdownBox = document.getElementById('tariffCalculationBreakdown');
    if (!breakdownBox) return;

    if (!result || !result.isValid) {
      breakdownBox.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          Unable to compute tariff breakdown. ${WattWatchAppliances.escapeHtml(result?.error || 'Please verify that electricity rate, fixed charges, tax percentage (0-100%), and slab boundaries are valid positive numbers.')}
        </div>
      `;
      return;
    }

    let slabRowsHtml = '';
    result.slabBreakdown.forEach(s => {
      slabRowsHtml += `
        <tr>
          <td>${s.label}</td>
          <td>${s.units.toFixed(2)} kWh</td>
          <td>₹${s.rate.toFixed(2)}/u</td>
          <td style="font-weight: 600;">₹${s.cost.toFixed(2)}</td>
        </tr>
      `;
    });

    breakdownBox.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
        <div style="background: var(--soft-blue); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Energy Base Cost</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--royal-blue);">${WattWatchCalculations.formatCurrency(result.energyCharges)}</div>
        </div>

        <div style="background: var(--antique-gold-subtle); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Fixed + Duty (${result.taxPercent}%)</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--text-gold);">${WattWatchCalculations.formatCurrency(result.fixedCharge + result.taxCharges)}</div>
        </div>

        <div style="background: var(--light-burgundy); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Estimated Bill</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(result.totalCost)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">Effective Rate: ₹${result.effectiveRatePerKwh.toFixed(2)}/kWh</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="appliance-table" style="font-size: 0.825rem;">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Units in Slab</th>
              <th>Tier Rate</th>
              <th>Slab Cost</th>
            </tr>
          </thead>
          <tbody>
            ${slabRowsHtml}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Applies sandbox tariff configuration to permanent system settings
   */
  applyTariffToSettings() {
    const model = document.getElementById('calcTariffModelSelect')?.value || 'flat';
    const rawFlat = document.getElementById('calcFlatRateInput')?.value;
    const rawFixed = document.getElementById('calcFixedCharges')?.value;
    const rawTax = document.getElementById('calcTaxPercent')?.value;

    const flatRate = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTariffRate(rawFlat, NaN)
      : Number(rawFlat);
    const fixedCharges = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateFixedCharge(rawFixed, NaN)
      : Number(rawFixed);
    const taxPercent = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTaxPercent(rawTax, NaN)
      : Number(rawTax);

    if (isNaN(flatRate) || isNaN(fixedCharges) || isNaN(taxPercent)) {
      WattWatchApp.showToast('Cannot apply settings: please enter valid non-negative numbers (tax must be 0-100%).', 'error', 'Invalid Tariff');
      return;
    }

    const slabs = this.readCurrentSlabsFromUI();
    if (model === 'slab' && typeof WattWatchCalculations !== 'undefined') {
      const testTariff = WattWatchCalculations.calculateAdvancedTariff(100, {
        tariffModel: 'slab',
        electricityRate: flatRate,
        fixedCharges,
        additionalTaxPercent: taxPercent,
        slabConfig: slabs
      });
      if (!testTariff.isValid) {
        WattWatchApp.showToast('Cannot apply settings: slab configuration is invalid. Verify progressive thresholds and non-negative rates.', 'error', 'Invalid Slabs');
        return;
      }
    }

    WattWatchStorage.saveSettings({
      tariffModel: model,
      electricityRate: flatRate,
      fixedCharges,
      additionalTaxPercent: taxPercent,
      slabConfig: slabs
    });

    WattWatchApp.showToast(`Applied ${model === 'slab' ? 'Slab-based' : 'Flat'} tariff to system settings`, 'success', 'Tariff Applied');
    WattWatchApp.refreshAll();
  }
};
