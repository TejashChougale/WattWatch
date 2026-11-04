/**
 * WATTWATCH 2.0 - Bill History & Month-to-Month Comparison Module
 * Manages permanent monthly bill snapshots, duplicate period protection,
 * historical breakdown inspection, and comparative deltas.
 */

const WattWatchHistory = {
  activeDetailSnapshotId: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
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
    if (!/^\d{4}-\d{2}$/.test(trimmedPeriod)) {
      WattWatchApp.showToast('Please enter a valid format: YYYY-MM (e.g. 2026-11)', 'error', 'Invalid Period');
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
  executeSaveSnapshot(period, periodLabel) {
    const settings = WattWatchStorage.getSettings();
    const appliances = WattWatchStorage.getAppliances();

    if (appliances.length === 0) {
      WattWatchApp.showToast('Cannot save empty snapshot. Add appliances first.', 'warning', 'No Appliances');
      return;
    }

    const rate = settings.electricityRate || 8.00;
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, rate);
    const tariffDetails = WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

    // Deep-clone appliances snapshot so subsequent edits to appliances never alter past records
    const frozenAppliances = JSON.parse(JSON.stringify(summary.appliances));

    const snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      period,
      periodLabel,
      totalKwh: summary.totalMonthlyKwh,
      totalCost: settings.tariffModel === 'slab' ? tariffDetails.totalCost : summary.totalMonthlyCost,
      electricityRate: rate,
      tariffModel: settings.tariffModel || 'flat',
      tariffBreakdown: tariffDetails,
      appliancesCount: summary.totalAppliancesCount,
      totalUnits: summary.totalUnits,
      appliancesSnapshot: frozenAppliances,
      createdAt: Date.now()
    };

    WattWatchStorage.saveSnapshot(snapshot);
    WattWatchApp.showToast(`Snapshot for ${periodLabel} saved successfully`, 'success', 'Snapshot Saved');
    WattWatchApp.refreshAll();
  },

  /**
   * Renders the complete Bill History view (table, KPI highlights, comparison)
   */
  renderHistoryView() {
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
      const dateStr = new Date(record.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const modelBadge = record.tariffModel === 'slab'
        ? `<span class="badge badge-gold" title="Progressive Slab Tariff">Slab</span>`
        : `<span class="badge badge-blue" title="Flat Rate">Flat</span>`;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; font-family: var(--font-serif); font-size: 0.95rem; color: var(--text-primary);">
            ${WattWatchAppliances.escapeHtml(record.periodLabel || record.period)}
          </div>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${record.period}</div>
        </td>
        <td>
          <span class="kwh-val">${WattWatchCalculations.formatKwh(record.totalKwh)}</span>
        </td>
        <td>
          <span class="cost-val">${WattWatchCalculations.formatCurrency(record.totalCost)}</span>
        </td>
        <td>
          ${modelBadge}
          <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.25rem;">
            ₹${Number(record.electricityRate).toFixed(2)}/u
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
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="View Snapshot Details" onclick="WattWatchHistory.openDetailsModal('${record.id}')" aria-label="View Details for ${record.period}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" title="Delete Snapshot" onclick="WattWatchHistory.confirmDelete('${record.id}', '${record.periodLabel || record.period}')" aria-label="Delete ${record.period}" style="color: #A92639;">
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

    // Render historical trend chart
    WattWatchCharts.renderHistoryTrendChart(history);
  },

  /**
   * Updates peak and lowest recorded bill KPIs
   */
  updateHistoryKpis(history) {
    const elPeak = document.getElementById('historyHighestBill');
    const elLow = document.getElementById('historyLowestBill');
    const elCount = document.getElementById('historyRecordsCount');

    if (!elPeak || !elLow || !elCount) return;

    if (history.length === 0) {
      elPeak.textContent = '₹0.00';
      elLow.textContent = '₹0.00';
      elCount.textContent = '0 Records';
      return;
    }

    const sortedByCost = [...history].sort((a, b) => b.totalCost - a.totalCost);
    const highest = sortedByCost[0];
    const lowest = sortedByCost[sortedByCost.length - 1];

    elPeak.textContent = WattWatchCalculations.formatCurrency(highest.totalCost);
    elPeak.title = `Highest: ${highest.periodLabel} (${highest.totalKwh.toFixed(1)} kWh)`;

    elLow.textContent = WattWatchCalculations.formatCurrency(lowest.totalCost);
    elLow.title = `Lowest: ${lowest.periodLabel} (${lowest.totalKwh.toFixed(1)} kWh)`;

    elCount.textContent = `${history.length} Month${history.length > 1 ? 's' : ''}`;
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
      return;
    }

    const comp = WattWatchCalculations.compareSnapshots(snapA, snapB);
    if (!comp) return;

    const isCostInc = comp.costDiff > 0;
    const isKwhInc = comp.kwhDiff > 0;

    const badgeCostColor = isCostInc ? 'badge-burgundy' : 'badge-cooling';
    const costIcon = isCostInc ? '▲' : (comp.costDiff < 0 ? '▼' : '—');
    const kwhIcon = isKwhInc ? '▲' : (comp.kwhDiff < 0 ? '▼' : '—');

    resultBox.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 1.5rem;">
        <div class="metric-card">
          <span class="metric-title">${comp.periodLabelA} (Baseline)</span>
          <div class="metric-value">${WattWatchCalculations.formatCurrency(comp.costA)}</div>
          <div class="metric-subtext">${comp.kwhA.toFixed(2)} kWh · ₹${snapA.electricityRate}/unit</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">${comp.periodLabelB} (Target)</span>
          <div class="metric-value">${WattWatchCalculations.formatCurrency(comp.costB)}</div>
          <div class="metric-subtext">${comp.kwhB.toFixed(2)} kWh · ₹${snapB.electricityRate}/unit</div>
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
    WattWatchCharts.renderComparisonChart(comp);
  },

  /**
   * Opens snapshot detail modal
   */
  openDetailsModal(id) {
    const history = WattWatchStorage.getHistory();
    const snap = history.find(h => h.id === id);
    if (!snap) return;

    this.activeDetailSnapshotId = id;

    const titleEl = document.getElementById('historyDetailTitle');
    const bodyEl = document.getElementById('historyDetailBody');
    if (!titleEl || !bodyEl) return;

    titleEl.textContent = `Billing Snapshot: ${snap.periodLabel || snap.period}`;

    let breakdownRows = '';
    const appliances = snap.appliancesSnapshot || [];

    appliances.forEach((app, idx) => {
      breakdownRows += `
        <tr>
          <td>#${idx + 1}</td>
          <td><strong>${WattWatchAppliances.escapeHtml(app.name)}</strong> (${app.category})</td>
          <td>${app.powerWatts}W</td>
          <td>${app.quantity}</td>
          <td>${app.dailyHours}h/day</td>
          <td><strong>${WattWatchCalculations.formatKwh(app.monthlyKwh)}</strong></td>
          <td><strong>${WattWatchCalculations.formatCurrency(app.monthlyCost)}</strong></td>
        </tr>
      `;
    });

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
          <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: var(--text-gold);">₹${Number(snap.electricityRate).toFixed(2)}/u</div>
        </div>
      </div>

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

    const modal = document.getElementById('historyDetailModal');
    if (modal) modal.classList.add('is-open');
  },

  closeDetailsModal() {
    const modal = document.getElementById('historyDetailModal');
    if (modal) modal.classList.remove('is-open');
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
