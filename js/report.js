/**
 * WATTWATCH - PDF Monthly Report Generator Module
 * Generates an executive, print-perfect energy intelligence report
 * complete with logo, billing period, appliance matrix, budget status, and disclaimers.
 */

const WattWatchReport = {
  _eventsBound: false,
  previousActiveElement: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Report trigger buttons
    const btnNavReport = document.getElementById('btnOpenReportModal');
    if (btnNavReport) {
      btnNavReport.addEventListener('click', () => this.openReportModal());
    }

    const btnPeriodChange = document.getElementById('reportPeriodSelect');
    if (btnPeriodChange) {
      btnPeriodChange.addEventListener('change', () => this.updateReportPreview());
    }

    const btnPrint = document.getElementById('btnExecutePrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => this.printReport());
    }
  },

  /**
   * Opens the Report Configuration Modal
   */
  openReportModal() {
    const select = document.getElementById('reportPeriodSelect');
    if (!select) return;

    const history = WattWatchStorage.getHistory();
    const now = new Date();
    const currentPeriodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()} (Current Live Estimate)`;

    select.innerHTML = `<option value="current">${currentLabel}</option>`;

    history.forEach(rec => {
      const opt = document.createElement('option');
      opt.value = rec.id;
      opt.textContent = `${rec.periodLabel || rec.period} (Historical Snapshot - ${WattWatchCalculations.formatCurrency(rec.totalCost)})`;
      select.appendChild(opt);
    });

    this.updateReportPreview();

    const modal = document.getElementById('reportModal');
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

  closeReportModal() {
    const modal = document.getElementById('reportModal');
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
  },

  /**
   * Builds the preview content inside the modal container
   */
  updateReportPreview() {
    const select = document.getElementById('reportPeriodSelect');
    const container = document.getElementById('reportPreviewArea');
    if (!select || !container) return;

    const selectedVal = select.value;
    const settings = WattWatchStorage.getSettings();
    let reportData = null;

    if (selectedVal === 'current') {
      const appliances = WattWatchStorage.getAppliances();
      const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
      const tariff = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

      const now = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      reportData = {
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        periodLabel,
        totalKwh: summary.totalMonthlyKwh,
        totalCost: summary.totalMonthlyCost,
        rate: summary.ratePerKwh,
        effectiveRate: summary.effectiveRatePerKwh,
        tariffModel: settings.tariffModel || 'flat',
        tariffDetails: tariff,
        appliances: summary.appliances,
        appliancesCount: summary.totalAppliancesCount,
        totalUnits: summary.totalUnits,
        generatedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      };
    } else {
      const history = WattWatchStorage.getHistory();
      const snap = history.find(h => h.id === selectedVal);
      if (!snap) return;

      reportData = {
        period: snap.period,
        periodLabel: snap.periodLabel || snap.period,
        totalKwh: snap.totalKwh,
        totalCost: snap.totalCost,
        rate: snap.electricityRate,
        effectiveRate: Number(snap.effectiveRate || snap.tariffBreakdown?.effectiveRatePerKwh || snap.electricityRate),
        tariffModel: snap.tariffModel || 'flat',
        tariffDetails: snap.tariffBreakdown,
        appliances: snap.appliancesSnapshot || [],
        appliancesCount: snap.appliancesCount,
        totalUnits: snap.totalUnits,
        generatedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      };
    }

    // Budget check
    const budgetStatus = WattWatchCalculations.calculateBudgetStatus(reportData.totalCost, settings.budgetInr);

    // Carbon check
    const carbonStatus = WattWatchCalculations.calculateCarbonFootprint(reportData.totalKwh, settings.carbonEmissionFactor);

    // Recommendations preview
    const rawAppliances = reportData.appliances;
    const recs = WattWatchRecommendations.generateRecommendations(rawAppliances, reportData.rate);

    let rowsHtml = '';
    reportData.appliances.forEach((app, idx) => {
      const safeCat = WattWatchAppliances.escapeHtml(app.category || 'Other');
      const safeWatts = Number(app.powerWatts) || 0;
      const safeQty = Number(app.quantity) || 1;
      const safeHours = Number(app.dailyHours) || 0;
      rowsHtml += `
        <tr>
          <td>#${idx + 1}</td>
          <td><strong>${WattWatchAppliances.escapeHtml(app.name)}</strong></td>
          <td>${safeCat}</td>
          <td>${safeWatts}W</td>
          <td>${safeQty}</td>
          <td>${safeHours} hrs/day</td>
          <td>${WattWatchCalculations.formatKwh(app.monthlyKwh)}</td>
          <td><strong>${WattWatchCalculations.formatCurrency(app.monthlyCost)}</strong></td>
        </tr>
      `;
    });

    let tipsHtml = '';
    recs.tips.slice(0, 3).forEach(tip => {
      tipsHtml += `
        <div style="border-left: 3px solid var(--antique-gold); padding: 0.5rem 0.85rem; background: rgba(185, 154, 98, 0.08); margin-bottom: 0.5rem; font-size: 0.825rem;">
          <strong>${WattWatchAppliances.escapeHtml(tip.applianceName)}:</strong> ${WattWatchAppliances.escapeHtml(tip.suggestedAction)} 
          <span style="color: var(--deep-burgundy); font-weight: 600;">(Potential savings: ${WattWatchCalculations.formatCurrency(tip.savedCostMonthly)}/mo)</span>
        </div>
      `;
    });

    container.innerHTML = `
      <!-- Printable Executive Document Wrapper -->
      <div class="report-document-body" id="printableReportContent">
        <!-- Header Strip -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #172B55; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="assets/logo.svg" alt="WattWatch Logo" style="width: 48px; height: 48px;">
            <div>
              <h1 style="font-family: var(--font-heading); font-size: 1.6rem; color: #172B55; margin: 0; line-height: 1.1;">WATTWATCH</h1>
              <div style="font-size: 0.75rem; letter-spacing: 0.15em; color: #B99A62; font-weight: 700; text-transform: uppercase;">Energy Intelligence Platform</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-heading); font-size: 1.35rem; color: #6E293F; font-weight: 700;">MONTHLY ENERGY AUDIT</div>
            <div style="font-size: 0.85rem; color: #687386;">Billing Period: <strong>${WattWatchAppliances.escapeHtml(reportData.periodLabel || reportData.period)}</strong></div>
            <div style="font-size: 0.75rem; color: #687386;">Generated on: ${WattWatchAppliances.escapeHtml(reportData.generatedAt)}</div>
          </div>
        </div>

        <!-- KPI Metric Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Total Consumption</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #172B55;">${WattWatchCalculations.formatKwh(reportData.totalKwh)}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Estimated Bill</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #6E293F;">${WattWatchCalculations.formatCurrency(reportData.totalCost)}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Tariff Model</div>
            <div style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 600; color: #172B55;">
              ${reportData.tariffModel === 'slab' ? 'Slab (Eff. ₹' + Number(reportData.effectiveRate || reportData.rate).toFixed(2) + '/u)' : 'Flat ₹' + Number(reportData.rate).toFixed(2) + '/u'}
            </div>
            <div style="font-size: 0.7rem; color: #687386;">${reportData.tariffModel === 'slab' ? 'Effective Tariff Rate' : 'Base Tariff'}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Appliances Tracked</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #172B55;">${reportData.appliancesCount} Items</div>
            <div style="font-size: 0.7rem; color: #687386;">${reportData.totalUnits} Total Units</div>
          </div>
        </div>

        <!-- Budget & Carbon Status Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.25); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #172B55; text-transform: uppercase; margin-bottom: 0.25rem;">Budget Utilization</div>
            <div style="font-size: 0.85rem; color: #172B55;">
              ${budgetStatus.hasBudget
                ? `Budget: <strong>${WattWatchCalculations.formatCurrency(budgetStatus.budget)}</strong> · Used: <strong>${budgetStatus.utilizationPercent.toFixed(1)}%</strong> (${budgetStatus.statusLabel})`
                : 'No monthly electricity budget currently set.'}
            </div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.25); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #172B55; text-transform: uppercase; margin-bottom: 0.25rem;">Carbon Footprint</div>
            <div style="font-size: 0.85rem; color: #172B55;">
              ${carbonStatus.isAvailable
                ? `Estimated Monthly Emissions: <strong>${carbonStatus.monthlyKgCO2.toFixed(1)} kg CO₂e</strong> (${carbonStatus.annualMetricTons.toFixed(2)} tons/yr)`
                : 'Carbon emission factor unconfigured.'}
            </div>
          </div>
        </div>

        <!-- Appliance Itemization Table -->
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
            Appliance Consumption Breakdown
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="background: #E5EAF2; border-bottom: 2px solid #172B55;">
                <th style="padding: 6px 8px;">#</th>
                <th style="padding: 6px 8px;">Appliance Name</th>
                <th style="padding: 6px 8px;">Category</th>
                <th style="padding: 6px 8px;">Rating</th>
                <th style="padding: 6px 8px;">Qty</th>
                <th style="padding: 6px 8px;">Usage</th>
                <th style="padding: 6px 8px;">Monthly Energy</th>
                <th style="padding: 6px 8px;">Estimated Cost</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="padding: 12px; text-align: center;">No appliances recorded.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Energy Saving Recommendations Section -->
        ${recs.tips.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
              Key Energy Conservation Recommendations
            </h3>
            ${tipsHtml}
          </div>
        ` : ''}

        <!-- Official Report Disclaimer -->
        <div style="border-top: 1px solid #B99A62; padding-top: 0.75rem; margin-top: 1.5rem; font-size: 0.72rem; color: #687386; line-height: 1.4;">
          <strong>Official Disclaimer:</strong> This document is an estimated analytical summary generated by the WattWatch platform based upon nominal equipment ratings, user-reported operating durations, and configured tariff coefficients. It does not constitute a legally binding utility bill, tax invoice, or authoritative meter audit from any state DISCOM or electricity supply undertaking.
        </div>
      </div>
    `;
  },

  /**
   * Invokes native browser print dialog configured to output high-fidelity PDF
   */
  printReport() {
    window.print();
  }
};
