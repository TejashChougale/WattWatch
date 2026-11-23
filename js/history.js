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

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const tariffDetails = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

    if (!summary.isValid || !tariffDetails.isValid || !WattWatchCalculations.isFiniteNumber(summary.totalMonthlyKwh) || !WattWatchCalculations.isFiniteNumber(summary.totalMonthlyCost)) {
      WattWatchApp.showToast('Cannot save snapshot: current calculation contains invalid numeric values or settings.', 'error', 'Invalid Calculations');
      return;
    }

    // Deep-clone appliances snapshot so subsequent edits to appliances never alter past records
    const frozenAppliances = JSON.parse(JSON.stringify(summary.appliances));

    const isSlab = settings.tariffModel === 'slab';
    const effectiveRate = tariffDetails.effectiveRatePerKwh;
    const rateCheck = WattWatchCalculations.validateTariffRate(settings.electricityRate, 8.00);
    const flatRate = !isNaN(rateCheck) ? rateCheck : 8.00;

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
      tariffBreakdown: tariffDetails,
      appliancesCount: summary.totalAppliancesCount,
      totalUnits: summary.totalUnits,
      appliancesSnapshot: frozenAppliances,
      createdAt: Date.now()
    };

    // Attach actual utility readings if present in active meter tracking or passed explicitly
    const meter = WattWatchStorage.getMeterTracking();
    if (meter) {
      if (meter.actualUnits !== null && Number.isFinite(Number(meter.actualUnits))) snapshot.actualKwh = Number(meter.actualUnits);
      if (meter.actualCost !== null && Number.isFinite(Number(meter.actualCost))) snapshot.actualCost = Number(meter.actualCost);
      if (meter.cycleStartDate) snapshot.cycleStartDate = meter.cycleStartDate;
      if (meter.cycleEndDate) snapshot.cycleEndDate = meter.cycleEndDate;
      if (meter.startReading !== null && Number.isFinite(Number(meter.startReading))) snapshot.meterReadingStart = Number(meter.startReading);
      if (meter.currentReading !== null && Number.isFinite(Number(meter.currentReading))) snapshot.meterReadingEnd = Number(meter.currentReading);
    }

    if (optionalActual && typeof optionalActual === 'object') {
      if (optionalActual.actualKwh !== undefined && optionalActual.actualKwh !== null && !isNaN(Number(optionalActual.actualKwh))) snapshot.actualKwh = Number(optionalActual.actualKwh);
      if (optionalActual.actualCost !== undefined && optionalActual.actualCost !== null && !isNaN(Number(optionalActual.actualCost))) snapshot.actualCost = Number(optionalActual.actualCost);
      if (optionalActual.cycleStartDate) snapshot.cycleStartDate = optionalActual.cycleStartDate;
      if (optionalActual.cycleEndDate) snapshot.cycleEndDate = optionalActual.cycleEndDate;
      if (optionalActual.meterReadingStart !== undefined && optionalActual.meterReadingStart !== null && !isNaN(Number(optionalActual.meterReadingStart))) snapshot.meterReadingStart = Number(optionalActual.meterReadingStart);
      if (optionalActual.meterReadingEnd !== undefined && optionalActual.meterReadingEnd !== null && !isNaN(Number(optionalActual.meterReadingEnd))) snapshot.meterReadingEnd = Number(optionalActual.meterReadingEnd);
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
      if (tableWrap) tableWrap.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      if (comparisonSection) comparisonSection.style.display = 'none';
      this.updateHistoryKpis([]);
      return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
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
      const rawEff = record.effectiveRate ?? record.tariffBreakdown?.effectiveRatePerKwh ?? record.electricityRate;
      const numEff = Number(rawEff);
      const effRate = (!isNaN(numEff) && numEff >= 0) ? numEff : 8.00;

      const rawFlatRecord = record.flatRate ?? record.electricityRate;
      const numFlatRecord = Number(rawFlatRecord);
      const flatRateDisp = (!isNaN(numFlatRecord) && numFlatRecord >= 0) ? numFlatRecord : 8.00;

      const modelBadge = isSlab
        ? `<span class="badge badge-gold" title="Progressive Slab Tariff: Effective rate is ₹${effRate.toFixed(2)}/kWh">Slab</span>`
        : `<span class="badge badge-blue" title="Flat Rate: ₹${flatRateDisp.toFixed(2)}/kWh">Flat</span>`;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; font-family: var(--font-serif); font-size: 0.95rem; color: var(--text-primary);">
            ${WattWatchAppliances.escapeHtml(record.periodLabel || record.period)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${WattWatchAppliances.escapeHtml(record.period)}</div>
        </td>
        <td>
          <span class="kwh-val">${WattWatchCalculations.formatKwh(record.totalKwh)}</span>
          ${(record.actualKwh !== null && record.actualKwh !== undefined)
            ? `<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">Actual: <strong>${Number(record.actualKwh).toFixed(1)} kWh</strong></div>`
            : ''
          }
        </td>
        <td>
          <span class="cost-val">${WattWatchCalculations.formatCurrency(record.totalCost)}</span>
          ${(record.actualCost !== null && record.actualCost !== undefined)
            ? `<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">
                Actual: <strong>${WattWatchCalculations.formatCurrency(record.actualCost)}</strong>
                ${(record.actualCost > record.totalCost)
                  ? `<span style="color: #ef4444; font-weight: 600;">(+₹${(record.actualCost - record.totalCost).toFixed(0)})</span>`
                  : `<span style="color: var(--emerald-primary, #10b981); font-weight: 600;">(-₹${(record.totalCost - record.actualCost).toFixed(0)})</span>`
                }
              </div>`
            : ''
          }
        </td>
        <td>
          ${modelBadge}
          <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.25rem;">
            ₹${effRate.toFixed(2)}/u${isSlab ? ' (eff.)' : ''}
          </span>
        </td>
        <td>
          ${record.appliancesCount} devices (${record.totalUnits} units)
        </td>
        <td>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${dateStr}</span>
        </td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="View Snapshot Details" data-action="view-details" data-id="${this.escapeHtml(record.id)}" aria-label="View Details for ${this.escapeHtml(record.period)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Delete Snapshot" data-action="delete" data-id="${this.escapeHtml(record.id)}" aria-label="Delete ${this.escapeHtml(record.period)}" style="color: #A92639;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
   * Initializes and renders active meter tracking card inputs and live comparison
   */
  renderMeterTrackingCard() {
    const meter = WattWatchStorage.getMeterTracking();
    const startInput = document.getElementById('meterCycleStart');
    const endInput = document.getElementById('meterCycleEnd');
    const startReadInput = document.getElementById('meterStartReading');
    const curReadInput = document.getElementById('meterCurrentReading');
    const actualCostInput = document.getElementById('meterActualCost');
    const notesInput = document.getElementById('meterNotes');

    if (meter) {
      if (startInput && !startInput.value && meter.cycleStartDate) startInput.value = meter.cycleStartDate;
      if (endInput && !endInput.value && meter.cycleEndDate) endInput.value = meter.cycleEndDate;
      if (startReadInput && !startReadInput.value && meter.startReading !== null) startReadInput.value = meter.startReading;
      if (curReadInput && !curReadInput.value && meter.currentReading !== null) curReadInput.value = meter.currentReading;
      if (actualCostInput && !actualCostInput.value && meter.actualCost !== null) actualCostInput.value = meter.actualCost;
      if (notesInput && !notesInput.value && meter.notes) notesInput.value = meter.notes;
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
      const diffCost = actualCost - expectedElapsedCost;
      const isOver = diffCost > 0.5;
      const costColor = isOver ? '#ef4444' : 'var(--emerald-primary, #10b981)';
      const costSign = diffCost > 0 ? '+' : '';
      costVarianceHtml = `
        <div style="flex: 1; min-width: 180px;">
          <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Actual Bill Charge</div>
          <div style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(actualCost)}</div>
          <div style="font-size: 0.78rem; color: ${costColor}; font-weight: 600;">
            ${costSign}${WattWatchCalculations.formatCurrency(diffCost)} vs estimate (${WattWatchCalculations.formatCurrency(expectedElapsedCost)})
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
    const validSnapshots = safeHistory.filter(h => h && typeof h === 'object' && Number.isFinite(Number(h.totalCost)) && Number(h.totalCost) >= 0);

    if (validSnapshots.length === 0) {
      elPeak.textContent = '₹0.00';
      elPeak.title = 'No historical records available';
      elLow.textContent = '₹0.00';
      elLow.title = 'No historical records available';
      elCount.textContent = '0 Records';
      return;
    }

    const sortedByCost = [...validSnapshots].sort((a, b) => Number(b.totalCost) - Number(a.totalCost));
    const highest = sortedByCost[0];
    const lowest = sortedByCost[sortedByCost.length - 1];

    elPeak.textContent = WattWatchCalculations.formatCurrency(highest.totalCost);
    elPeak.title = `Highest: ${highest.periodLabel || highest.period} (${Number(highest.totalKwh || 0).toFixed(1)} kWh)`;

    elLow.textContent = WattWatchCalculations.formatCurrency(lowest.totalCost);
    elLow.title = `Lowest: ${lowest.periodLabel || lowest.period} (${Number(lowest.totalKwh || 0).toFixed(1)} kWh)`;

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

    history.forEach((rec, idx) => {
      const optA = document.createElement('option');
      optA.value = rec.id;
      optA.textContent = `${rec.periodLabel || rec.period} (${WattWatchCalculations.formatCurrency(rec.totalCost)})`;
      selectA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = rec.id;
      optB.textContent = `${rec.periodLabel || rec.period} (${WattWatchCalculations.formatCurrency(rec.totalCost)})`;
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

    if (!snapA || !snapB) {
      resultBox.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Select two periods above to view comparison.</div>`;
      if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
        WattWatchCharts.renderComparisonChart(null);
      }
      return;
    }

    const comp = WattWatchCalculations.compareSnapshots(snapA, snapB);
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

    resultBox.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1.5rem;">
        <div class="metric-card">
          <span class="metric-title">${this.escapeHtml(comp.periodLabelA)} (Baseline)</span>
          <div class="metric-value">${WattWatchCalculations.formatCurrency(comp.costA)}</div>
          <div class="metric-subtext">${comp.kwhA.toFixed(2)} kWh · ₹${Number(snapA.effectiveRate ?? snapA.tariffBreakdown?.effectiveRatePerKwh ?? snapA.electricityRate ?? 0).toFixed(2)}/u${snapA.tariffModel === 'slab' ? ' (eff.)' : ''}</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">${this.escapeHtml(comp.periodLabelB)} (Target)</span>
          <div class="metric-value">${WattWatchCalculations.formatCurrency(comp.costB)}</div>
          <div class="metric-subtext">${comp.kwhB.toFixed(2)} kWh · ₹${Number(snapB.effectiveRate ?? snapB.tariffBreakdown?.effectiveRatePerKwh ?? snapB.electricityRate ?? 0).toFixed(2)}/u${snapB.tariffModel === 'slab' ? ' (eff.)' : ''}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Bill Difference</span>
            <span class="badge ${badgeCostColor}">${costIcon} ${Math.abs(comp.costPercentDiff).toFixed(1)}%</span>
          </div>
          <div class="metric-value" style="color: ${isCostInc ? 'var(--deep-burgundy)' : 'var(--text-primary)'};">
            ${isCostInc ? '+' : (comp.costDiff < 0 ? '-' : '')}${WattWatchCalculations.formatCurrency(Math.abs(comp.costDiff))}
          </div>
          <div class="metric-subtext">${isCostInc ? 'Increase in electricity bill' : (comp.costDiff < 0 ? 'Decrease in bill' : 'Identical bill amount')}</div>
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

    // Render comparison chart
    if (typeof WattWatchCharts !== 'undefined' && typeof WattWatchCharts.renderComparisonChart === 'function') {
      WattWatchCharts.renderComparisonChart(comp);
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

      let breakdownRows = '';
      const appliances = snap.appliancesSnapshot || [];

      appliances.forEach((app, idx) => {
        const safeCat = WattWatchAppliances.escapeHtml(app.category || 'Other');
        const safeWatts = Number(app.powerWatts) || 0;
        const safeQty = Number(app.quantity) || 1;
        const safeHours = Number(app.dailyHours) || 0;
        breakdownRows += `
          <tr>
            <td>#${idx + 1}</td>
            <td><strong>${WattWatchAppliances.escapeHtml(app.name)}</strong> (${safeCat})</td>
            <td>${safeWatts}W</td>
            <td>${safeQty}</td>
            <td>${safeHours}h/day</td>
            <td><strong>${WattWatchCalculations.formatKwh(app.monthlyKwh)}</strong></td>
            <td><strong>${WattWatchCalculations.formatCurrency(app.monthlyCost)}</strong></td>
          </tr>
        `;
      });

      if (bodyEl) {
        const hasActualData = (snap.actualCost !== null && snap.actualCost !== undefined) || (snap.actualKwh !== null && snap.actualKwh !== undefined);
        const actualBlock = hasActualData ? `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">Utility Meter &amp; Actual Verification</div>
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Actual Metered Energy:</span>
                <div style="font-weight: 700; color: var(--royal-blue); font-size: 1.05rem;">
                  ${snap.actualKwh !== null && snap.actualKwh !== undefined ? Number(snap.actualKwh).toFixed(1) + ' kWh' : 'N/A'}
                </div>
              </div>
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Actual Utility Bill:</span>
                <div style="font-weight: 700; color: var(--deep-burgundy); font-size: 1.05rem;">
                  ${snap.actualCost !== null && snap.actualCost !== undefined ? WattWatchCalculations.formatCurrency(snap.actualCost) : 'N/A'}
                </div>
              </div>
              <div>
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Bill Variance vs Estimate:</span>
                <div style="font-weight: 700; font-size: 1.05rem; color: ${(snap.actualCost !== null && snap.actualCost !== undefined && snap.actualCost > snap.totalCost) ? '#ef4444' : 'var(--emerald-primary, #10b981)'};">
                  ${snap.actualCost !== null && snap.actualCost !== undefined ? ((snap.actualCost > snap.totalCost ? '+' : '') + WattWatchCalculations.formatCurrency(snap.actualCost - snap.totalCost)) : 'N/A'}
                </div>
              </div>
            </div>
            ${snap.cycleStartDate && snap.cycleEndDate ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.4rem;">Cycle Period: ${WattWatchAppliances.escapeHtml(snap.cycleStartDate)} to ${WattWatchAppliances.escapeHtml(snap.cycleEndDate)}</div>` : ''}
          </div>
        ` : '';

        bodyEl.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
            <div style="background: var(--soft-blue); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Energy</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--royal-blue);">${WattWatchCalculations.formatKwh(snap.totalKwh)}</div>
            </div>
            <div style="background: var(--light-burgundy); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Total Bill</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(snap.totalCost)}</div>
            </div>
            <div style="background: var(--antique-gold-subtle); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Tariff Applied</div>
              <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--text-gold);">
                ₹${Number(snap.effectiveRate ?? snap.tariffBreakdown?.effectiveRatePerKwh ?? snap.electricityRate ?? 0).toFixed(2)}/u
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
        WattWatchStorage.deleteSnapshot(id);
        WattWatchApp.showToast(`Deleted record for ${label}`, 'info', 'Record Removed');
        WattWatchApp.refreshAll();
      }
    });
  }
};
