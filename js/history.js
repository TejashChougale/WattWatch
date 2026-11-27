/**
 * WATTWATCH - Bill History & Month-to-Month Comparison Module
 * Manages permanent monthly bill snapshots, duplicate period protection,
 * historical breakdown inspection, and comparative deltas.
 */

const WattWatchHistory = {
  activeDetailSnapshotId: null,
  _eventsBound: false,
  previousActiveElement: null,

  init() {
    this.bindEvents();
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _parseStrictNonNegNum(val) {
    if (val === null || val === undefined || typeof val === 'boolean' || typeof val === 'object') return null;
    if (typeof val === 'number') {
      return (!Number.isNaN(val) && Number.isFinite(val) && val >= 0) ? val : null;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) && num >= 0 ? num : null;
    }
    return null;
  },

  _parseStrictNonNegInt(val, min = 0) {
    const num = this._parseStrictNonNegNum(val);
    if (num === null || !Number.isInteger(num) || num < min) return null;
    return num;
  },

  _getSnapshotCurrency(record) {
    if (!record || typeof record !== 'object') return null;
    if (typeof WattWatchStorage === 'undefined' || typeof WattWatchStorage.validateCurrency !== 'function') {
      return null;
    }
    const validateOne = (raw) => {
      if (typeof raw !== 'string' || !raw.trim()) return null;
      const val = WattWatchStorage.validateCurrency(raw);
      return (val && val.valid && typeof val.sanitized === 'string' && val.sanitized.trim())
        ? val.sanitized
        : null;
    };
    const ts = (record.tariffSettings && typeof record.tariffSettings === 'object' && !Array.isArray(record.tariffSettings))
      ? record.tariffSettings
      : null;
    if (ts) {
      const nestedCurr = validateOne(ts.currency);
      if (nestedCurr) return nestedCurr;
    }
    return validateOne(record.currency);
  },

  _formatSnapshotMoney(val, record, opts = {}) {
    const num = this._parseStrictNonNegNum(val);
    if (num === null) return '--';
    const cur = this._getSnapshotCurrency(record);
    if (cur) {
      return WattWatchCalculations.formatCurrency(num, cur);
    }
    const plain = WattWatchCalculations.formatNumber(num, 2);
    return opts.omitLegacySuffix ? plain : `${plain} (Currency unrecorded)`;
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Snapshot save button from History view
    const btnSaveSnapshot = document.getElementById('btnSaveCurrentSnapshot');
    if (btnSaveSnapshot) {
      btnSaveSnapshot.addEventListener('click', () => this.promptSaveSnapshot());
    }

    // Snapshot save button from Overview quick action
    const btnOverviewSave = document.getElementById('btnOverviewSaveSnapshot');
    if (btnOverviewSave) {
      btnOverviewSave.addEventListener('click', () => this.promptSaveSnapshot());
    }

    // Comparison selectors change
    const selectA = document.getElementById('comparePeriodSelectA');
    const selectB = document.getElementById('comparePeriodSelectB');
    if (selectA && selectB) {
      selectA.addEventListener('change', () => this.renderComparison());
      selectB.addEventListener('change', () => this.renderComparison());
    }

    // Actual Meter Reading save button & input triggers
    const btnSaveMeter = document.getElementById('btnSaveMeterReading');
    if (btnSaveMeter) {
      btnSaveMeter.addEventListener('click', () => this.saveMeterTracking());
    }

    const meterInputs = ['meterCycleStart', 'meterCycleEnd', 'meterStartReading', 'meterCurrentReading', 'meterActualCost'];
    meterInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateMeterPreview());
        el.addEventListener('change', () => this.updateMeterPreview());
      }
    });

    // Safe delegated event handling for history table actions (no inline onclicks)
    const tableBody = document.getElementById('historyTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'view-details') {
          this.openDetailsModal(id);
        } else if (action === 'delete') {
          const history = WattWatchStorage.getHistory();
          const record = history.find(h => h.id === id);
          const label = record ? (record.periodLabel || record.period) : id;
          this.confirmDelete(id, label);
        }
      });
    }
  },

  /**
   * Prompts user with a dialog to capture current monthly state as a snapshot
   */
  promptSaveSnapshot() {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const defaultLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const inputPeriod = prompt(`Enter Billing Period (YYYY-MM):`, defaultPeriod);
    if (!inputPeriod || !inputPeriod.trim()) return;

    const trimmedPeriod = inputPeriod.trim();
    if (!WattWatchStorage.validatePeriod(trimmedPeriod)) {
      WattWatchApp.showToast('Please enter a valid format: YYYY-MM with month between 01 and 12 (e.g. 2026-11)', 'error', 'Invalid Period');
      return;
    }

    const [year, month] = trimmedPeriod.split('-');
    const mIdx = parseInt(month, 10) - 1;
    const periodLabel = (mIdx >= 0 && mIdx < 12) ? `${monthNames[mIdx]} ${year}` : trimmedPeriod;

    // Check if snapshot for this period already exists
    const history = WattWatchStorage.getHistory();
    const existing = history.find(h => h.period === trimmedPeriod);

    if (existing) {
      WattWatchApp.openConfirmDialog({
        title: 'Update Existing Billing Record?',
        message: `A historical record for ${periodLabel} (${trimmedPeriod}) already exists. Overwrite it with current appliance calculations?`,
        confirmText: 'Overwrite Snapshot',
        confirmClass: 'btn-primary',
        onConfirm: () => {
          this.executeSaveSnapshot(trimmedPeriod, periodLabel);
        }
      });
    } else {
      this.executeSaveSnapshot(trimmedPeriod, periodLabel);
    }
  },

  /**
   * Freezes current household state into an immutable historical snapshot
   */
  executeSaveSnapshot(period, periodLabel, optionalActual = null) {
    const settings = WattWatchStorage.getSettings();
    const appliances = WattWatchStorage.getAppliances();

    if (appliances.length === 0) {
      WattWatchApp.showToast('Cannot save empty snapshot. Add appliances first.', 'warning', 'No Appliances');
      return;
    }

    const validatedModel = WattWatchCalculations.validateTariffModel(settings.tariffModel, 'flat');
    if (!validatedModel) {
      WattWatchApp.showToast('Cannot save snapshot: active tariff model is invalid.', 'error', 'Invalid Tariff Settings');
      return;
    }

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const tariffDetails = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

    if (!summary.isValid || !tariffDetails.isValid || !WattWatchCalculations.isFiniteNumber(summary.totalMonthlyKwh) || !WattWatchCalculations.isFiniteNumber(summary.totalMonthlyCost)) {
      WattWatchApp.showToast('Cannot save snapshot: current calculation contains invalid numeric values or settings.', 'error', 'Invalid Calculations');
      return;
    }

    // Strictly validate tariff values before persisting (never silently substitute 0 or 8.00 for missing/invalid fields)
    const rateCheck = WattWatchCalculations.validateTariffRate(settings.electricityRate, NaN);
    const fixedC = this._parseStrictNonNegNum(settings.fixedCharges !== undefined ? settings.fixedCharges : tariffDetails.fixedCharge);
    const taxP = this._parseStrictNonNegNum(settings.additionalTaxPercent !== undefined ? settings.additionalTaxPercent : tariffDetails.taxPercent);
    const freeU = this._parseStrictNonNegNum(settings.freeUnits !== undefined ? settings.freeUnits : tariffDetails.freeUnits);
    const rawSettCredit = WattWatchCalculations._resolveRawBillCredit(settings);
    const creditFromSettings = (rawSettCredit !== undefined && rawSettCredit !== null && rawSettCredit !== '')
      ? this._parseStrictNonNegNum(rawSettCredit)
      : this._parseStrictNonNegNum(tariffDetails.billCreditInr ?? tariffDetails.subsidy);

    if ((validatedModel === 'flat' && isNaN(rateCheck)) ||
        (validatedModel === 'slab' && settings.electricityRate !== undefined && isNaN(rateCheck)) ||
        fixedC === null || taxP === null || taxP > 100 || freeU === null || creditFromSettings === null) {
      WattWatchApp.showToast('Cannot save snapshot: active tariff configuration contains missing or invalid values.', 'error', 'Invalid Tariff Settings');
      return;
    }

    // Deep-clone appliances snapshot so subsequent edits to appliances never alter past records
    const frozenAppliances = JSON.parse(JSON.stringify(summary.appliances));

    const isSlab = validatedModel === 'slab';
    const effectiveRate = tariffDetails.effectiveRatePerKwh;
    const flatRate = !isNaN(rateCheck) ? rateCheck : effectiveRate;
    const validSettingsCurr = (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.validateCurrency === 'function' && settings.currency !== undefined)
      ? WattWatchStorage.validateCurrency(settings.currency)
      : { valid: false };
    const validatedCurr = (validSettingsCurr && validSettingsCurr.valid) ? validSettingsCurr.sanitized : null;
    const creditC = creditFromSettings;

    const snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      period,
      periodLabel,
      totalKwh: summary.totalMonthlyKwh,
      totalCost: isSlab ? tariffDetails.totalCost : summary.totalMonthlyCost,
      electricityRate: effectiveRate,
      flatRate: flatRate,
      effectiveRate: effectiveRate,
      tariffModel: isSlab ? 'slab' : 'flat',
      ...(validatedCurr ? { currency: validatedCurr } : {}),
      tariffBreakdown: tariffDetails,
      tariffSettings: {
        tariffModel: isSlab ? 'slab' : 'flat',
        electricityRate: flatRate,
        fixedCharges: fixedC,
        additionalTaxPercent: taxP,
        freeUnits: freeU,
        billCreditInr: creditC,
        ...(isSlab && Array.isArray(settings.slabConfig) ? { slabConfig: JSON.parse(JSON.stringify(settings.slabConfig)) } : {}),
        ...(validatedCurr ? { currency: validatedCurr } : {})
      },
      appliancesCount: summary.totalAppliancesCount,
      totalUnits: summary.totalUnits,
      appliancesSnapshot: frozenAppliances,
      createdAt: Date.now()
    };

    // Attach actual utility readings if present in active meter tracking or passed explicitly
    const meter = WattWatchStorage.getMeterTracking();
    if (meter) {
      const mUnits = this._parseStrictNonNegNum(meter.actualUnits);
      const mCost = this._parseStrictNonNegNum(meter.actualCost);
      const mStart = this._parseStrictNonNegNum(meter.startReading);
      const mEnd = this._parseStrictNonNegNum(meter.currentReading);
      if (mUnits !== null) snapshot.actualKwh = mUnits;
      if (mCost !== null) snapshot.actualCost = mCost;
      if (meter.cycleStartDate) snapshot.cycleStartDate = meter.cycleStartDate;
      if (meter.cycleEndDate) snapshot.cycleEndDate = meter.cycleEndDate;
      if (mStart !== null) snapshot.meterReadingStart = mStart;
      if (mEnd !== null) snapshot.meterReadingEnd = mEnd;
    }

    if (optionalActual && typeof optionalActual === 'object') {
      const oUnits = this._parseStrictNonNegNum(optionalActual.actualKwh);
      const oCost = this._parseStrictNonNegNum(optionalActual.actualCost);
      const oStart = this._parseStrictNonNegNum(optionalActual.meterReadingStart);
      const oEnd = this._parseStrictNonNegNum(optionalActual.meterReadingEnd);
      if (oUnits !== null) snapshot.actualKwh = oUnits;
      if (oCost !== null) snapshot.actualCost = oCost;
      if (optionalActual.cycleStartDate) snapshot.cycleStartDate = optionalActual.cycleStartDate;
      if (optionalActual.cycleEndDate) snapshot.cycleEndDate = optionalActual.cycleEndDate;
      if (oStart !== null) snapshot.meterReadingStart = oStart;
      if (oEnd !== null) snapshot.meterReadingEnd = oEnd;
    }

    const saved = WattWatchStorage.saveSnapshot(snapshot);
    if (!saved) {
      WattWatchApp.showToast('Failed to save snapshot: record failed strict validation.', 'error', 'Validation Error');
      return;
    }
    WattWatchApp.showToast(`Snapshot for ${periodLabel} saved successfully`, 'success', 'Snapshot Saved');
    WattWatchApp.refreshAll();
  },

  /**
   * Renders the complete Bill History view (table, KPI highlights, comparison)
   */
  renderHistoryView() {
    this.renderMeterTrackingCard();

    const history = WattWatchStorage.getHistory();
    const tableBody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('historyEmptyState');
    const tableWrap = document.getElementById('historyTableWrap');
    const comparisonSection = document.getElementById('historyComparisonCard');

    if (!tableBody) return;

    if (history.length === 0) {
      const oldNotice = document.getElementById('historyLegacyCurrencyNotice');
      if (oldNotice) oldNotice.style.display = 'none';
      if (tableWrap) tableWrap.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (comparisonSection) comparisonSection.style.display = 'none';
      this.updateHistoryKpis([]);
      return;
    }

    if (tableWrap) {
      tableWrap.style.display = 'block';
      const hasLegacyCurrRow = history.some(r => this._getSnapshotCurrency(r) === null);
      let noticeEl = document.getElementById('historyLegacyCurrencyNotice');
      if (hasLegacyCurrRow) {
        if (!noticeEl) {
          noticeEl = document.createElement('div');
          noticeEl.id = 'historyLegacyCurrencyNotice';
          noticeEl.style.cssText = 'background: rgba(197, 155, 67, 0.12); border: 1px solid rgba(197, 155, 67, 0.35); border-radius: var(--radius-md); padding: 0.65rem 0.9rem; margin-bottom: 0.9rem; font-size: 0.8rem; color: var(--text-primary);';
          tableWrap.insertBefore(noticeEl, tableWrap.firstChild);
        }
        noticeEl.innerHTML = '<strong>Legacy Snapshot Notice:</strong> One or more historical records lack recorded currency metadata. Their amounts are shown unlabelled without substituting your current account currency.';
        noticeEl.style.display = 'block';
      } else if (noticeEl) {
        noticeEl.style.display = 'none';
      }
    }
    if (emptyState) emptyState.style.display = 'none';
    if (comparisonSection) comparisonSection.style.display = 'block';

    this.updateHistoryKpis(history);
    this.populateComparisonSelects(history);

    tableBody.innerHTML = '';

    history.forEach(record => {
      const tr = document.createElement('tr');
      let dateStr = 'Unknown date';
      if (record.createdAt !== null && record.createdAt !== undefined) {
        try {
          const d = new Date(record.createdAt);
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          }
        } catch (_) {
          dateStr = 'Unknown date';
        }
      }

      const isSlab = record.tariffModel === 'slab';
      const firstValidNum = (...vals) => {
        for (const v of vals) {
          const parsed = this._parseStrictNonNegNum(v);
          if (parsed !== null) return parsed;
        }
        return null;
      };

      const effRate = firstValidNum(record.effectiveRate, record.tariffBreakdown?.effectiveRatePerKwh, record.electricityRate);
      const flatRateDisp = firstValidNum(record.flatRate, record.electricityRate);

      const recCur = this._getSnapshotCurrency(record);
      const rateSym = recCur ? `${this.escapeHtml(recCur)}` : '';
      const effRateTitle = effRate !== null ? `${rateSym}${effRate.toFixed(2)}/kWh${!recCur ? ' (currency unrecorded)' : ''}` : 'Unavailable';
      const flatRateTitle = flatRateDisp !== null ? `${rateSym}${flatRateDisp.toFixed(2)}/kWh${!recCur ? ' (currency unrecorded)' : ''}` : 'Unavailable';

      const modelBadge = isSlab
        ? `<span class="badge badge-gold" title="Progressive Slab Tariff: Effective rate is ${effRateTitle}">Slab</span>`
        : `<span class="badge badge-blue" title="Flat Rate: ${flatRateTitle}">Flat</span>`;

      const validTotalKwh = this._parseStrictNonNegNum(record.totalKwh);
      const validTotalCost = this._parseStrictNonNegNum(record.totalCost);
      const validActualKwh = this._parseStrictNonNegNum(record.actualKwh);
      const validActualCost = this._parseStrictNonNegNum(record.actualCost);
      const validCount = this._parseStrictNonNegInt(record.appliancesCount, 0);
      const validUnits = this._parseStrictNonNegInt(record.totalUnits, 0);

      let actualCostBlock = '';
      if (validActualCost !== null) {
        let varianceHtml = '';
        if (validTotalCost !== null) {
          const diff = validActualCost - validTotalCost;
          const diffSign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
          const diffColor = diff > 0 ? '#ef4444' : 'var(--emerald-primary, #10b981)';
          varianceHtml = ` <span style="color: ${diffColor}; font-weight: 600;">(${diffSign}${rateSym}${Math.abs(diff).toFixed(0)})</span>`;
        }
        actualCostBlock = `
          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">
            Actual: <strong>${this.escapeHtml(this._formatSnapshotMoney(validActualCost, record, { omitLegacySuffix: true }))}</strong>${varianceHtml}
          </div>`;
      }

      const costDisplayHtml = validTotalCost === null
        ? '--'
        : (recCur
            ? this.escapeHtml(WattWatchCalculations.formatCurrency(validTotalCost, recCur))
            : `${this.escapeHtml(WattWatchCalculations.formatNumber(validTotalCost, 2))} <span style="font-size: 0.7rem; color: var(--text-secondary);">(Legacy)</span>`);

      const rateDisplayHtml = effRate === null
        ? 'Rate N/A'
        : `${rateSym}${effRate.toFixed(2)}/u${isSlab ? ' (eff.)' : ''}${!recCur ? ' <span style="font-size:0.7rem;">(Legacy)</span>' : ''}`;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; font-family: var(--font-serif); font-size: 0.95rem; color: var(--text-primary);">
            ${WattWatchAppliances.escapeHtml(record.periodLabel || record.period)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${WattWatchAppliances.escapeHtml(record.period)}</div>
        </td>
        <td>
          <span class="kwh-val">${validTotalKwh !== null ? WattWatchCalculations.formatKwh(validTotalKwh) : '-- kWh'}</span>
          ${validActualKwh !== null
            ? `<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">Actual: <strong>${validActualKwh.toFixed(1)} kWh</strong></div>`
            : ''
          }
        </td>
        <td>
          <span class="cost-val">${costDisplayHtml}</span>
          ${actualCostBlock}
        </td>
        <td>
          ${modelBadge}
          <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.25rem;">
            ${rateDisplayHtml}
          </span>
        </td>
        <td>
          ${validCount !== null ? validCount : '--'} devices (${validUnits !== null ? validUnits : '--'} units)
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${this.escapeHtml(dateStr)}</span>
        </td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="View Snapshot Details" data-action="view-details" data-id="${this.escapeHtml(record.id)}" aria-label="View Details for ${this.escapeHtml(record.period)}">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Delete Snapshot" data-action="delete" data-id="${this.escapeHtml(record.id)}" aria-label="Delete ${this.escapeHtml(record.period)}" style="color: #A92639;">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Render historical trend chart if charts module is available
    if (typeof WattWatchCharts !== 'undefined' && WattWatchCharts.renderHistoryTrendChart) {
      WattWatchCharts.renderHistoryTrendChart(history);
    }
  },

  /**
   * Clears transient meter tracking DOM inputs and resets summary banner cleanly
   */
  clearMeterTrackingInputs() {
    const ids = [
      'meterCycleStart',
      'meterCycleEnd',
      'meterStartReading',
      'meterCurrentReading',
      'meterActualCost',
      'meterNotes'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const progressFill = document.getElementById('meterCycleProgressFill');
    if (progressFill) progressFill.style.width = '0%';
    const daysBadge = document.getElementById('meterCycleDaysBadge');
    if (daysBadge) {
      daysBadge.textContent = 'Cycle Tracking';
      daysBadge.className = 'badge badge-outline';
    }
    const summaryBox = document.getElementById('meterComparisonSummary');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
          Enter your billing cycle dates and meter readings above to compare actual utility consumption with WattWatch projections.
        </div>
      `;
    }
  },

  /**
   * Initializes and renders active meter tracking card inputs and live comparison
   */
  renderMeterTrackingCard() {
    const currentKey = typeof WattWatchStorage._getKey === 'function'
      ? WattWatchStorage._getKey('METER')
      : 'wattwatch_meter_v1';
    const userChanged = this._lastMeterKey !== undefined && this._lastMeterKey !== currentKey;
    this._lastMeterKey = currentKey;

    const meter = WattWatchStorage.getMeterTracking();
    const startInput = document.getElementById('meterCycleStart');
    const endInput = document.getElementById('meterCycleEnd');
    const startReadInput = document.getElementById('meterStartReading');
    const curReadInput = document.getElementById('meterCurrentReading');
    const actualCostInput = document.getElementById('meterActualCost');
    const notesInput = document.getElementById('meterNotes');

    const meterInputs = [startInput, endInput, startReadInput, curReadInput, actualCostInput, notesInput];
    const activeInMeter = typeof document !== 'undefined' && meterInputs.includes(document.activeElement);

    if (userChanged || !activeInMeter) {
      if (meter) {
        if (startInput) startInput.value = meter.cycleStartDate || '';
        if (endInput) endInput.value = meter.cycleEndDate || '';
        if (startReadInput) {
          startReadInput.value = WattWatchCalculations.isFiniteNumber(meter.startReading)
            ? meter.startReading
            : '';
        }
        if (curReadInput) {
          curReadInput.value = WattWatchCalculations.isFiniteNumber(meter.currentReading)
            ? meter.currentReading
            : '';
        }
        if (actualCostInput) {
          actualCostInput.value = WattWatchCalculations.isFiniteNumber(meter.actualCost)
            ? meter.actualCost
            : '';
        }
        if (notesInput) notesInput.value = meter.notes || '';
      } else {
        this.clearMeterTrackingInputs();
      }
    }

    this.updateMeterPreview();
  },

  /**
   * Calculates live cycle pacing and variance between metered reading and WattWatch projections
   */
  updateMeterPreview() {
    const startVal = document.getElementById('meterCycleStart')?.value;
    const endVal = document.getElementById('meterCycleEnd')?.value;
    const rawStartRead = document.getElementById('meterStartReading')?.value;
    const rawCurRead = document.getElementById('meterCurrentReading')?.value;
    const rawActualCost = document.getElementById('meterActualCost')?.value;
    const summaryBox = document.getElementById('meterComparisonSummary');
    const progressFill = document.getElementById('meterCycleProgressFill');
    const daysBadge = document.getElementById('meterCycleDaysBadge');

    const startRead = (rawStartRead !== undefined && rawStartRead !== null && rawStartRead.trim() !== '') ? Number(rawStartRead) : null;
    const curRead = (rawCurRead !== undefined && rawCurRead !== null && rawCurRead.trim() !== '') ? Number(rawCurRead) : null;
    const actualCost = (rawActualCost !== undefined && rawActualCost !== null && rawActualCost.trim() !== '') ? Number(rawActualCost) : null;

    const pacing = WattWatchCalculations.calculateBillingCyclePacing(startVal, endVal, new Date());

    if (pacing.isValid) {
      if (progressFill) progressFill.style.width = `${pacing.progressPercent}%`;
      if (daysBadge) {
        daysBadge.textContent = `Day ${pacing.elapsedDays} of ${pacing.totalDays} (${pacing.remainingDays} days remaining)`;
        daysBadge.className = pacing.isComplete ? 'badge badge-gold' : 'badge badge-cooling';
      }
    } else {
      if (progressFill) progressFill.style.width = '0%';
      if (daysBadge) {
        daysBadge.textContent = 'Cycle Tracking';
        daysBadge.className = 'badge badge-outline';
      }
    }

    if (!summaryBox) return;

    const meteredUnits = (startRead !== null && curRead !== null && curRead >= startRead)
      ? (curRead - startRead)
      : null;

    if (meteredUnits === null && actualCost === null) {
      summaryBox.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-secondary);">
          Enter your billing cycle dates and meter readings above to compare actual utility consumption with WattWatch projections.
        </div>
      `;
      return;
    }

    const appliances = WattWatchStorage.getAppliances();
    const settings = WattWatchStorage.getSettings();
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const daysInPeriod = (pacing.isValid && pacing.totalDays) ? pacing.totalDays : WattWatchCalculations.getDaysInCurrentMonth();
    const elapsedDays = pacing.isValid ? pacing.elapsedDays : daysInPeriod;

    // Prorated expected consumption for elapsed days
    const dailyKwh = summary.totalMonthlyKwh / daysInPeriod;
    const expectedElapsedKwh = dailyKwh * elapsedDays;
    const dailyCost = summary.totalMonthlyCost / daysInPeriod;
    const expectedElapsedCost = dailyCost * elapsedDays;

    let unitsVarianceHtml = '';
    if (meteredUnits !== null) {
      const diffKwh = meteredUnits - expectedElapsedKwh;
      const isOver = diffKwh > 0.05;
      const kwhColor = isOver ? '#ef4444' : 'var(--emerald-primary, #10b981)';
      const kwhSign = diffKwh > 0 ? '+' : '';
      unitsVarianceHtml = `
        <div style="flex: 1; min-width: 180px;">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Metered Consumption (${elapsedDays}d)</div>
          <div style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; color: var(--royal-blue);">${meteredUnits.toFixed(1)} kWh</div>
          <div style="font-size: 0.78rem; color: ${kwhColor}; font-weight: 600;">
            ${kwhSign}${diffKwh.toFixed(1)} kWh vs estimate (~${expectedElapsedKwh.toFixed(1)} kWh)
          </div>
        </div>
      `;
    }

    let costVarianceHtml = '';
    if (actualCost !== null) {
      const meterCurr = WattWatchCalculations.resolveValidatedCurrency(settings?.currency);
      const diffCost = actualCost - expectedElapsedCost;
      const isOver = diffCost > 0.5;
      const costColor = isOver ? '#ef4444' : 'var(--emerald-primary, #10b981)';
      const costSign = diffCost > 0 ? '+' : '';
      const fmtActual = WattWatchCalculations.formatOptionalCurrency(actualCost, meterCurr);
      const fmtDiff = WattWatchCalculations.formatOptionalCurrency(Math.abs(diffCost), meterCurr);
      const fmtExp = WattWatchCalculations.formatOptionalCurrency(expectedElapsedCost, meterCurr);
      const signedDiff = diffCost < 0 ? `-${fmtDiff}` : `${costSign}${fmtDiff}`;
      costVarianceHtml = `
        <div style="flex: 1; min-width: 180px;">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Actual Bill Charge</div>
          <div style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; color: var(--deep-burgundy);">${this.escapeHtml(fmtActual)}</div>
          <div style="font-size: 0.78rem; color: ${costColor}; font-weight: 600;">
            ${this.escapeHtml(signedDiff)} vs estimate (${this.escapeHtml(fmtExp)})
          </div>
        </div>
      `;
    }

    summaryBox.innerHTML = `
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: flex-start;">
        ${unitsVarianceHtml}
        ${costVarianceHtml}
        <div style="flex: 1; min-width: 180px;">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Cycle Progress</div>
          <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-top: 0.2rem;">
            ${pacing.isValid ? `${pacing.elapsedDays} of ${pacing.totalDays} Days (${pacing.progressPercent}%)` : `${daysInPeriod}-day baseline`}
          </div>
          <div style="font-size: 0.78rem; color: var(--text-secondary);">
            ${pacing.isValid ? `${pacing.remainingDays} days remaining in cycle` : 'Dates not set'}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Saves active meter tracking inputs to storage
   */
  saveMeterTracking() {
    const startVal = document.getElementById('meterCycleStart')?.value || '';
    const endVal = document.getElementById('meterCycleEnd')?.value || '';
    const rawStartRead = document.getElementById('meterStartReading')?.value;
    const rawCurRead = document.getElementById('meterCurrentReading')?.value;
    const rawActualCost = document.getElementById('meterActualCost')?.value;
    const notes = document.getElementById('meterNotes')?.value || '';

    const startReading = (rawStartRead !== undefined && rawStartRead !== null && rawStartRead.trim() !== '') ? Number(rawStartRead) : null;
    const currentReading = (rawCurRead !== undefined && rawCurRead !== null && rawCurRead.trim() !== '') ? Number(rawCurRead) : null;
    const actualCost = (rawActualCost !== undefined && rawActualCost !== null && rawActualCost.trim() !== '') ? Number(rawActualCost) : null;

    if (startReading !== null && (isNaN(startReading) || startReading < 0 || !Number.isFinite(startReading))) {
      WattWatchApp.showToast('Start meter reading must be a valid non-negative number.', 'error', 'Invalid Meter Reading');
      return;
    }

    if (currentReading !== null && (isNaN(currentReading) || currentReading < 0 || !Number.isFinite(currentReading))) {
      WattWatchApp.showToast('Current meter reading must be a valid non-negative number.', 'error', 'Invalid Meter Reading');
      return;
    }

    if (actualCost !== null && (isNaN(actualCost) || actualCost < 0 || !Number.isFinite(actualCost))) {
      WattWatchApp.showToast('Actual utility bill cost must be a valid non-negative number.', 'error', 'Invalid Utility Cost');
      return;
    }

    if (startReading !== null && currentReading !== null && currentReading < startReading) {
      WattWatchApp.showToast('Current meter reading cannot be lower than start meter reading.', 'error', 'Invalid Meter Reading');
      return;
    }

    if (startVal && endVal && endVal < startVal) {
      WattWatchApp.showToast('Cycle end date cannot be earlier than cycle start date.', 'error', 'Invalid Billing Cycle');
      return;
    }

    const actualUnits = (startReading !== null && currentReading !== null && currentReading >= startReading)
      ? Math.max(0, currentReading - startReading)
      : null;

    const saved = WattWatchStorage.saveMeterTracking({
      cycleStartDate: startVal || null,
      cycleEndDate: endVal || null,
      startReading,
      currentReading,
      actualUnits,
      actualCost,
      notes
    });

    if (saved) {
      WattWatchApp.showToast('Actual meter tracking data saved successfully.', 'success', 'Meter Tracking Saved');
      this.updateMeterPreview();
    } else {
      WattWatchApp.showToast('Failed to save meter tracking data.', 'error', 'Save Failed');
    }
  },

  /**
   * Updates peak and lowest recorded bill KPIs
   */
  updateHistoryKpis(history) {
    const elPeak = document.getElementById('historyHighestBill');
    const elLow = document.getElementById('historyLowestBill');
    const elCount = document.getElementById('historyRecordsCount');

    if (!elPeak || !elLow || !elCount) return;

    const safeHistory = Array.isArray(history) ? history : [];
    const validSnapshots = safeHistory.filter(h => h && typeof h === 'object' && this._parseStrictNonNegNum(h.totalCost) !== null);

    if (validSnapshots.length === 0) {
      let emptyCurr = null;
      if (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.validateCurrency === 'function') {
        const s = typeof WattWatchStorage.getSettings === 'function' ? WattWatchStorage.getSettings() : null;
        if (s && typeof s.currency === 'string' && s.currency.trim()) {
          const val = WattWatchStorage.validateCurrency(s.currency);
          if (val && val.valid && typeof val.sanitized === 'string' && val.sanitized.trim()) {
            emptyCurr = val.sanitized;
          }
        }
      }
      const zeroCost = emptyCurr
        ? WattWatchCalculations.formatCurrency(0, emptyCurr)
        : WattWatchCalculations.formatNumber(0, 2);
      elPeak.textContent = zeroCost;
      elPeak.title = 'No historical records available';
      elLow.textContent = zeroCost;
      elLow.title = 'No historical records available';
      elCount.textContent = '0 Records';
      return;
    }

    const sortedByCost = [...validSnapshots].sort(
      (a, b) => this._parseStrictNonNegNum(b.totalCost) - this._parseStrictNonNegNum(a.totalCost)
    );
    const highest = sortedByCost[0];
    const lowest = sortedByCost[sortedByCost.length - 1];

    const hKwh = this._parseStrictNonNegNum(highest.totalKwh);
    const lKwh = this._parseStrictNonNegNum(lowest.totalKwh);

    elPeak.textContent = this._formatSnapshotMoney(highest.totalCost, highest);
    elPeak.title = `Highest: ${highest.periodLabel || highest.period} (${hKwh !== null ? hKwh.toFixed(1) : '--'} kWh)`;

    elLow.textContent = this._formatSnapshotMoney(lowest.totalCost, lowest);
    elLow.title = `Lowest: ${lowest.periodLabel || lowest.period} (${lKwh !== null ? lKwh.toFixed(1) : '--'} kWh)`;

    elCount.textContent = `${validSnapshots.length} Record${validSnapshots.length !== 1 ? 's' : ''}`;
  },

  /**
   * Populates comparison select dropdowns
   */
  populateComparisonSelects(history) {
    const selectA = document.getElementById('comparePeriodSelectA');
    const selectB = document.getElementById('comparePeriodSelectB');
    if (!selectA || !selectB) return;

    const curA = selectA.value;
    const curB = selectB.value;

    selectA.innerHTML = '';
    selectB.innerHTML = '';

    history.forEach((rec) => {
      const costStr = this._formatSnapshotMoney(rec.totalCost, rec);
      const optA = document.createElement('option');
      optA.value = rec.id;
      optA.textContent = `${rec.periodLabel || rec.period} (${costStr})`;
      selectA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = rec.id;
      optB.textContent = `${rec.periodLabel || rec.period} (${costStr})`;
      selectB.appendChild(optB);
    });

    // Default: compare the two most recent distinct periods if available
    if (curA && history.some(h => h.id === curA)) {
      selectA.value = curA;
    } else if (history.length > 1) {
      selectA.value = history[1].id; // Earlier month
    } else {
      selectA.value = history[0]?.id || '';
    }

    if (curB && history.some(h => h.id === curB)) {
      selectB.value = curB;
    } else {
      selectB.value = history[0]?.id || ''; // Latest month
    }

    this.renderComparison();
  },

  /**
   * Renders Month-to-Month comparison dashboard metrics
   */
  renderComparison() {
    const selectA = document.getElementById('comparePeriodSelectA');
    const selectB = document.getElementById('comparePeriodSelectB');
    if (!selectA || !selectB) return;

    const idA = selectA.value;
    const idB = selectB.value;
    const history = WattWatchStorage.getHistory();

    const snapA = history.find(h => h.id === idA);
    const snapB = history.find(h => h.id === idB);

    const resultBox = document.getElementById('comparisonResultsBox');
    if (!resultBox) return;

    if (history.length < 2) {
      resultBox.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Save at least two billing snapshots to view month-to-month comparison.</div>`;
      if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
        WattWatchCharts.renderComparisonChart(null);
      }
      return;
    }

    if (!snapA || !snapB) {
      resultBox.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Select two periods above to view comparison.</div>`;
      if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
        WattWatchCharts.renderComparisonChart(null);
      }
      return;
    }

    if (snapA.id === snapB.id) {
      resultBox.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Please select two different billing periods to compare.</div>`;
      if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
        WattWatchCharts.renderComparisonChart(null);
      }
      return;
    }

    const strictValidA = this._parseStrictNonNegNum(snapA.totalKwh) !== null && this._parseStrictNonNegNum(snapA.totalCost) !== null;
    const strictValidB = this._parseStrictNonNegNum(snapB.totalKwh) !== null && this._parseStrictNonNegNum(snapB.totalCost) !== null;
    const comp = (strictValidA && strictValidB) ? WattWatchCalculations.compareSnapshots(snapA, snapB) : null;
    if (!comp || !comp.isValid) {
      resultBox.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">One or both selected billing periods contain invalid calculation data.</div>`;
      if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
        WattWatchCharts.renderComparisonChart(null);
      }
      return;
    }

    const isCostInc = comp.costDiff > 0;
    const isKwhInc = comp.kwhDiff > 0;

    const badgeCostColor = isCostInc ? 'badge-burgundy' : 'badge-cooling';
    const costIcon = isCostInc ? '▲' : (comp.costDiff < 0 ? '▼' : '—');
    const kwhIcon = isKwhInc ? '▲' : (comp.kwhDiff < 0 ? '▼' : '—');

    const curA = this._getSnapshotCurrency(snapA);
    const curB = this._getSnapshotCurrency(snapB);
    const symA = curA ? `${this.escapeHtml(curA)}` : '';
    const symB = curB ? `${this.escapeHtml(curB)}` : '';

    const firstValidNum = (...vals) => {
      for (const v of vals) {
        const n = this._parseStrictNonNegNum(v);
        if (n !== null) return n;
      }
      return null;
    };
    const rateA = firstValidNum(snapA.effectiveRate, snapA.tariffBreakdown?.effectiveRatePerKwh, snapA.electricityRate, snapA.flatRate);
    const rateB = firstValidNum(snapB.effectiveRate, snapB.tariffBreakdown?.effectiveRatePerKwh, snapB.electricityRate, snapB.flatRate);
    const rateTextA = rateA !== null ? `${symA}${rateA.toFixed(2)}/u${snapA.tariffModel === 'slab' ? ' (eff.)' : ''}${!curA ? ' (Legacy)' : ''}` : 'Rate N/A';
    const rateTextB = rateB !== null ? `${symB}${rateB.toFixed(2)}/u${snapB.tariffModel === 'slab' ? ' (eff.)' : ''}${!curB ? ' (Legacy)' : ''}` : 'Rate N/A';

    const bothSameRecordedCurrency = Boolean(curA && curB && curA === curB);
    const bothMissingCurrency = (curA === null && curB === null);
    const currenciesDiffer = !bothSameRecordedCurrency && !bothMissingCurrency;

    let comparisonNoticeHtml = '';
    let billDiffBadgeHtml = '';
    let billDiffValueHtml = '';
    let billDiffSubtext = '';

    if (currenciesDiffer) {
      const labelA = curA ? this.escapeHtml(curA) : 'Unrecorded';
      const labelB = curB ? this.escapeHtml(curB) : 'Unrecorded';
      comparisonNoticeHtml = `
        <div style="background: rgba(197, 155, 67, 0.12); border: 1px solid rgba(197, 155, 67, 0.35); border-radius: var(--radius-md); padding: 0.65rem 0.9rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-primary);">
          <strong>Cross-Currency Comparison Notice:</strong> The selected snapshots use different or unrecorded currencies (${labelA} vs ${labelB}). Monetary differences and percentages are disabled without exchange-rate conversion; energy deltas remain valid.
        </div>`;
      billDiffBadgeHtml = `<span class="badge badge-outline">Non-Comparable</span>`;
      billDiffValueHtml = `<div class="metric-value" style="color: var(--text-secondary); font-size: 1.15rem;">Non-Comparable Across Currencies</div>`;
      billDiffSubtext = `Cannot compare ${labelA} vs ${labelB} without currency conversion`;
    } else if (bothMissingCurrency) {
      comparisonNoticeHtml = `
        <div style="background: rgba(104, 115, 134, 0.1); border: 1px solid rgba(104, 115, 134, 0.25); border-radius: var(--radius-md); padding: 0.65rem 0.9rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-primary);">
          <strong>Legacy Currency Notice:</strong> Neither selected snapshot recorded a currency symbol. Both bill values are shown unlabelled without assuming your current account currency, and monetary differences and percentages are disabled as non-comparable; energy deltas remain valid.
        </div>`;
      billDiffBadgeHtml = `<span class="badge badge-outline">Non-Comparable</span>`;
      billDiffValueHtml = `<div class="metric-value" style="color: var(--text-secondary); font-size: 1.15rem;">Non-Comparable</div>`;
      billDiffSubtext = 'Monetary difference and percentage disabled without verified snapshot currencies';
    } else {
      billDiffBadgeHtml = `<span class="badge ${badgeCostColor}">${costIcon} ${Math.abs(comp.costPercentDiff).toFixed(1)}%</span>`;
      const formattedDiff = WattWatchCalculations.formatCurrency(Math.abs(comp.costDiff), curA);
      const signPrefix = isCostInc ? '+' : (comp.costDiff < 0 ? '-' : '');
      billDiffValueHtml = `<div class="metric-value" style="color: ${isCostInc ? 'var(--deep-burgundy)' : 'var(--text-primary)'};">${signPrefix}${this.escapeHtml(formattedDiff)}</div>`;
      billDiffSubtext = isCostInc ? 'Increase in electricity bill' : (comp.costDiff < 0 ? 'Decrease in bill' : 'Identical bill amount');
    }

    resultBox.innerHTML = `
      ${comparisonNoticeHtml}
      <div class="metrics-grid history-compare-grid" style="margin-bottom: 1.5rem;">
        <div class="metric-card">
          <span class="metric-title">${this.escapeHtml(comp.periodLabelA)} (Baseline)</span>
          <div class="metric-value">${this.escapeHtml(this._formatSnapshotMoney(comp.costA, snapA))}</div>
          <div class="metric-subtext">${comp.kwhA.toFixed(2)} kWh · ${rateTextA}</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">${this.escapeHtml(comp.periodLabelB)} (Target)</span>
          <div class="metric-value">${this.escapeHtml(this._formatSnapshotMoney(comp.costB, snapB))}</div>
          <div class="metric-subtext">${comp.kwhB.toFixed(2)} kWh · ${rateTextB}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Bill Difference</span>
            ${billDiffBadgeHtml}
          </div>
          ${billDiffValueHtml}
          <div class="metric-subtext">${billDiffSubtext}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Energy Difference</span>
            <span class="badge ${isKwhInc ? 'badge-burgundy' : 'badge-cooling'}">${kwhIcon} ${Math.abs(comp.kwhPercentDiff).toFixed(1)}%</span>
          </div>
          <div class="metric-value">
            ${isKwhInc ? '+' : (comp.kwhDiff < 0 ? '-' : '')}${Math.abs(comp.kwhDiff).toFixed(2)} kWh
          </div>
          <div class="metric-subtext">${isKwhInc ? 'Higher consumption' : (comp.kwhDiff < 0 ? 'Energy conserved' : 'Identical units')}</div>
        </div>
      </div>
    `;

    // Render comparison chart (disable monetary plot when currencies differ or are unrecorded)
    if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
      WattWatchCharts.renderComparisonChart(comp, {
        curA,
        curB,
        canCompareMoney: bothSameRecordedCurrency,
        currency: bothSameRecordedCurrency ? curA : null
      });
    }
  },

  /**
   * Opens snapshot detail modal
   */
  openDetailsModal(id = null) {
    let snap = null;
    if (id) {
      const history = WattWatchStorage.getHistory();
      snap = history.find(h => h.id === id);
    }

    this.activeDetailSnapshotId = id || null;

    const titleEl = document.getElementById('historyDetailTitle');
    const bodyEl = document.getElementById('historyDetailBody');

    if (snap) {
      if (titleEl) titleEl.textContent = `Billing Snapshot: ${snap.periodLabel || snap.period}`;

      const recCur = this._getSnapshotCurrency(snap);
      const snapSym = recCur ? this.escapeHtml(recCur) : '';
      const formatDetailMoney = (val) => {
        const n = this._parseStrictNonNegNum(val);
        if (n === null) return '--';
        return recCur
          ? WattWatchCalculations.formatCurrency(n, recCur)
          : WattWatchCalculations.formatNumber(n, 2);
      };

      let breakdownRows = '';
      const appliances = Array.isArray(snap.appliancesSnapshot) ? snap.appliancesSnapshot : [];

      appliances.forEach((app, idx) => {
        const safeCat = WattWatchAppliances.escapeHtml(app?.category || 'Other');
        const validWatts = this._parseStrictNonNegNum(app?.powerWatts);
        const validQty = this._parseStrictNonNegInt(app?.quantity, 0);
        const validHoursRaw = this._parseStrictNonNegNum(app?.dailyHours);
        const validHours = (validHoursRaw !== null && validHoursRaw <= 24) ? validHoursRaw : null;
        const validKwh = this._parseStrictNonNegNum(app?.monthlyKwh);

        breakdownRows += `
          <tr>
            <td>#${idx + 1}</td>
            <td><strong>${WattWatchAppliances.escapeHtml(app?.name || 'Unknown Appliance')}</strong> (${safeCat})</td>
            <td>${validWatts !== null ? `${validWatts}W` : '--'}</td>
            <td>${validQty !== null ? validQty : '--'}</td>
            <td>${validHours !== null ? `${validHours}h/day` : '--'}</td>
            <td><strong>${validKwh !== null ? this.escapeHtml(WattWatchCalculations.formatKwh(validKwh)) : '-- kWh'}</strong></td>
            <td><strong>${this.escapeHtml(formatDetailMoney(app?.monthlyCost))}</strong></td>
          </tr>
        `;
      });

      if (bodyEl) {
        const validTotalKwh = this._parseStrictNonNegNum(snap.totalKwh);
        const validTotalCost = this._parseStrictNonNegNum(snap.totalCost);
        const validActualKwh = this._parseStrictNonNegNum(snap.actualKwh);
        const validActualCost = this._parseStrictNonNegNum(snap.actualCost);
        const hasActualData = (validActualCost !== null) || (validActualKwh !== null);

        const firstValidNum = (...vals) => {
          for (const v of vals) {
            const n = this._parseStrictNonNegNum(v);
            if (n !== null) return n;
          }
          return null;
        };
        const appliedRate = firstValidNum(snap.effectiveRate, snap.tariffBreakdown?.effectiveRatePerKwh, snap.electricityRate, snap.flatRate);

        const legacyCurrBanner = !recCur
          ? `<div style="background: rgba(197, 155, 67, 0.12); border: 1px solid rgba(197, 155, 67, 0.35); border-radius: var(--radius-md); padding: 0.65rem 0.9rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--text-primary);">
               <strong>Currency Information Unavailable:</strong> This legacy snapshot did not record a currency symbol. Monetary figures are displayed as unlabelled numeric values without applying your current account currency.
             </div>`
          : '';

        let varianceDisplay = 'N/A';
        let varianceColor = 'var(--emerald-primary, #10b981)';
        if (validActualCost !== null && validTotalCost !== null) {
          const diff = validActualCost - validTotalCost;
          if (diff > 0) varianceColor = '#ef4444';
          const prefix = diff > 0 ? '+' : (diff < 0 ? '-' : '');
          varianceDisplay = `${prefix}${this.escapeHtml(formatDetailMoney(Math.abs(diff)))}`;
        }

        const actualBlock = hasActualData ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">Utility Meter &amp; Actual Verification</div>
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Actual Metered Energy:</span>
                <div style="font-weight: 700; color: var(--royal-blue); font-size: 1.05rem;">
                  ${validActualKwh !== null ? `${validActualKwh.toFixed(1)} kWh` : 'N/A'}
                </div>
              </div>
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Actual Utility Bill:</span>
                <div style="font-weight: 700; color: var(--deep-burgundy); font-size: 1.05rem;">
                  ${validActualCost !== null ? this.escapeHtml(formatDetailMoney(validActualCost)) : 'N/A'}
                </div>
              </div>
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Bill Variance vs Estimate:</span>
                <div style="font-weight: 700; font-size: 1.05rem; color: ${varianceColor};">
                  ${varianceDisplay}
                </div>
              </div>
            </div>
            ${snap.cycleStartDate && snap.cycleEndDate ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">Cycle Period: ${WattWatchAppliances.escapeHtml(snap.cycleStartDate)} to ${WattWatchAppliances.escapeHtml(snap.cycleEndDate)}</div>` : ''}
          </div>
        ` : '';

        bodyEl.innerHTML = `
          ${legacyCurrBanner}
          <div class="history-detail-stats" style="margin-bottom: 1.25rem;">
            <div style="background: var(--soft-blue); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Energy</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--royal-blue);">${validTotalKwh !== null ? WattWatchCalculations.formatKwh(validTotalKwh) : '-- kWh'}</div>
            </div>
            <div style="background: var(--light-burgundy); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Bill</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--deep-burgundy);">${this.escapeHtml(formatDetailMoney(validTotalCost))}</div>
            </div>
            <div style="background: var(--antique-gold-subtle); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Tariff Applied</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--text-gold);">
                ${appliedRate !== null ? `${snapSym}${appliedRate.toFixed(2)}/u` : 'Unavailable'}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${snap.tariffModel === 'slab' ? 'Progressive Slab (Effective Avg)' : 'Uniform Flat Rate'}
              </div>
            </div>
          </div>

          ${actualBlock}

          <h4 style="font-family: var(--font-serif); margin-bottom: 0.75rem;">Frozen Appliance Inventory (${appliances.length} Items)</h4>
          <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
            <table class="appliance-table" style="font-size: 0.825rem;">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Appliance</th>
                  <th>Power</th>
                  <th>Qty</th>
                  <th>Usage</th>
                  <th>Energy</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                ${breakdownRows || '<tr><td colspan="7">No appliance items recorded.</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Billing Snapshot Details';
      if (bodyEl) {
        bodyEl.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">No snapshot details available.</p>';
      }
    }

    const modal = document.getElementById('historyDetailModal');
    if (modal) {
      this.previousActiveElement = document.activeElement;
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.open(modal, this.previousActiveElement);
      } else {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      }
    }
  },

  closeDetailsModal() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.close(modal);
      } else {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          try {
            this.previousActiveElement.focus();
          } catch (e) {
            // ignore
          }
        }
      }
    }
    this.activeDetailSnapshotId = null;
  },

  /**
   * Prompts confirmation and deletes a snapshot
   */
  confirmDelete(id, label) {
    WattWatchApp.openConfirmDialog({
      title: 'Delete Billing Record?',
      message: `Are you sure you want to delete the historical record for ${label}? This cannot be undone.`,
      confirmText: 'Delete Record',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        const ok = WattWatchStorage.deleteSnapshot(id);
        if (!ok) {
          WattWatchApp.showToast(`Failed to delete record for ${label}.`, 'error', 'Delete Failed');
          return;
        }
        WattWatchApp.showToast(`Deleted record for ${label}`, 'info', 'Record Removed');
        WattWatchApp.refreshAll();
      }
    });
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchHistory = WattWatchHistory;
}
