/**
 * WATTWATCH - Main Application Controller
 * Coordinates navigation, dashboard updates, budget tracking, analytics,
 * historical snapshots, simulators, PDF reporting, modals, and toasts.
 */

const WattWatchApp = {
  currentView: 'overview',
  analyticsTimeframe: 'monthly',
  confirmCallback: null,
  budgetWarnedSession: { 75: false, 90: false, 100: false },

  /**
   * Application bootstrap
   */
  init() {
    console.log('[WattWatch] Initializing Advanced Energy Management & Analytics Platform...');

    // Restore theme preference
    this.initTheme();

    // Initialize submodules
    WattWatchAppliances.init();
    WattWatchHistory.init();
    WattWatchSimulator.init();
    WattWatchReport.init();
    if (typeof WattWatchAuth !== 'undefined') {
      WattWatchAuth.init();
    }

    // Bind navigation & UI controls
    this.bindNavigation();
    this.bindSettings();
    this.bindModalKeyboards();
    this.bindFirstTimeGuide();

    // First-time user guidance
    this.renderFirstTimeGuide();

    // Refresh all views, summaries and charts
    this.refreshAll();
  },

  /**
   * Initializes theme from localStorage
   */
  initTheme() {
    const savedTheme = WattWatchStorage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeControls(savedTheme);

    // Bind Topbar Theme Toggle Button
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(nextTheme);
      });
    }
  },

  /**
   * Sets active theme and re-renders charts for correct colors
   * @param {string} theme - 'light' | 'dark'
   */
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    WattWatchStorage.saveTheme(theme);
    this.updateThemeControls(theme);

    // Refresh charts to adapt to palette
    const settings = WattWatchStorage.getSettings();
    const appliances = WattWatchStorage.getAppliances();
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);

    if (this.currentView === 'overview') {
      WattWatchCharts.renderOverviewCharts(summary);
    } else if (this.currentView === 'analytics') {
      WattWatchCharts.renderAnalyticsCharts(summary, this.analyticsTimeframe);
    } else if (this.currentView === 'history') {
      WattWatchCharts.renderHistoryTrendChart(WattWatchStorage.getHistory());
    }

    this.showToast(`Switched to ${theme === 'dark' ? 'Royal Dark' : 'Beige & Royal Blue'} theme`, 'info', 'Theme Updated');
  },

  updateThemeControls(theme) {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme');
      themeBtn.innerHTML = theme === 'dark'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }

    document.querySelectorAll('.theme-option-card').forEach(card => {
      if (card.getAttribute('data-theme-val') === theme) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  },

  /**
   * Binds navigation links, sidebar drawer, and mobile menu toggle
   */
  bindNavigation() {
    const navLinks = document.querySelectorAll('.nav-item-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view');
        if (targetView) {
          this.navigateTo(targetView);
          this.closeMobileDrawer();
        }
      });
    });

    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (mobileToggle && sidebar && backdrop) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
        backdrop.classList.toggle('is-visible');
      });

      backdrop.addEventListener('click', () => {
        this.closeMobileDrawer();
      });
    }

    // Analytics Timeframe Pills
    const timePills = document.querySelectorAll('.time-pill-btn');
    timePills.forEach(btn => {
      btn.addEventListener('click', () => {
        timePills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.analyticsTimeframe = btn.getAttribute('data-timeframe') || 'monthly';

        const settings = WattWatchStorage.getSettings();
        const appliances = WattWatchStorage.getAppliances();
        const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
        WattWatchCharts.renderAnalyticsTimelineChart(summary, this.analyticsTimeframe);
      });
    });
  },

  closeMobileDrawer() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-visible');
  },

  /**
   * Switches visible view tab
   * @param {string} viewId - 'overview' | 'appliances' | 'history' | 'analytics' | 'simulator' | 'recommendations' | 'settings'
   */
  navigateTo(viewId) {
    this.currentView = viewId;

    document.querySelectorAll('.nav-item-link').forEach(link => {
      if (link.getAttribute('data-view') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`view-${viewId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    const titleMap = {
      overview: { title: 'Overview', sub: 'Comprehensive household energy metrics & bill projections' },
      appliances: { title: 'Appliance Inventory', sub: 'Manage electrical ratings, operating schedules, and unit counts' },
      history: { title: 'Monthly Bill History', sub: 'Frozen billing snapshots, historical trends, and month-to-month comparisons' },
      analytics: { title: 'Consumption Analytics', sub: 'Granular load distributions, category allocations, and carbon footprint' },
      simulator: { title: 'Simulators & Tariffs', sub: 'Model energy-efficient appliance upgrades and test progressive slab tariffs' },
      recommendations: { title: 'Energy Optimization Tips', sub: 'Actionable data-driven strategies to reduce consumption and costs' },
      settings: { title: 'System Settings', sub: 'Configure tariffs, budget limits, carbon factors, data portability, and display' }
    };

    const info = titleMap[viewId] || { title: 'WattWatch Dashboard', sub: 'Advanced Energy Analytics' };
    const titleEl = document.getElementById('topbarPageTitle');
    const subEl = document.getElementById('topbarPageSubtitle');

    if (titleEl) titleEl.textContent = info.title;
    if (subEl) subEl.textContent = info.sub;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.refreshAll();
  },

  /**
   * Refreshes all data models, UI summaries, tables, charts, and recommendations
   */
  refreshAll() {
    const settings = WattWatchStorage.getSettings();
    const appliances = WattWatchStorage.getAppliances();

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const advancedTariff = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

    // Determine final estimated bill (flat or advanced slab)
    const effectiveBill = summary.totalMonthlyCost;

    // Update topbar & sidebar indicators
    this.updateGlobalTariffPills(summary, settings, effectiveBill, advancedTariff);

    // Update Overview View (metrics & budget tracker)
    this.renderOverviewMetrics(summary, effectiveBill, settings, advancedTariff);
    this.renderFirstTimeGuide();
    this.updateMonthComparison(summary);
    this.updateSettingsGuestMigration();

    // Update Appliances View
    WattWatchAppliances.renderApplianceTable();

    // Update History View
    WattWatchHistory.renderHistoryView();

    // Update Simulators
    WattWatchSimulator.populateApplianceSelect();
    WattWatchSimulator.populateTariffSandbox();

    // Update Analytics View
    this.renderAnalyticsData(summary, effectiveBill, settings);

    // Update Recommendations View
    this.renderRecommendationsView(appliances, summary.ratePerKwh);

    // Update Settings View Inputs
    this.populateSettingsFields(settings);

    // Update active charts based on current view
    if (this.currentView === 'overview') {
      WattWatchCharts.renderOverviewCharts(summary);
    } else if (this.currentView === 'analytics') {
      WattWatchCharts.renderAnalyticsCharts(summary, this.analyticsTimeframe);
    } else if (this.currentView === 'history') {
      WattWatchCharts.renderHistoryTrendChart(WattWatchStorage.getHistory());
    }
  },

  /**
   * Updates topbar pills and sidebar tariff badges
   */
  updateGlobalTariffPills(summary, settings, effectiveBill, advancedTariff) {
    const isSlab = settings.tariffModel === 'slab';
    const rawRate = Number(settings.electricityRate);
    const flatRate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate) && rawRate >= 0)
      ? rawRate
      : 8.00;
    const effectiveRate = isSlab ? advancedTariff.effectiveRatePerKwh : flatRate;

    const rateStr = isSlab
      ? `Slab Tariff (₹${effectiveRate.toFixed(2)}/kWh avg)`
      : `${settings.currency || '₹'}${effectiveRate.toFixed(2)} / kWh`;

    const topbarTariff = document.getElementById('topbarTariffRate');
    if (topbarTariff) topbarTariff.textContent = rateStr;

    const topbarBill = document.getElementById('topbarMonthlyBill');
    if (topbarBill) topbarBill.textContent = WattWatchCalculations.formatCurrency(effectiveBill, settings.currency);

    const sidebarRate = document.getElementById('sidebarTariffVal');
    if (sidebarRate) {
      sidebarRate.textContent = isSlab
        ? `₹${effectiveRate.toFixed(2)}/u`
        : `${settings.currency || '₹'}${effectiveRate.toFixed(2)}`;
      sidebarRate.title = isSlab
        ? `Progressive Slab Tariff: Effective rate is ₹${effectiveRate.toFixed(2)}/kWh across ${summary.totalMonthlyKwh.toFixed(1)} kWh`
        : `Uniform Flat Rate: ₹${effectiveRate.toFixed(2)} per kWh`;
    }

    const sidebarLabel = document.querySelector('.sidebar-tariff-card .tariff-info-label');
    if (sidebarLabel) {
      sidebarLabel.textContent = isSlab ? 'Effective Tariff' : 'Active Tariff';
    }

    const badge = document.getElementById('navApplianceCountBadge');
    if (badge) {
      badge.textContent = summary.totalAppliancesCount.toString();
    }
  },

  /**
   * Populates Overview metrics and the Electricity Budget Tracker widget
   */
  renderOverviewMetrics(summary, effectiveBill, settings, advancedTariff) {
    const elKwh = document.getElementById('metricTotalMonthlyKwh');
    const elBill = document.getElementById('metricEstimatedMonthlyBill');
    const elCount = document.getElementById('metricAppliancesCount');
    const elDaily = document.getElementById('metricAvgDailyKwh');

    if (elKwh) elKwh.textContent = WattWatchCalculations.formatKwh(summary.totalMonthlyKwh);
    if (elBill) elBill.textContent = WattWatchCalculations.formatCurrency(effectiveBill);
    if (elCount) elCount.textContent = `${summary.totalAppliancesCount} (${summary.totalUnits} Units)`;
    if (elDaily) elDaily.textContent = WattWatchCalculations.formatKwh(summary.totalDailyKwh);

    // Update metric bill subtext with Effective Rate in slab mode
    const elBillSubtext = document.getElementById('metricBillSubtext');
    if (elBillSubtext) {
      const rawRate = Number(settings.electricityRate);
      const flatRate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate) && rawRate >= 0)
        ? rawRate
        : 8.00;

      if (settings.tariffModel === 'slab') {
        const effRate = advancedTariff ? advancedTariff.effectiveRatePerKwh : (summary.totalMonthlyKwh > 0 ? effectiveBill / summary.totalMonthlyKwh : flatRate);
        elBillSubtext.innerHTML = `<span>Effective Rate: <strong style="color: var(--royal-blue);">₹${effRate.toFixed(2)} / kWh</strong> (Slab)</span>`;
      } else {
        elBillSubtext.innerHTML = `<span>Flat rate at ₹${flatRate.toFixed(2)} / kWh</span>`;
      }
    }

    // Spotlight Banner
    const spotlightTitle = document.getElementById('spotlightApplianceTitle');
    const spotlightDesc = document.getElementById('spotlightApplianceDesc');

    if (summary.highestAppliance && summary.totalMonthlyKwh > 0) {
      const top = summary.highestAppliance;
      if (spotlightTitle) spotlightTitle.textContent = `${top.name} (${top.sharePercentage.toFixed(1)}% of total load)`;
      if (spotlightDesc) {
        spotlightDesc.textContent =
          `Consumes ${WattWatchCalculations.formatKwh(top.monthlyKwh)} monthly (${WattWatchCalculations.formatCurrency(top.monthlyCost)} est. cost). Operating at ${top.powerWatts}W for ${top.dailyHours} hrs/day across ${top.quantity} unit(s). Check Energy Tips for conservation opportunities.`;
      }
    } else {
      if (spotlightTitle) spotlightTitle.textContent = 'No Active Consumption Recorded';
      if (spotlightDesc) spotlightDesc.textContent = 'Add your appliances to identify your primary energy consumers and calculate estimated monthly electricity charges.';
    }

    // Budget Tracker Widget
    this.renderBudgetTracker(effectiveBill, settings.budgetInr);
  },

  /**
   * Renders the Electricity Budget Tracker widget on Overview
   */
  renderBudgetTracker(effectiveBill, budgetInr) {
    const budgetCard = document.getElementById('overviewBudgetWidget');
    if (!budgetCard) return;

    const b = WattWatchCalculations.calculateBudgetStatus(effectiveBill, budgetInr);

    const elAmount = document.getElementById('budgetCardAmount');
    const elRemaining = document.getElementById('budgetCardRemaining');
    const elPercent = document.getElementById('budgetCardPercent');
    const elProgress = document.getElementById('budgetCardProgressFill');
    const elBadge = document.getElementById('budgetCardBadge');

    if (!b.hasBudget) {
      if (elAmount) elAmount.textContent = '₹0.00 (Unset)';
      if (elRemaining) elRemaining.textContent = 'Set budget in Settings';
      if (elPercent) elPercent.textContent = '0%';
      if (elProgress) {
        elProgress.style.width = '0%';
        elProgress.style.backgroundColor = 'var(--muted-slate)';
      }
      if (elBadge) {
        elBadge.className = 'badge badge-outline';
        elBadge.textContent = 'No Budget Set';
      }
      return;
    }

    if (elAmount) elAmount.textContent = WattWatchCalculations.formatCurrency(b.budget);
    if (elRemaining) {
      elRemaining.textContent = b.remaining >= 0
        ? `₹${b.remaining.toFixed(2)} remaining`
        : `₹${Math.abs(b.remaining).toFixed(2)} over budget`;
    }
    if (elPercent) elPercent.textContent = `${Math.min(999, b.utilizationPercent).toFixed(1)}% utilized`;

    // Progress bar width & color
    const cappedWidth = Math.min(100, b.utilizationPercent);
    if (elProgress) {
      elProgress.style.width = `${cappedWidth}%`;
      if (b.status === 'exceeded') {
        elProgress.style.backgroundColor = '#A92639';
      } else if (b.status === 'critical') {
        elProgress.style.backgroundColor = 'var(--deep-burgundy)';
      } else if (b.status === 'warning') {
        elProgress.style.backgroundColor = 'var(--antique-gold)';
      } else {
        elProgress.style.backgroundColor = 'var(--royal-blue)';
      }
    }

    if (elBadge) {
      if (b.status === 'exceeded') {
        elBadge.className = 'badge badge-burgundy';
        elBadge.textContent = 'Exceeded (≥100%)';
      } else if (b.status === 'critical') {
        elBadge.className = 'badge badge-burgundy';
        elBadge.textContent = 'Critical (≥90%)';
      } else if (b.status === 'warning') {
        elBadge.className = 'badge badge-gold';
        elBadge.textContent = 'Caution (≥75%)';
      } else {
        elBadge.className = 'badge badge-cooling';
        elBadge.textContent = 'Within Budget';
      }
    }

    // Trigger warning notifications when thresholds are crossed once per session
    if (b.warningLevel === 100 && !this.budgetWarnedSession[100]) {
      this.budgetWarnedSession[100] = true;
      this.showToast(b.message, 'error', 'Budget Exceeded');
    } else if (b.warningLevel === 90 && !this.budgetWarnedSession[90]) {
      this.budgetWarnedSession[90] = true;
      this.showToast(b.message, 'warning', 'Budget Alert (≥90%)');
    } else if (b.warningLevel === 75 && !this.budgetWarnedSession[75]) {
      this.budgetWarnedSession[75] = true;
      this.showToast(b.message, 'info', 'Budget Notice (≥75%)');
    }
  },

  /**
   * Renders metrics, matrix table, and carbon analytics on Analytics view
   */
  renderAnalyticsData(summary, effectiveBill, settings) {
    const elDailyAvg = document.getElementById('analyticsDailyAvg');
    const elMonthlyTotal = document.getElementById('analyticsMonthlyTotal');
    const elPeakCat = document.getElementById('analyticsPeakCategory');
    const elDailyCost = document.getElementById('analyticsDailyCost');

    if (elDailyAvg) elDailyAvg.textContent = WattWatchCalculations.formatKwh(summary.totalDailyKwh);
    if (elMonthlyTotal) elMonthlyTotal.textContent = WattWatchCalculations.formatKwh(summary.totalMonthlyKwh);
    if (elDailyCost) elDailyCost.textContent = WattWatchCalculations.formatCurrency(effectiveBill / 30);

    let topCatName = 'None';
    let topCatKwh = 0;
    Object.values(summary.categoryBreakdown).forEach(c => {
      if (c.kwh > topCatKwh) {
        topCatKwh = c.kwh;
        topCatName = `${c.category} (${c.percentage.toFixed(0)}%)`;
      }
    });
    if (elPeakCat) elPeakCat.textContent = topCatName;

    // Carbon Footprint Section
    const carbon = WattWatchCalculations.calculateCarbonFootprint(summary.totalMonthlyKwh, settings.carbonEmissionFactor);
    const elCarbonMonth = document.getElementById('analyticsCarbonMonthly');
    const elCarbonAnnual = document.getElementById('analyticsCarbonAnnual');
    const elCarbonTrees = document.getElementById('analyticsCarbonTrees');
    const elCarbonFactorHint = document.getElementById('analyticsCarbonFactorHint');

    if (carbon.isAvailable) {
      if (elCarbonMonth) elCarbonMonth.textContent = `${carbon.monthlyKgCO2.toFixed(1)} kg CO₂e`;
      if (elCarbonAnnual) elCarbonAnnual.textContent = `${carbon.annualMetricTons.toFixed(2)} Metric Tons`;
      if (elCarbonTrees) elCarbonTrees.textContent = `${carbon.treesEquivalent} Mature Trees`;
      if (elCarbonFactorHint) elCarbonFactorHint.textContent = `Based on ${carbon.emissionFactor} kg CO₂e / kWh`;
    } else {
      if (elCarbonMonth) elCarbonMonth.textContent = 'Unavailable';
      if (elCarbonAnnual) elCarbonAnnual.textContent = 'Unavailable';
      if (elCarbonTrees) elCarbonTrees.textContent = '—';
      if (elCarbonFactorHint) elCarbonFactorHint.textContent = 'Emission factor disabled in Settings';
    }

    // Render detailed matrix breakdown table
    const tbody = document.getElementById('analyticsMatrixTableBody');
    if (!tbody) return;

    if (summary.appliances.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No appliance data available for matrix analysis.</td></tr>`;
      return;
    }

    const sorted = [...summary.appliances].sort((a, b) => b.monthlyKwh - a.monthlyKwh);
    tbody.innerHTML = '';

    sorted.forEach((app, idx) => {
      const tr = document.createElement('tr');
      const safeCategory = WattWatchAppliances.escapeHtml(app.category || 'Other');
      const safeQty = Number(app.quantity) || 1;
      const safeWatts = Number(app.powerWatts) || 0;
      const safeHours = Number(app.dailyHours) || 0;
      const safeDays = Number(app.operatingDays) || 30;

      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--text-gold);">#${idx + 1}</td>
        <td>
          <strong>${WattWatchAppliances.escapeHtml(app.name)}</strong>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${safeCategory} · ${safeQty} unit(s)</div>
        </td>
        <td>${safeWatts} W</td>
        <td>${safeHours} h / day (${safeDays} d)</td>
        <td><strong>${WattWatchCalculations.formatKwh(app.monthlyKwh)}</strong></td>
        <td><strong style="color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(app.monthlyCost)}</strong> <span style="font-size: 0.75rem; color: var(--text-secondary);">(${(Number(app.sharePercentage) || 0).toFixed(1)}%)</span></td>
      `;
      tbody.appendChild(tr);
    });
  },

  /**
   * Renders rule-based tips on Energy Tips view
   */
  renderRecommendationsView(appliances, rate) {
    const analysis = WattWatchRecommendations.generateRecommendations(appliances, rate);
    const container = document.getElementById('tipsGridContainer');
    const emptyState = document.getElementById('tipsEmptyState');

    const totalSavedCostEl = document.getElementById('tipsTotalSavingsCost');
    const totalSavedKwhEl = document.getElementById('tipsTotalSavingsKwh');

    if (totalSavedCostEl) totalSavedCostEl.textContent = WattWatchCalculations.formatCurrency(analysis.totalPotentialSavingsCost);
    if (totalSavedKwhEl) totalSavedKwhEl.textContent = WattWatchCalculations.formatKwh(analysis.totalPotentialSavingsKwh);

    if (!container) return;

    if (analysis.tips.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    container.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = '';

    analysis.tips.forEach(tip => {
      const card = document.createElement('div');
      card.className = 'tip-card';
      const safeTipCategory = WattWatchAppliances.escapeHtml(tip.category || 'General');
      card.innerHTML = `
        <div>
          <div class="tip-card-header">
            <div>
              <span class="badge ${tip.impactClass}">${WattWatchAppliances.escapeHtml(tip.impactLevel)}</span>
              <h3 class="tip-appliance-title" style="margin-top: 0.4rem;">${WattWatchAppliances.escapeHtml(tip.applianceName)}</h3>
            </div>
            <span class="badge badge-outline" style="border: 1px solid var(--border-card);">${safeTipCategory}</span>
          </div>
          <div class="tip-reason">
            <strong>Diagnosis:</strong> ${WattWatchAppliances.escapeHtml(tip.reason)}
          </div>
          <div class="tip-action-box">
            <span class="tip-action-label">Recommended Action:</span>
            <div class="tip-action-text">${WattWatchAppliances.escapeHtml(tip.suggestedAction)}</div>
          </div>
        </div>
        <div class="tip-savings-row">
          <div>
            <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Potential Monthly Savings</div>
            <div class="tip-savings-pill">${WattWatchCalculations.formatCurrency(tip.savedCostMonthly)} <span style="font-size: 0.78rem; font-family: var(--font-sans); color: var(--royal-blue); font-weight: 500;">(${WattWatchCalculations.formatKwh(tip.savedKwhMonthly)})</span></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Est. Annual Savings</div>
            <div style="font-family: var(--font-serif); font-size: 1rem; font-weight: 600; color: var(--text-gold);">${WattWatchCalculations.formatCurrency(tip.annualSavingsCost)}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  /**
   * Binds settings controls (Tariff, Budget, Carbon Factor, JSON Export/Import, Sample Data, Clear)
   */
  bindSettings() {
    // Tariff Rate Input (Flat)
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput) {
      rateInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0) val = 8.00;
        WattWatchStorage.saveSettings({ electricityRate: val });
        this.refreshAll();
        this.showToast(`Electricity flat rate updated to ₹${val.toFixed(2)}/kWh`, 'success', 'Rate Updated');
      });
    }

    // Rate Steppers
    const btnRateMinus = document.getElementById('btnRateStepMinus');
    const btnRatePlus = document.getElementById('btnRateStepPlus');
    if (btnRateMinus && rateInput) {
      btnRateMinus.addEventListener('click', () => {
        let current = parseFloat(rateInput.value) || 8.00;
        current = Math.max(0.5, current - 0.5);
        rateInput.value = current.toFixed(2);
        rateInput.dispatchEvent(new Event('change'));
      });
    }
    if (btnRatePlus && rateInput) {
      btnRatePlus.addEventListener('click', () => {
        let current = parseFloat(rateInput.value) || 8.00;
        current = Math.min(100, current + 0.5);
        rateInput.value = current.toFixed(2);
        rateInput.dispatchEvent(new Event('change'));
      });
    }

    // Quick Rate Presets
    const presetPills = document.querySelectorAll('.rate-preset-btn');
    presetPills.forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.getAttribute('data-rate'));
        if (!isNaN(rate) && rateInput) {
          rateInput.value = rate.toFixed(2);
          rateInput.dispatchEvent(new Event('change'));
        }
      });
    });

    // Budget Configuration Input
    const budgetInput = document.getElementById('settingsMonthlyBudget');
    if (budgetInput) {
      budgetInput.addEventListener('change', (e) => {
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        WattWatchStorage.saveSettings({ budgetInr: val });
        // Reset session warning so user gets fresh alerts for new budget
        this.budgetWarnedSession = { 75: false, 90: false, 100: false };
        this.refreshAll();
        this.showToast(`Monthly electricity budget set to ₹${val.toLocaleString('en-IN')}`, 'success', 'Budget Saved');
      });
    }

    // Carbon Emission Factor Input
    const carbonInput = document.getElementById('settingsCarbonFactor');
    if (carbonInput) {
      carbonInput.addEventListener('change', (e) => {
        const valStr = e.target.value.trim();
        const factor = (valStr === '' || isNaN(Number(valStr)) || Number(valStr) <= 0) ? null : Number(valStr);
        WattWatchStorage.saveSettings({ carbonEmissionFactor: factor });
        this.refreshAll();
        this.showToast(factor !== null ? `Grid carbon factor set to ${factor} kg CO₂e/kWh` : 'Carbon factor disabled', 'info', 'Carbon Setting');
      });
    }

    // Theme Selector Cards in Settings
    const themeCards = document.querySelectorAll('.theme-option-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.getAttribute('data-theme-val');
        this.setTheme(theme);
      });
    });

    // Load Sample Household Button
    const btnLoadSample = document.getElementById('btnLoadSampleData');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        this.openConfirmDialog({
          title: 'Load Curated Sample Household?',
          message: 'This will replace your current appliances with a realistic set of 7 modern household appliances (Inverter AC, BLDC fans, Refrigerator, OLED TV, Geyser, LEDs, Workstation).',
          confirmText: 'Load Sample Data',
          confirmClass: 'btn-primary',
          onConfirm: () => {
            WattWatchStorage.loadSampleHousehold();
            this.refreshAll();
            this.showToast('Sample household loaded with 7 active appliances', 'success', 'Sample Data Ready');
          }
        });
      });
    }

    // Export JSON Full Backup Button
    const btnExport = document.getElementById('btnExportJson');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const ok = WattWatchStorage.exportBackupJSONFile();
        if (ok) this.showToast('Full configuration & history exported as JSON', 'success', 'Export Complete');
        else this.showToast('Failed to export JSON backup', 'error', 'Export Error');
      });
    }

    // Export Appliances CSV Button
    const btnExportAppCsv = document.getElementById('btnExportAppliancesCsv');
    if (btnExportAppCsv) {
      btnExportAppCsv.addEventListener('click', () => {
        const ok = WattWatchStorage.exportAppliancesCSV();
        if (ok) this.showToast('Appliance inventory exported to CSV', 'success', 'Export Complete');
        else this.showToast('Failed to export appliances CSV', 'error', 'Export Error');
      });
    }

    // Export History CSV Button
    const btnExportHistCsv = document.getElementById('btnExportHistoryCsv');
    if (btnExportHistCsv) {
      btnExportHistCsv.addEventListener('click', () => {
        const ok = WattWatchStorage.exportHistoryCSV();
        if (ok) this.showToast('Billing history exported to CSV', 'success', 'Export Complete');
        else this.showToast('Failed to export history CSV', 'error', 'Export Error');
      });
    }

    // Show Quick Start Guide Button
    const btnShowGuide = document.getElementById('btnShowGuide');
    if (btnShowGuide) {
      btnShowGuide.addEventListener('click', () => {
        WattWatchStorage.setGuideDismissed(false);
        this.navigateTo('overview');
        this.renderFirstTimeGuide();
        const guideCard = document.getElementById('firstTimeGuideCard');
        if (guideCard) {
          guideCard.scrollIntoView({ behavior: 'smooth' });
        }
        this.showToast('Getting Started Guide opened', 'info', 'Quick Start Guide');
      });
    }

    // Migrate Guest Data into Account Button
    const btnMigrateGuest = document.getElementById('btnSettingsMigrateGuest');
    if (btnMigrateGuest) {
      btnMigrateGuest.addEventListener('click', () => {
        const uid = WattWatchStorage.getActiveUser();
        if (!uid) {
          this.showToast('Please sign in to an account to transfer guest data.', 'warning', 'Sign In Required');
          return;
        }
        const res = WattWatchStorage.migrateGuestData(uid);
        if (res.success) {
          this.showToast(`Successfully transferred ${res.transferredAppliances} appliance(s) and ${res.transferredHistory} record(s) to your account.`, 'success', 'Migration Complete');
          this.refreshAll();
        } else {
          this.showToast('Migration failed: ' + (res.error || 'Unknown error'), 'error', 'Error');
        }
      });
    }

    // Import JSON File Trigger & Input
    const fileInput = document.getElementById('importJsonFileInput');
    const btnImport = document.getElementById('btnTriggerImportJson');
    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const rawText = event.target.result;
          let parsed = null;
          try {
            parsed = JSON.parse(rawText);
          } catch (err) {
            this.showToast('Invalid JSON file format. Please select a valid WattWatch backup.', 'error', 'Import Error');
            fileInput.value = '';
            return;
          }

          if (!parsed || !Array.isArray(parsed.appliances)) {
            this.showToast('Invalid backup file: missing appliances list.', 'error', 'Import Error');
            fileInput.value = '';
            return;
          }

          const existingApps = WattWatchStorage.getAppliances();
          const existingHist = WattWatchStorage.getHistory();
          const hasExisting = existingApps.length > 0 || existingHist.length > 0;

          const executeImport = (mode) => {
            const res = WattWatchStorage.importDataJSON(rawText, { mode });
            if (res.success) {
              this.refreshAll();
              const histMsg = res.historyCount ? ` and ${res.historyCount} snapshot(s)` : '';
              const skippedMsg = res.skippedCount ? ` (${res.skippedCount} duplicate items skipped)` : '';
              const mergeMsg = res.mode === 'merge' ? ' (Merged safely)' : ' (Replaced current inventory)';
              this.showToast(`Successfully imported ${res.count} appliance(s)${histMsg}${skippedMsg}${mergeMsg}`, 'success', 'Import Successful');
            } else {
              this.showToast(res.error || 'Failed to import data', 'error', 'Import Error');
            }
            fileInput.value = '';
          };

          if (hasExisting) {
            this.openConfirmDialog({
              title: 'Merge Backup with Current Data',
              message: `You currently have ${existingApps.length} appliance(s) and ${existingHist.length} bill record(s). Importing will safely merge the backup file into your existing records, adding new items while preserving your existing appliances and snapshots without duplicates. Click "Merge Data" to proceed, or "Cancel" to keep your current data unchanged.`,
              confirmText: 'Merge Data',
              cancelText: 'Cancel',
              confirmClass: 'btn-primary',
              onConfirm: () => {
                executeImport('merge');
              }
            });
            fileInput.value = '';
          } else {
            executeImport('merge');
          }
        };
        reader.readAsText(file);
      });
    }

    // Clear Application Data Button
    const btnClear = document.getElementById('btnClearAllData');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.openConfirmDialog({
          title: 'Reset All Application Data?',
          message: 'Are you sure you want to completely erase all appliances, historical snapshots, and restore default settings? This cannot be undone.',
          confirmText: 'Reset Everything',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            WattWatchStorage.clearAllData();
            this.refreshAll();
            this.showToast('All appliances and historical records cleared', 'info', 'Data Reset');
          }
        });
      });
    }
  },

  populateSettingsFields(settings) {
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput && document.activeElement !== rateInput) {
      const rawRate = Number(settings.electricityRate);
      const flatRate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate) && rawRate >= 0)
        ? rawRate
        : 8.00;
      rateInput.value = flatRate.toFixed(2);
    }

    const budgetInput = document.getElementById('settingsMonthlyBudget');
    if (budgetInput && document.activeElement !== budgetInput) {
      budgetInput.value = Number(settings.budgetInr || 0);
    }

    const carbonInput = document.getElementById('settingsCarbonFactor');
    if (carbonInput && document.activeElement !== carbonInput) {
      carbonInput.value = settings.carbonEmissionFactor !== null ? Number(settings.carbonEmissionFactor).toFixed(2) : '';
    }

    // Active Tariff Mode Banner updates
    const modelBadge = document.getElementById('settingsTariffModeBadge');
    const modelName = document.getElementById('settingsActiveModelName');
    const effRateVal = document.getElementById('settingsEffectiveRateVal');
    const actionPrompt = document.getElementById('settingsTariffActionPrompt');

    const appliances = WattWatchStorage.getAppliances();
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const isSlab = settings.tariffModel === 'slab';

    if (modelBadge) {
      modelBadge.className = isSlab ? 'badge badge-gold' : 'badge badge-blue';
      modelBadge.textContent = isSlab ? 'Slab Mode Active' : 'Flat Mode Active';
    }
    if (modelName) {
      modelName.textContent = isSlab ? 'Progressive Multi-Slab Tariff' : 'Uniform Flat Rate';
    }
    const rawFlat = Number(settings.electricityRate);
    const flatRate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawFlat))
      ? Math.max(0, rawFlat)
      : 8.00;

    const rawFixed = Number(settings.fixedCharges);
    const fixedCharges = (settings.fixedCharges !== undefined && settings.fixedCharges !== null && settings.fixedCharges !== '' && !isNaN(rawFixed))
      ? Math.max(0, rawFixed)
      : 110.00;

    const rawTax = Number(settings.additionalTaxPercent);
    const taxPercent = (settings.additionalTaxPercent !== undefined && settings.additionalTaxPercent !== null && settings.additionalTaxPercent !== '' && !isNaN(rawTax))
      ? Math.max(0, rawTax)
      : 5.0;

    if (effRateVal) {
      effRateVal.textContent = isSlab
        ? `₹${summary.effectiveRatePerKwh.toFixed(2)} / kWh (Effective)`
        : `₹${flatRate.toFixed(2)} / kWh`;
    }
    if (actionPrompt) {
      actionPrompt.innerHTML = isSlab
        ? `Progressive tiers, fixed meter charge (₹${fixedCharges.toFixed(2)}), and duty (${taxPercent.toFixed(1)}%) are active. <a href="#simulator" onclick="WattWatchApp.navigateTo('simulator'); return false;" style="color: var(--royal-blue); font-weight: 600; text-decoration: underline;">Configure Slabs in Simulator &rarr;</a>`
        : `Current billing uses a uniform flat rate. To configure progressive tiered slabs and fixed charges, <a href="#simulator" onclick="WattWatchApp.navigateTo('simulator'); return false;" style="color: var(--royal-blue); font-weight: 600; text-decoration: underline;">Open Tariff Calculator &rarr;</a>`;
    }
  },

  /**
   * Keyboard shortcuts & modal listeners (Esc closes modal)
   */
  bindModalKeyboards() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        WattWatchAppliances.closeModal();
        WattWatchHistory.closeDetailsModal();
        WattWatchReport.closeReportModal();
        this.closeConfirmDialog();
        if (typeof WattWatchAuth !== 'undefined' && WattWatchAuth.hasUserChosenSession) {
          WattWatchAuth.closeModal();
        }
      }
    });

    // Close on backdrop clicks for standard modals
    ['applianceModal', 'confirmModal', 'historyDetailModal', 'reportModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('is-open');
          }
        });
      }
    });

    // For authModal, backdrop click must not bypass the startup authentication gate
    const authModal = document.getElementById('authModal');
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          if (typeof WattWatchAuth !== 'undefined' && WattWatchAuth.hasUserChosenSession) {
            WattWatchAuth.closeModal();
          }
        }
      });
    }
  },

  /**
   * Reusable Custom Confirmation Dialog
   */
  openConfirmDialog({ title, message, confirmText, confirmClass, onConfirm }) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    document.getElementById('confirmModalTitle').textContent = title || 'Confirmation Required';
    document.getElementById('confirmModalMessage').textContent = message || 'Are you sure you want to proceed?';

    const btnConfirm = document.getElementById('confirmModalOkBtn');
    btnConfirm.textContent = confirmText || 'Confirm';
    btnConfirm.className = `btn ${confirmClass || 'btn-primary'}`;

    this.confirmCallback = onConfirm;

    modal.classList.add('is-open');
    btnConfirm.focus();
  },

  confirmAction() {
    if (typeof this.confirmCallback === 'function') {
      this.confirmCallback();
    }
    this.closeConfirmDialog();
  },

  closeConfirmDialog() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('is-open');
    this.confirmCallback = null;
  },

  /**
   * Renders or hides the first-time user guidance card based on saved dismissal state
   */
  renderFirstTimeGuide() {
    const guideCard = document.getElementById('firstTimeGuideCard');
    if (!guideCard) return;

    const isDismissed = WattWatchStorage.isGuideDismissed();
    guideCard.style.display = isDismissed ? 'none' : 'block';
  },

  /**
   * Binds dismissal buttons on the first-time user guidance card
   */
  bindFirstTimeGuide() {
    const btnDismiss = document.getElementById('btnDismissGuide');
    const btnDismissSec = document.getElementById('btnDismissGuideSecondary');
    const onDismiss = () => {
      WattWatchStorage.setGuideDismissed(true);
      this.renderFirstTimeGuide();
      this.showToast('Guide dismissed. You can reopen it anytime from Settings.', 'info', 'Quick Start Guide');
    };

    if (btnDismiss) btnDismiss.addEventListener('click', onDismiss);
    if (btnDismissSec) btnDismissSec.addEventListener('click', onDismiss);
  },

  /**
   * Updates visibility and record counts for Guest Data Migration in Settings
   */
  updateSettingsGuestMigration() {
    const card = document.getElementById('settingsGuestMigrationCard');
    const desc = document.getElementById('settingsGuestMigrationDesc');
    if (!card) return;

    const activeUser = WattWatchStorage.getActiveUser();
    const guestData = WattWatchStorage.hasGuestData();

    if (activeUser && guestData.hasData) {
      card.style.display = 'block';
      if (desc) {
        desc.textContent = `Found ${guestData.appliancesCount} appliance(s) and ${guestData.historyCount} historical snapshot(s) in local guest storage. Transfer them safely into your account without overwriting existing account records.`;
      }
    } else {
      card.style.display = 'none';
    }
  },

  /**
   * Returns the period string (YYYY-MM) and label for the previous calendar month.
   * Correctly handles year transitions (e.g. Jan 2027 -> Dec 2026).
   * @param {Date} [referenceDate=new Date()]
   * @returns {{ period: string, label: string, year: number, month: number }}
   */
  getPreviousCalendarMonth(referenceDate = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
    const prevDate = new Date(year, month - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonthNum = String(prevDate.getMonth() + 1).padStart(2, '0');
    const period = `${prevYear}-${prevMonthNum}`;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const label = `${monthNames[prevDate.getMonth()]} ${prevYear}`;
    return { period, label, year: prevYear, month: prevDate.getMonth() + 1 };
  },

  /**
   * Renders Month-over-Month Energy Consumption Comparison card on Overview
   * Compares current month projected usage strictly against previous calendar month's saved billing snapshot.
   * Never silently substitutes older snapshots.
   * @param {Object} summary - Current household calculated summary
   */
  updateMonthComparison(summary) {
    const container = document.getElementById('overviewComparisonContent');
    const badge = document.getElementById('overviewComparisonBadge');
    if (!container) return;

    const currentKwh = summary ? Number(summary.totalMonthlyKwh || 0) : 0;
    const currentCost = summary ? Number(summary.totalMonthlyCost || 0) : 0;
    const history = WattWatchStorage.getHistory() || [];

    const prevMonth = this.getPreviousCalendarMonth();
    const prevRecord = Array.isArray(history)
      ? history.find(h => h && h.period === prevMonth.period)
      : null;

    // If previous calendar month snapshot does not exist, display clear empty state
    if (!prevRecord) {
      container.innerHTML = `
        <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-secondary);">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-surface-elevated, rgba(15, 23, 42, 0.05)); margin: 0 auto 0.75rem; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h4 style="margin: 0 0 0.35rem; color: var(--text-primary); font-size: 1rem; font-family: var(--font-serif);">
            No Recorded Snapshot for ${prevMonth.label} (${prevMonth.period})
          </h4>
          <p style="font-size: 0.825rem; max-width: 520px; margin: 0 auto 1rem; line-height: 1.45;">
            Currently projecting <strong>${currentKwh.toFixed(1)} kWh</strong> for this month. A saved billing snapshot for the previous calendar month (<strong>${prevMonth.label}</strong>) is required to calculate month-over-month variances. WattWatch does not substitute older historical cycles.
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="WattWatchHistory.promptSaveSnapshot()">
              + Save Snapshot in History
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="WattWatchApp.navigateTo('history')">
              View Bill History &rarr;
            </button>
          </div>
        </div>
      `;
      if (badge) {
        badge.textContent = `No ${prevMonth.period} Snapshot`;
        badge.className = 'badge badge-outline';
      }
      return;
    }

    const prevKwh = Number(prevRecord.totalKwh || 0);
    const prevCost = Number(prevRecord.totalCost || 0);
    const kwhDiff = currentKwh - prevKwh;
    const costDiff = currentCost - prevCost;

    let kwhPercentDiff = 0;
    if (prevKwh > 0) {
      kwhPercentDiff = ((currentKwh - prevKwh) / prevKwh) * 100;
    } else if (currentKwh > 0) {
      kwhPercentDiff = 100;
    } else {
      kwhPercentDiff = 0;
    }

    let costPercentDiff = 0;
    if (prevCost > 0) {
      costPercentDiff = ((currentCost - prevCost) / prevCost) * 100;
    } else if (currentCost > 0) {
      costPercentDiff = 100;
    } else {
      costPercentDiff = 0;
    }

    const isKwhInc = kwhDiff > 0.05;
    const isKwhDec = kwhDiff < -0.05;
    const kwhBadgeClass = isKwhInc ? 'badge-burgundy' : (isKwhDec ? 'badge-cooling' : 'badge-gold');
    const kwhIcon = isKwhInc ? '▲' : (isKwhDec ? '▼' : '—');
    const kwhTrendText = isKwhInc
      ? `Increased by ${kwhDiff.toFixed(1)} kWh (+${kwhPercentDiff.toFixed(1)}%)`
      : (isKwhDec ? `Decreased by ${Math.abs(kwhDiff).toFixed(1)} kWh (${kwhPercentDiff.toFixed(1)}%)` : `Identical (0.0 kWh difference)`);

    const now = new Date();
    const currentMonthLabel = now.toLocaleString('default', { month: 'short', year: 'numeric' });
    const prevMonthLabel = prevRecord.periodLabel || prevMonth.label;

    if (badge) {
      badge.textContent = isKwhInc
        ? `Increased vs ${prevMonth.label}`
        : (isKwhDec ? `Decreased vs ${prevMonth.label}` : `Same as ${prevMonth.label}`);
      badge.className = `badge ${kwhBadgeClass}`;
    }

    const maxKwh = Math.max(currentKwh, prevKwh, 1);
    const curBarWidth = Math.min(100, Math.round((currentKwh / maxKwh) * 100));
    const prevBarWidth = Math.min(100, Math.round((prevKwh / maxKwh) * 100));

    container.innerHTML = `
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.25rem;">
        <div class="metric-card">
          <span class="metric-title">Current Month (Projected)</span>
          <div class="metric-value">${currentKwh.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 500;">kWh</span></div>
          <div class="metric-subtext">${currentMonthLabel} · ${WattWatchCalculations.formatCurrency(currentCost)}</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">Previous Month (${prevMonthLabel})</span>
          <div class="metric-value">${prevKwh.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 500;">kWh</span></div>
          <div class="metric-subtext">Recorded Snapshot · ${WattWatchCalculations.formatCurrency(prevCost)}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Energy Variance vs ${prevMonth.label}</span>
            <span class="badge ${kwhBadgeClass}">${kwhIcon} ${Math.abs(kwhPercentDiff).toFixed(1)}%</span>
          </div>
          <div class="metric-value" style="color: ${isKwhInc ? 'var(--deep-burgundy)' : (isKwhDec ? 'var(--royal-blue)' : 'var(--text-primary)')}; font-size: 1.15rem;">
            ${kwhTrendText}
          </div>
          <div class="metric-subtext">
            Estimated Cost Delta: <strong>${costDiff >= 0 ? '+' : '-'}${WattWatchCalculations.formatCurrency(Math.abs(costDiff))}</strong> (${costPercentDiff >= 0 ? '+' : ''}${costPercentDiff.toFixed(1)}%)
          </div>
        </div>
      </div>

      <!-- Visual Bar Comparison -->
      <div style="background: var(--bg-surface-elevated, rgba(15, 23, 42, 0.02)); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 1rem;">
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
            <span style="font-weight: 600; color: var(--text-primary);">Current (${currentMonthLabel})</span>
            <span style="color: var(--royal-blue); font-weight: 700;">${currentKwh.toFixed(1)} kWh</span>
          </div>
          <div style="height: 10px; background: rgba(0,0,0,0.06); border-radius: 5px; overflow: hidden;">
            <div style="width: ${curBarWidth}%; height: 100%; background: var(--royal-blue); border-radius: 5px; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
            <span style="font-weight: 600; color: var(--text-primary);">${prevMonthLabel}</span>
            <span style="color: var(--antique-gold); font-weight: 700;">${prevKwh.toFixed(1)} kWh</span>
          </div>
          <div style="height: 10px; background: rgba(0,0,0,0.06); border-radius: 5px; overflow: hidden;">
            <div style="width: ${prevBarWidth}%; height: 100%; background: var(--antique-gold); border-radius: 5px; transition: width 0.4s ease;"></div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Luxury Toast Notification
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'info' | 'warning'
   * @param {string} title
   */
  showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-content">
        ${title ? `<div class="toast-title">${WattWatchAppliances.escapeHtml(title)}</div>` : ''}
        <div class="toast-message">${WattWatchAppliances.escapeHtml(message)}</div>
      </div>
      <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 250);
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 4200);
  }
};

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  WattWatchApp.init();
});
