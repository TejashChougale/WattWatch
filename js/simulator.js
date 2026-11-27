/**
 * WATTWATCH - Simulators Module
 * Contains the Appliance Replacement Simulator and the Advanced Electricity Tariff Calculator.
 */

const WattWatchSimulator = {
  _eventsBound: false,
  _activeScenarioPreview: null,
  _isApplyingScenario: false,

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
      applianceSelect.addEventListener('change', () => {
        if (!this._isApplyingScenario) {
          this._activeScenarioPreview = null;
        }
        this.handleApplianceSelect();
      });
    }

    const triggerInputs = ['simAltWatts', 'simAltHours', 'simAltDays', 'simAltQty', 'simPurchaseCost'];
    triggerInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (!this._isApplyingScenario && id === 'simAltWatts' && this._activeScenarioPreview) {
            // If user manually alters replacement wattage on a runtime/standby scenario, preserve standby elimination only if unchanged
            if (this._activeScenarioPreview.scenarioType === 'standby' && Number(el.value) !== Number(this._activeScenarioPreview.targetWatts)) {
              this._activeScenarioPreview = null;
            }
          }
          this.calculateReplacement();
        });
      }
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

    const isEmpty = appliances.length === 0;
    const simControlIds = ['simApplianceSelect', 'simAltWatts', 'simAltHours', 'simAltDays', 'simAltQty', 'simPurchaseCost'];
    simControlIds.forEach(cid => {
      const el = document.getElementById(cid);
      if (el) el.disabled = isEmpty;
    });

    if (curVal && appliances.some(a => a.id === curVal)) {
      select.value = curVal;
    } else if (appliances.length > 0) {
      select.value = appliances[0].id;
    } else {
      select.value = '';
      this._activeScenarioPreview = null;
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

    const hoursInput = document.getElementById('simAltHours');
    const daysInput = document.getElementById('simAltDays');
    const qtyInput = document.getElementById('simAltQty');
    const wattsInput = document.getElementById('simAltWatts');
    const costInput = document.getElementById('simPurchaseCost');

    if (this._activeScenarioPreview && this._activeScenarioPreview.applianceId !== id) {
      this._activeScenarioPreview = null;
    }

    const baseInfo = document.getElementById('simBaselineInfo');
    if (!app) {
      if (baseInfo) {
        baseInfo.innerHTML = appliances.length === 0
          ? '<span style="color: var(--text-secondary);">Simulator unavailable: add at least one appliance to your inventory to evaluate replacements or What-If scenarios.</span>'
          : '<span style="color: var(--text-secondary);">Select an appliance to view current baseline ratings.</span>';
      }
      if (appliances.length === 0) {
        if (wattsInput) wattsInput.value = '';
        if (hoursInput) hoursInput.value = '';
        if (daysInput) daysInput.value = '';
        if (qtyInput) qtyInput.value = '1';
        if (costInput) costInput.value = '';
      }
      this._autofilledBaseline = null;
      this.calculateReplacement();
      return;
    }

    const settings = WattWatchStorage.getSettings();
    const curSummary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const enriched = curSummary.appliances.find(a => a.id === id) || WattWatchCalculations.enrichAppliance(app, curSummary.effectiveRatePerKwh);

    const prevAutofill = this._autofilledBaseline;
    const shouldSyncField = (input, prevVal) => {
      if (!input) return false;
      if (!input.value) return true;
      return prevAutofill && prevVal !== undefined && input.value === String(prevVal);
    };

    if (!this._isApplyingScenario) {
      if (shouldSyncField(hoursInput, prevAutofill?.hours)) hoursInput.value = app.dailyHours;
      if (shouldSyncField(daysInput, prevAutofill?.days)) daysInput.value = app.operatingDays;
      if (shouldSyncField(qtyInput, prevAutofill?.qty)) qtyInput.value = app.quantity;
    }

    this._autofilledBaseline = {
      id: app.id,
      hours: app.dailyHours,
      days: app.operatingDays,
      qty: app.quantity
    };

    if (baseInfo) {
      const validCurr = WattWatchCalculations.resolveValidatedCurrency(settings?.currency);
      const hasAdv = enriched.metrics && enriched.metrics.hasAdvancedProfile;
      const advTag = hasAdv ? ' <span class="badge badge-cooling" style="font-size: 0.65rem; margin-left: 0.35rem;">Advanced Profile</span>' : '';
      baseInfo.innerHTML = `
        <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem; margin-bottom: 0.35rem;">
          ${WattWatchAppliances.escapeHtml(app.name)}${advTag}
        </div>
        <div style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.5;">
          <strong>${Number(app.powerWatts) || 0} Watts</strong> · ${Number(app.dailyHours) || 0} hrs/day · ${Number(app.operatingDays) || 30} days/mo · ${Number(app.quantity) || 1} unit(s)<br>
          Current Monthly Energy: <strong style="color: var(--royal-blue);">${WattWatchCalculations.formatKwh(enriched.monthlyKwh)}</strong><br>
          Current Monthly Cost: <strong style="color: var(--deep-burgundy);">${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatOptionalCurrency(enriched.monthlyCost, validCurr))}</strong>${settings.tariffModel === 'slab' ? ` <span style="font-size: 0.72rem; color: var(--text-secondary);">(at ${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatRateWithCurrency(curSummary.effectiveRatePerKwh, validCurr, '/u'))} eff.)</span>` : ''}
        </div>
      `;
    }

    this.calculateReplacement();
  },

  /**
   * Triggers subtle highlight pulse when simulation or tariff output refreshes
   * @param {HTMLElement|null} el
   */
  _triggerFlash(el) {
    if (!el || typeof window === 'undefined') return;
    const reduced = (typeof WattWatchApp !== 'undefined' && typeof WattWatchApp._prefersReducedMotion === 'function' && WattWatchApp._prefersReducedMotion()) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced) return;
    el.classList.remove('panel-flash');
    void el.offsetWidth;
    el.classList.add('panel-flash');
  },

  /**
   * Executes replacement comparison and updates simulation UI (preview-only; never mutates inventory)
   */
  calculateReplacement() {
    const select = document.getElementById('simApplianceSelect');
    const id = select?.value;
    const appliances = WattWatchStorage.getAppliances();
    const baseApp = appliances.find(a => a.id === id);

    const resultBox = document.getElementById('simResultsContainer');
    if (!resultBox) return;

    if (appliances.length === 0) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
          <div style="font-family: var(--font-serif); font-size: 1.05rem; color: var(--text-primary); margin-bottom: 0.35rem;">Simulator Unavailable</div>
          <p style="font-size: 0.85rem; margin: 0;">Add at least one appliance to your inventory to simulate replacement hardware or preview What-If optimization scenarios.</p>
        </div>
      `;
      return;
    }

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

    const validAltWatts = WattWatchCalculations.validatePowerWatts(altWatts, NaN, WattWatchCalculations.APPLIANCE_LIMITS.minWatts);
    if (isNaN(validAltWatts)) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
          <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--antique-gold)" stroke-width="1.5" style="margin-bottom: 0.5rem;">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <div style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--text-primary);">Enter Alternative Power Rating</div>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Specify a valid wattage (${WattWatchCalculations.APPLIANCE_LIMITS.minWatts}–${WattWatchCalculations.APPLIANCE_LIMITS.maxWatts.toLocaleString()}W) for the prospective energy-efficient model above to calculate estimated savings.</p>
        </div>
      `;
      return;
    }

    const settings = WattWatchStorage.getSettings();
    const curAppliances = WattWatchStorage.getAppliances();
    const curSummary = WattWatchCalculations.calculateHouseholdSummary(curAppliances, settings);

    const activeScenario = (this._activeScenarioPreview && this._activeScenarioPreview.applianceId === baseApp.id)
      ? this._activeScenarioPreview
      : null;

    // In both What-If and manual mode, preserve untouched advanced schedule/efficiency fields so preview matches commit
    const simOpts = activeScenario
      ? {
          baseStandbyWatts: activeScenario.baseStandbyWatts,
          altStandbyWatts: activeScenario.targetStandbyWatts !== undefined ? activeScenario.targetStandbyWatts : baseApp.standbyWatts,
          altDutyCyclePercent: activeScenario.targetDutyCyclePercent !== undefined ? activeScenario.targetDutyCyclePercent : baseApp.dutyCyclePercent,
          altActiveDaysPerWeek: activeScenario.targetActiveDaysPerWeek !== undefined ? activeScenario.targetActiveDaysPerWeek : baseApp.activeDaysPerWeek,
          preserveSplitHours: activeScenario.preserveSplitHours !== false,
          includeTaxInFlat: true
        }
      : {
          altStandbyWatts: baseApp.standbyWatts,
          altDutyCyclePercent: baseApp.dutyCyclePercent,
          altActiveDaysPerWeek: baseApp.activeDaysPerWeek,
          preserveSplitHours: true,
          includeTaxInFlat: true
        };

    const sim = WattWatchCalculations.simulateReplacement(
      baseApp,
      validAltWatts,
      altHours,
      altDays,
      altQty,
      settings,
      purchaseCost,
      curSummary.totalMonthlyKwh,
      simOpts
    );

    if (!sim || !sim.isValid) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          ${WattWatchAppliances.escapeHtml(sim?.error || 'Invalid simulation input parameters. Please verify that daily usage hours are between 0 and 24, operating days are between 1 and 31, quantity is an integer 1–100, and purchase cost is non-negative.')}
        </div>
      `;
      return;
    }

    const validCurr = WattWatchCalculations.resolveValidatedCurrency(settings?.currency);
    const fmtMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);
    const fmtRate = (r) => WattWatchCalculations.formatRateWithCurrency(r, validCurr, '/u');
    const isCostSaving = sim.savings.monthlyCostSaved > 0;
    const isEnergySaving = sim.savings.monthlyKwhSaved > 0;
    const isNeutralBillSaving = isEnergySaving && !isCostSaving;
    const percentStr = `${Math.abs(sim.savings.percentSaved).toFixed(1)}%`;
    const paybackInfo = sim.savings.paybackMonths !== null
      ? `<div style="font-size: 0.85rem; color: var(--text-gold); font-weight: 600; margin-top: 0.4rem;">
          Est. Payback Period: ${sim.savings.paybackMonths < 1 ? 'Under 1 Month' : sim.savings.paybackMonths.toFixed(1) + ' Months'} (${sim.tariffMode === 'slab' ? 'at active slab tariff' : 'at ' + WattWatchAppliances.escapeHtml(fmtRate(sim.effectiveRate))})
        </div>`
      : '';

    const standbyPreviewNote = (activeScenario && activeScenario.baseStandbyWatts !== undefined)
      ? `<div style="margin-top: 0.25rem; color: var(--text-secondary);">Estimated baseline includes ${Number(activeScenario.baseStandbyWatts)}W unrecorded idle standby (preview assumption only; committing saves ${Number(activeScenario.targetStandbyWatts ?? 0)}W standby to match replacement).</div>`
      : '';

    const previewBannerHtml = `
      <div class="sim-preview-banner" role="status" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem; padding: 0.65rem 0.9rem; margin-bottom: 1rem; border-radius: var(--radius-md); background: var(--soft-blue); border: 1px solid var(--soft-blue-border); font-size: 0.8rem;">
        <div>
          <strong>Preview Only:</strong> ${activeScenario
            ? `Testing scenario "${WattWatchAppliances.escapeHtml(activeScenario.title || 'What-If Scenario')}" on <strong>${WattWatchAppliances.escapeHtml(baseApp.name)}</strong>.`
            : `Comparing hypothetical parameters for <strong>${WattWatchAppliances.escapeHtml(baseApp.name)}</strong>.`
          } Your saved appliance inventory has not been modified.${standbyPreviewNote}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnCommitSimScenario" aria-label="Apply simulated changes permanently to ${WattWatchAppliances.escapeHtml(baseApp.name)}">
          Apply Change to Inventory...
        </button>
      </div>
    `;

    resultBox.innerHTML = `
      ${previewBannerHtml}
      <div class="metrics-grid sim-results-grid" style="margin-bottom: 1.5rem;">
        <div class="metric-card">
          <span class="metric-title">Baseline Model</span>
          <div class="metric-value">${WattWatchAppliances.escapeHtml(fmtMoney(sim.baseline.monthlyCost))}</div>
          <div class="metric-subtext">${sim.baseline.monthlyKwh.toFixed(2)} kWh/mo · ${sim.baseline.watts}W</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">Replacement Model</span>
          <div class="metric-value" style="color: ${isEnergySaving ? 'var(--royal-blue)' : 'var(--deep-burgundy)'};">
            ${WattWatchAppliances.escapeHtml(fmtMoney(sim.replacement.monthlyCost))}
          </div>
          <div class="metric-subtext">${sim.replacement.monthlyKwh.toFixed(2)} kWh/mo · ${sim.replacement.watts}W</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Monthly Savings</span>
            <span class="badge ${isEnergySaving ? 'badge-cooling' : 'badge-burgundy'}">${isEnergySaving ? '▼ ' + percentStr : '▲ Higher'}</span>
          </div>
          <div class="metric-value" style="color: ${isCostSaving ? 'var(--deep-burgundy)' : (isNeutralBillSaving ? 'var(--emerald-primary)' : 'var(--text-primary)')};">
            ${isCostSaving ? '+' : (isNeutralBillSaving ? '' : '-')}${WattWatchAppliances.escapeHtml(fmtMoney(Math.abs(sim.savings.monthlyCostSaved)))}
          </div>
          <div class="metric-subtext">${isCostSaving
            ? (sim.tariffMode === 'slab' ? `Slab marginal savings (${sim.savings.monthlyKwhSaved.toFixed(1)} kWh)` : `Saves ${sim.savings.monthlyKwhSaved.toFixed(1)} kWh/mo`)
            : (isNeutralBillSaving ? `Saves ${sim.savings.monthlyKwhSaved.toFixed(1)} kWh/mo (bill unchanged within free allowance / subsidy)` : 'Consumes more energy')}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Annualized Savings</span>
            <span class="badge badge-gold">12 Months</span>
          </div>
          <div class="metric-value" style="color: var(--text-gold);">
            ${isCostSaving ? '+' : (isNeutralBillSaving ? '' : '-')}${WattWatchAppliances.escapeHtml(fmtMoney(Math.abs(sim.savings.annualCostSaved)))}
          </div>
          <div class="metric-subtext">${isEnergySaving ? 'Saves ' + sim.savings.annualKwhSaved.toFixed(1) + ' kWh/year' : 'Additional yearly cost'}</div>
        </div>
      </div>

      ${paybackInfo ? `<div class="card" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem; background: var(--antique-gold-subtle); border-color: var(--antique-gold);">${paybackInfo}</div>` : ''}

      <div class="disclaimer-banner">
        <svg class="disclaimer-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>Efficiency Simulation Disclaimer:</strong> Calculations compare physical energy consumption based on user-entered wattages and hours. Actual appliance draw may vary based on temperature, compressor duty cycles, BEE star ratings, and real-world conditions.
        </div>
      </div>
    `;

    const commitBtn = resultBox.querySelector('#btnCommitSimScenario');
    if (commitBtn) {
      commitBtn.addEventListener('click', () => {
        this.commitSimulatedChangesToInventory(baseApp.id, validAltWatts, altHours, altDays, altQty, activeScenario);
      });
    }
  },

  /**
   * Explicitly asks confirmation before permanently applying simulated parameters to saved inventory.
   */
  commitSimulatedChangesToInventory(applianceId, altWatts, altHours, altDays, altQty, activeScenario = null) {
    const appliances = WattWatchStorage.getAppliances();
    const index = appliances.findIndex(a => a.id === applianceId);
    if (index === -1) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('Cannot apply changes: appliance no longer exists in your inventory.', 'error', 'Appliance Missing');
      }
      return;
    }

    const activeMatchingScenario = (activeScenario && activeScenario.applianceId === applianceId)
      ? activeScenario
      : ((this._activeScenarioPreview && this._activeScenarioPreview.applianceId === applianceId) ? this._activeScenarioPreview : null);

    const buildUpdatedAppliance = (baseRecord) => {
      const next = {
        ...baseRecord,
        powerWatts: Number(altWatts),
        dailyHours: Number(altHours),
        operatingDays: Number(altDays),
        quantity: Number(altQty),
        updatedAt: Date.now()
      };
      const preserveSplit = activeMatchingScenario ? activeMatchingScenario.preserveSplitHours !== false : true;
      const splitPatch = WattWatchCalculations.scaleApplianceForTargetHours(baseRecord, Number(altHours), preserveSplit);
      if (splitPatch.weekdayHours !== undefined) next.weekdayHours = splitPatch.weekdayHours;
      if (splitPatch.weekendHours !== undefined) next.weekendHours = splitPatch.weekendHours;

      if (activeMatchingScenario) {
        if (activeMatchingScenario.targetStandbyWatts !== undefined) {
          next.standbyWatts = Number(activeMatchingScenario.targetStandbyWatts);
        }
        if (activeMatchingScenario.targetDutyCyclePercent !== undefined) {
          next.dutyCyclePercent = Number(activeMatchingScenario.targetDutyCyclePercent);
        }
        if (activeMatchingScenario.targetActiveDaysPerWeek !== undefined) {
          next.activeDaysPerWeek = Number(activeMatchingScenario.targetActiveDaysPerWeek);
        }
      }
      return next;
    };

    const existing = appliances[index];
    const updated = buildUpdatedAppliance(existing);
    const val = WattWatchStorage.validateAppliance(updated);
    if (!val.valid) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast(`Cannot save simulated parameters: ${val.error}`, 'error', 'Validation Failed');
      }
      return;
    }

    const extraChanges = [];
    if (activeMatchingScenario?.targetDutyCyclePercent !== undefined) {
      extraChanges.push(`duty cycle ${val.sanitized.dutyCyclePercent}%`);
    }
    if (activeMatchingScenario?.targetActiveDaysPerWeek !== undefined) {
      extraChanges.push(`${val.sanitized.activeDaysPerWeek} active days/wk`);
    }
    if (activeMatchingScenario?.targetStandbyWatts !== undefined) {
      extraChanges.push(`standby ${val.sanitized.standbyWatts}W`);
    }
    const extraSummary = extraChanges.length > 0 ? `, ${extraChanges.join(', ')}` : '';
    const standbyAssumptionNote = (activeMatchingScenario && activeMatchingScenario.baseStandbyWatts !== undefined)
      ? ` Note: The preview baseline included an estimated ${Number(activeMatchingScenario.baseStandbyWatts)}W standby assumption.`
      : '';

    WattWatchApp.openConfirmDialog({
      title: 'Apply Simulated Change Permanently?',
      message: `Update saved settings for "${existing.name}" from ${existing.powerWatts}W / ${existing.dailyHours}h/day to ${val.sanitized.powerWatts}W / ${val.sanitized.dailyHours}h/day (${val.sanitized.operatingDays} days/mo, ${val.sanitized.quantity} qty${extraSummary})?${standbyAssumptionNote}`,
      confirmText: 'Save to Inventory',
      cancelText: 'Keep Previewing',
      confirmClass: 'btn-primary',
      onConfirm: () => {
        const freshApps = WattWatchStorage.getAppliances();
        const freshIdx = freshApps.findIndex(a => a.id === applianceId);
        if (freshIdx === -1) {
          WattWatchApp.showToast('Appliance was deleted before changes could be saved.', 'error', 'Save Failed');
          return;
        }
        const freshMerged = buildUpdatedAppliance(freshApps[freshIdx]);
        const freshVal = WattWatchStorage.validateAppliance(freshMerged);
        if (!freshVal.valid) {
          WattWatchApp.showToast(`Cannot save simulated parameters: ${freshVal.error}`, 'error', 'Validation Failed');
          return;
        }
        freshApps[freshIdx] = { ...freshVal.sanitized, updatedAt: Date.now() };
        const saved = WattWatchStorage.saveAppliances(freshApps);
        if (!saved) {
          WattWatchApp.showToast('Failed to update saved appliance.', 'error', 'Save Failed');
          return;
        }
        this._activeScenarioPreview = null;
        WattWatchApp.refreshAll();
        WattWatchApp.showToast(`Updated "${freshVal.sanitized.name}" in your saved inventory.`, 'success', 'Inventory Updated');
      }
    });
  },

  /**
   * Validates and loads a What-If scenario into the replacement simulator as a non-destructive preview.
   * Uses canonical shared validators and type-checks optional fields before calling string methods.
   * Rejects invalid inputs cleanly without mutating simulator state.
   * @param {Object} scenario
   * @returns {{ success: boolean, error?: string, renamed?: boolean, applianceId?: string }}
   */
  applyScenario(scenario) {
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario) ||
        typeof scenario.applianceId !== 'string' || scenario.applianceId.trim() === '') {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('Cannot preview scenario: missing or invalid appliance reference.', 'error', 'Scenario Unavailable');
      }
      return { success: false, error: 'Invalid scenario payload' };
    }

    // Type-check optional string metadata before using .trim() or rendering
    const optionalStringFields = ['id', 'title', 'applianceName', 'scenarioType'];
    for (const field of optionalStringFields) {
      if (scenario[field] !== undefined && scenario[field] !== null && typeof scenario[field] !== 'string') {
        if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
          WattWatchApp.showToast(`Cannot apply scenario: invalid ${field} format.`, 'error', 'Invalid Scenario');
        }
        return { success: false, error: `Invalid ${field} type` };
      }
    }

    const safeScenarioId = typeof scenario.id === 'string' && scenario.id.trim() ? scenario.id.trim() : null;
    const safeScenarioTitle = typeof scenario.title === 'string' && scenario.title.trim() ? scenario.title.trim() : 'What-If Scenario';
    const safeScenarioName = typeof scenario.applianceName === 'string' && scenario.applianceName.trim() ? scenario.applianceName.trim() : '';
    const safeScenarioType = typeof scenario.scenarioType === 'string' && scenario.scenarioType.trim() ? scenario.scenarioType.trim() : null;

    // Validate numeric scenario parameters using canonical shared WattWatchCalculations validators
    const validateOptional = (raw, validatorFn) => {
      if (raw === undefined) return { provided: false, valid: true };
      const parsed = validatorFn(raw);
      return Number.isNaN(parsed)
        ? { provided: true, valid: false }
        : { provided: true, valid: true, value: parsed };
    };

    const lim = WattWatchCalculations.APPLIANCE_LIMITS;
    const wCheck = validateOptional(scenario.targetWatts, v => WattWatchCalculations.validatePowerWatts(v, NaN, lim.minWatts));
    const hCheck = validateOptional(scenario.targetHours, v => WattWatchCalculations.validateDailyHours(v, NaN));
    const dCheck = validateOptional(scenario.targetDays, v => WattWatchCalculations.validateOperatingDays(v, false, NaN));
    const qCheck = validateOptional(scenario.targetQty, v => WattWatchCalculations.validateQuantity(v, false, NaN));
    const baseSbCheck = validateOptional(scenario.baseStandbyWatts, v => WattWatchCalculations.validateStandbyWatts(v, NaN));
    const targetSbCheck = validateOptional(scenario.targetStandbyWatts, v => WattWatchCalculations.validateStandbyWatts(v, NaN));
    const targetDutyCheck = validateOptional(scenario.targetDutyCyclePercent, v => WattWatchCalculations.validateDutyCyclePercent(v, NaN));
    const targetActiveDaysCheck = validateOptional(scenario.targetActiveDaysPerWeek, v => WattWatchCalculations.validateActiveDaysPerWeek(v, NaN));

    if (
      !wCheck.valid || !hCheck.valid || !dCheck.valid || !qCheck.valid ||
      !baseSbCheck.valid || !targetSbCheck.valid || !targetDutyCheck.valid || !targetActiveDaysCheck.valid
    ) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast(`Cannot apply scenario: target values are outside valid safety ranges (watts ${lim.minWatts}-${lim.maxWatts}, hours ${lim.minHours}-${lim.maxHours}, days ${lim.minDays}-${lim.maxDays}, qty ${lim.minQty}-${lim.maxQty}, standby ${lim.minStandbyWatts}-${lim.maxStandbyWatts}W, duty 1-${lim.maxDutyCyclePercent}%, active days ${lim.minActiveDaysPerWeek}-${lim.maxActiveDaysPerWeek}).`, 'error', 'Invalid Scenario');
      }
      return { success: false, error: 'Invalid scenario parameter bounds' };
    }

    const appliances = WattWatchStorage.getAppliances();
    const targetApp = appliances.find(a => a.id === scenario.applianceId.trim());
    if (!targetApp) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast(`Cannot preview scenario: "${safeScenarioName || 'target appliance'}" was removed or no longer exists in your inventory.`, 'error', 'Appliance Missing');
      }
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.renderRecommendationsView) {
        WattWatchApp.renderRecommendationsView(appliances, WattWatchStorage.getSettings());
      }
      return { success: false, error: 'Target appliance no longer exists' };
    }

    if (safeScenarioType === 'runtime' && hCheck.provided && hCheck.value > Number(targetApp.dailyHours)) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
        WattWatchApp.showToast('Cannot apply runtime reduction: target daily hours exceed the appliance\'s current schedule.', 'error', 'Invalid Scenario');
      }
      return { success: false, error: 'Runtime target exceeds current daily hours' };
    }

    const cleanTargetName = typeof targetApp.name === 'string' ? targetApp.name.trim() : '';
    const wasRenamed = Boolean(safeScenarioName && cleanTargetName && safeScenarioName !== cleanTargetName);

    this._activeScenarioPreview = {
      id: safeScenarioId,
      title: safeScenarioTitle,
      applianceId: targetApp.id,
      scenarioType: safeScenarioType,
      baseStandbyWatts: baseSbCheck.provided ? baseSbCheck.value : undefined,
      targetWatts: wCheck.provided ? wCheck.value : targetApp.powerWatts,
      targetHours: hCheck.provided ? hCheck.value : targetApp.dailyHours,
      targetDays: dCheck.provided ? dCheck.value : targetApp.operatingDays,
      targetQty: qCheck.provided ? qCheck.value : targetApp.quantity,
      targetStandbyWatts: targetSbCheck.provided ? targetSbCheck.value : undefined,
      targetDutyCyclePercent: targetDutyCheck.provided ? targetDutyCheck.value : undefined,
      targetActiveDaysPerWeek: targetActiveDaysCheck.provided ? targetActiveDaysCheck.value : undefined,
      preserveSplitHours: scenario.preserveSplitHours !== false
    };

    this._isApplyingScenario = true;
    try {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.navigateTo) {
        WattWatchApp.navigateTo('simulator');
      }

      const select = document.getElementById('simApplianceSelect');
      if (select) {
        select.value = targetApp.id;
        this.handleApplianceSelect();
      }

      const elWatts = document.getElementById('simAltWatts');
      const elHours = document.getElementById('simAltHours');
      const elDays = document.getElementById('simAltDays');
      const elQty = document.getElementById('simAltQty');

      if (elWatts) elWatts.value = this._activeScenarioPreview.targetWatts;
      if (elHours) elHours.value = this._activeScenarioPreview.targetHours;
      if (elDays) elDays.value = this._activeScenarioPreview.targetDays;
      if (elQty) elQty.value = this._activeScenarioPreview.targetQty;

      this.calculateReplacement();
    } finally {
      this._isApplyingScenario = false;
    }

    const resultBox = document.getElementById('simResultsContainer');
    this._triggerFlash(resultBox);

    const reducedMotion = (typeof WattWatchApp !== 'undefined' && typeof WattWatchApp._prefersReducedMotion === 'function' && WattWatchApp._prefersReducedMotion()) ||
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (resultBox && typeof resultBox.scrollIntoView === 'function') {
      try {
        resultBox.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      } catch (_) {}
    }

    // Preserve keyboard orientation when navigating from Recommendations card -> Simulator
    const focusTarget = document.getElementById('simAltWatts') || document.getElementById('simApplianceSelect');
    if (focusTarget && !focusTarget.disabled && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (_) {}
    }

    if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
      if (wasRenamed) {
        WattWatchApp.showToast(`"${safeScenarioName}" was renamed to "${cleanTargetName || targetApp.name}". Previewing updated baseline in Simulator — saved inventory unchanged.`, 'info', 'Scenario Preview');
      } else {
        WattWatchApp.showToast(`Previewing "${safeScenarioTitle}" in Simulator — saved inventory unchanged.`, 'info', 'Scenario Preview');
      }
    }

    return { success: true, applianceId: targetApp.id, renamed: wasRenamed };
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

    const inputs = ['calcFixedCharges', 'calcTaxPercent', 'calcFlatRateInput', 'calcTestKwhInput', 'calcFreeUnits', 'calcBillCredit'];
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

    // Safe delegated click and input listeners for slab table
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
      slabTableBody.addEventListener('input', (e) => {
        if (e.target && (e.target.classList.contains('slab-upto-input') || e.target.classList.contains('slab-rate-input'))) {
          this.runTariffCalculation();
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
    const freeInput = document.getElementById('calcFreeUnits');
    const creditInput = document.getElementById('calcBillCredit');
    const slabGroup = document.getElementById('tariffSlabsEditorGroup');

    const valRate = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTariffRate(settings.electricityRate, 8.00)
      : (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' ? Number(settings.electricityRate) : 8.00);
    const flatRate = !isNaN(valRate) ? valRate : 8.00;

    const valFixed = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateFixedCharge(settings.fixedCharges, 0.00)
      : (settings.fixedCharges !== undefined && settings.fixedCharges !== null && settings.fixedCharges !== '' ? Number(settings.fixedCharges) : 0.00);
    const fixedCharges = !isNaN(valFixed) ? valFixed : 0.00;

    const valTax = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTaxPercent(settings.additionalTaxPercent, 0.0)
      : (settings.additionalTaxPercent !== undefined && settings.additionalTaxPercent !== null && settings.additionalTaxPercent !== '' ? Number(settings.additionalTaxPercent) : 0.0);
    const taxPercent = !isNaN(valTax) ? valTax : 0.0;

    const valFree = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateFreeUnits(settings.freeUnits, 0)
      : Number(settings.freeUnits || 0);
    const freeUnits = !isNaN(valFree) ? valFree : 0;

    const valCredit = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateBillCredit(settings.billCreditInr, 0)
      : Number(settings.billCreditInr || 0);
    const billCredit = !isNaN(valCredit) ? valCredit : 0;

    if (modelSelect) modelSelect.value = settings.tariffModel || 'flat';
    if (flatInput) flatInput.value = flatRate.toFixed(2);
    if (fixedInput) fixedInput.value = fixedCharges.toFixed(2);
    if (taxInput) taxInput.value = taxPercent.toFixed(1);
    if (freeInput) freeInput.value = freeUnits.toString();
    if (creditInput) creditInput.value = billCredit.toString();

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
            : `<input type="number" class="form-control slab-upto-input" aria-label="Tier ${idx + 1} upper limit in kWh" value="${s.upTo || 100}" min="1" step="50" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;">`
          }
        </td>
        <td>
          <input type="number" class="form-control slab-rate-input" aria-label="Tier ${idx + 1} rate in rupees per kWh" value="${Number(s.rate).toFixed(2)}" min="0" step="0.25" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;">
        </td>
        <td>
          ${slabs.length > 1
            ? `<button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="remove-slab" data-index="${idx}" title="Remove Tier" aria-label="Remove Slab Tier ${idx + 1}" style="color: #A92639;">&times;</button>`
            : '<span style="color: var(--text-secondary);">—</span>'
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  addNewSlabRow() {
    const currentSlabs = this.readCurrentSlabsFromUI();
    const last = currentSlabs[currentSlabs.length - 1];
    const prevLimit = (last && last.upTo !== null && Number.isFinite(last.upTo)) ? last.upTo : (currentSlabs.length * 150);

    // Make previous last have a numeric limit
    if (last && last.upTo === null) {
      last.upTo = prevLimit + 100;
    }

    const nextRate = (last && Number.isFinite(last.rate)) ? last.rate + 2.0 : 10.0;
    currentSlabs.push({ upTo: null, rate: nextRate });
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
      let upTo;
      if (val === 'null') {
        upTo = null;
      } else if (val === null || val === undefined || String(val).trim() === '') {
        upTo = NaN;
      } else {
        const numVal = Number(val);
        upTo = Number.isFinite(numVal) ? numVal : NaN;
      }

      let rate;
      if (!rateInp || rateInp.value === null || rateInp.value === undefined || String(rateInp.value).trim() === '') {
        rate = NaN;
      } else {
        const numRate = Number(rateInp.value);
        rate = Number.isFinite(numRate) ? numRate : NaN;
      }

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
    const rawFree = document.getElementById('calcFreeUnits')?.value;
    const freeUnits = (rawFree !== undefined && rawFree !== null && rawFree.trim() !== '') ? Number(rawFree) : 0;
    const rawCredit = document.getElementById('calcBillCredit')?.value;
    const billCredit = (rawCredit !== undefined && rawCredit !== null && rawCredit.trim() !== '') ? Number(rawCredit) : 0;
    const slabs = this.readCurrentSlabsFromUI();

    const mockSettings = {
      tariffModel: model,
      electricityRate: flatRate,
      fixedCharges,
      additionalTaxPercent: taxPercent,
      freeUnits,
      billCreditInr: billCredit,
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

    const activeSettings = WattWatchStorage.getSettings();
    const validCurr = WattWatchCalculations.resolveValidatedCurrency(activeSettings?.currency);
    const fmtMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);
    const fmtRate = (r, suffix = '/u') => WattWatchCalculations.formatRateWithCurrency(r, validCurr, suffix);

    let slabRowsHtml = '';
    result.slabBreakdown.forEach(s => {
      slabRowsHtml += `
        <tr>
          <td>${WattWatchAppliances.escapeHtml(s.label)}</td>
          <td>${s.units.toFixed(2)} kWh</td>
          <td>${WattWatchAppliances.escapeHtml(fmtRate(s.rate, '/u'))}</td>
          <td style="font-weight: 600;">${WattWatchAppliances.escapeHtml(fmtMoney(s.cost))}</td>
        </tr>
      `;
    });

    const subsidyBanner = (result.subsidyApplied > 0 || result.freeUnitsApplied > 0)
      ? `<div style="background: var(--bg-surface); border: 1px dashed var(--emerald-primary, #10b981); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--text-primary);">
          ${result.freeUnitsApplied > 0 ? `<div><strong>Lifeline Allowance:</strong> ${result.freeUnitsApplied.toFixed(1)} kWh billed at ${WattWatchAppliances.escapeHtml(fmtMoney(0))} (${result.billableKwh.toFixed(1)} billable units).</div>` : ''}
          ${result.subsidyApplied > 0 ? `<div><strong>Govt Subsidy / Bill Credit Applied:</strong> -${WattWatchAppliances.escapeHtml(fmtMoney(result.subsidyApplied))} (Gross Bill: ${WattWatchAppliances.escapeHtml(fmtMoney(result.grossCost))} &rarr; Net Payable: ${WattWatchAppliances.escapeHtml(fmtMoney(result.totalCost))}).</div>` : ''}
        </div>`
      : '';

    breakdownBox.innerHTML = `
      ${subsidyBanner}
      <div class="metrics-grid metrics-grid-3col" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div style="background: var(--soft-blue); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Energy Base Cost</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--royal-blue);">${WattWatchAppliances.escapeHtml(fmtMoney(result.energyCharges))}</div>
        </div>

        <div style="background: var(--antique-gold-subtle); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Fixed + Duty (${result.taxPercent}%)</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--text-gold);">${WattWatchAppliances.escapeHtml(fmtMoney(result.fixedCharge + result.taxCharges))}</div>
        </div>

        <div style="background: var(--light-burgundy); padding: 0.85rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Payable Bill</div>
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--deep-burgundy);">${WattWatchAppliances.escapeHtml(fmtMoney(result.totalCost))}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">Effective Rate: ${WattWatchAppliances.escapeHtml(fmtRate(result.effectiveRatePerKwh, '/kWh'))}</div>
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
    const rawFree = document.getElementById('calcFreeUnits')?.value;
    const rawCredit = document.getElementById('calcBillCredit')?.value;

    const flatRate = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTariffRate(rawFlat, NaN)
      : Number(rawFlat);
    const fixedCharges = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateFixedCharge(rawFixed, NaN)
      : Number(rawFixed);
    const taxPercent = (typeof WattWatchCalculations !== 'undefined')
      ? WattWatchCalculations.validateTaxPercent(rawTax, NaN)
      : Number(rawTax);
    const freeUnits = (rawFree !== undefined && rawFree !== null && String(rawFree).trim() !== '')
      ? ((typeof WattWatchCalculations !== 'undefined') ? WattWatchCalculations.validateFreeUnits(rawFree, NaN) : Number(rawFree))
      : 0;
    const billCredit = (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== '')
      ? ((typeof WattWatchCalculations !== 'undefined') ? WattWatchCalculations.validateBillCredit(rawCredit, NaN) : Number(rawCredit))
      : 0;

    if (isNaN(flatRate) || isNaN(fixedCharges) || isNaN(taxPercent) || isNaN(freeUnits) || isNaN(billCredit)) {
      WattWatchApp.showToast('Cannot apply settings: please enter valid non-negative numbers (tax must be 0-100%).', 'error', 'Invalid Tariff');
      return;
    }

    const slabs = this.readCurrentSlabsFromUI();
    let sanitizedSlabs = undefined;

    if (model === 'slab') {
      if (typeof WattWatchCalculations !== 'undefined' && WattWatchCalculations.validateSlabConfig) {
        const valSlab = WattWatchCalculations.validateSlabConfig(slabs, { requireOpenEnded: true });
        if (!valSlab.valid) {
          WattWatchApp.showToast(`Cannot apply settings: ${valSlab.error || 'slab configuration is invalid.'}`, 'error', 'Invalid Slabs');
          return;
        }
        sanitizedSlabs = valSlab.sanitized;
      }
    }

    const payload = {
      tariffModel: model,
      electricityRate: flatRate,
      fixedCharges,
      additionalTaxPercent: taxPercent,
      freeUnits,
      billCreditInr: billCredit
    };
    if (sanitizedSlabs !== undefined) {
      payload.slabConfig = sanitizedSlabs;
    }

    const saved = WattWatchStorage.saveSettings(payload);

    if (!saved) {
      WattWatchApp.showToast('Failed to apply settings. Please verify all tariff values.', 'error', 'Save Failed');
      return;
    }

    WattWatchApp.showToast(`Applied ${model === 'slab' ? 'Slab-based' : 'Flat'} tariff to system settings`, 'success', 'Tariff Applied');
    WattWatchApp.refreshAll();
    this._triggerFlash(document.getElementById('tariffCalculationBreakdown'));
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchSimulator = WattWatchSimulator;
}
