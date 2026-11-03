/**
 * WATTWATCH - Main Application Controller
 * Coordinates navigation, dashboard updates, analytics, settings, modals, and toasts.
 */

const WattWatchApp = {
  currentView: 'overview',
  analyticsTimeframe: 'monthly',
  confirmCallback: null,

  /**
   * Application bootstrap
   */
  init() {
    console.log('[WattWatch] Initializing Luxury Energy Analytics Platform...');

    // Restore theme preference
    this.initTheme();

    // Initialize submodules
    WattWatchAppliances.init();

    // Bind navigation & UI controls
    this.bindNavigation();
    this.bindSettings();
    this.bindModalKeyboards();

    // Check if first-time user: offer sample data or start fresh
    const existing = WattWatchStorage.getAppliances();
    if (existing.length === 0 && !localStorage.getItem('wattwatch_onboarded_v1')) {
      // Auto-load sample household so new users immediately see a rich, functional dashboard
      WattWatchStorage.loadSampleHousehold();
      localStorage.setItem('wattwatch_onboarded_v1', 'true');
      this.showToast('Curated sample household data loaded for preview', 'info', 'Welcome to WattWatch');
    }

    // Refresh all views and charts
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
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings.electricityRate);

    if (this.currentView === 'overview') {
      WattWatchCharts.renderOverviewCharts(summary);
    } else if (this.currentView === 'analytics') {
      WattWatchCharts.renderAnalyticsCharts(summary, this.analyticsTimeframe);
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

    // Settings page radio indicators
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
    // Nav Items
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

    // Mobile Hamburger Toggle
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
        const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings.electricityRate);
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
   * @param {string} viewId - 'overview' | 'appliances' | 'analytics' | 'recommendations' | 'settings'
   */
  navigateTo(viewId) {
    this.currentView = viewId;

    // Update active nav links
    document.querySelectorAll('.nav-item-link').forEach(link => {
      if (link.getAttribute('data-view') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Switch view panes
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`view-${viewId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    // Update Topbar Titles
    const titleMap = {
      overview: { title: 'Executive Overview', sub: 'Comprehensive household energy metrics & bill projections' },
      appliances: { title: 'Appliance Inventory', sub: 'Manage electrical ratings, operating schedules, and unit counts' },
      analytics: { title: 'Consumption Analytics', sub: 'Granular load distributions, category allocations, and comparisons' },
      recommendations: { title: 'Energy Optimization Tips', sub: 'Actionable data-driven strategies to reduce consumption and costs' },
      settings: { title: 'System Settings', sub: 'Configure tariffs, currency, data portability, and display preferences' }
    };

    const info = titleMap[viewId] || { title: 'WattWatch Dashboard', sub: 'Premium Energy Analytics' };
    const titleEl = document.getElementById('topbarPageTitle');
    const subEl = document.getElementById('topbarPageSubtitle');

    if (titleEl) titleEl.textContent = info.title;
    if (subEl) subEl.textContent = info.sub;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Re-render relevant view components
    this.refreshAll();
  },

  /**
   * Refreshes all data models, UI summaries, tables, charts, and recommendations
   */
  refreshAll() {
    const settings = WattWatchStorage.getSettings();
    const appliances = WattWatchStorage.getAppliances();
    const rate = settings.electricityRate || 8.00;

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, rate);

    // Update topbar & sidebar tariff indicators
    this.updateGlobalTariffPills(summary, settings);

    // Update Overview View
    this.renderOverviewMetrics(summary);

    // Update Appliances View
    WattWatchAppliances.renderApplianceTable();

    // Update Analytics View
    this.renderAnalyticsData(summary);

    // Update Recommendations View
    this.renderRecommendationsView(appliances, rate);

    // Update Settings View Inputs
    this.populateSettingsFields(settings);

    // Update active charts based on current view
    if (this.currentView === 'overview') {
      WattWatchCharts.renderOverviewCharts(summary);
    } else if (this.currentView === 'analytics') {
      WattWatchCharts.renderAnalyticsCharts(summary, this.analyticsTimeframe);
    }
  },

  /**
   * Updates topbar pills and sidebar tariff badges
   */
  updateGlobalTariffPills(summary, settings) {
    const rateStr = `${settings.currency || '₹'}${Number(settings.electricityRate).toFixed(2)} / kWh`;

    const topbarTariff = document.getElementById('topbarTariffRate');
    if (topbarTariff) topbarTariff.textContent = rateStr;

    const topbarBill = document.getElementById('topbarMonthlyBill');
    if (topbarBill) topbarBill.textContent = WattWatchCalculations.formatCurrency(summary.totalMonthlyCost, settings.currency);

    const sidebarRate = document.getElementById('sidebarTariffVal');
    if (sidebarRate) sidebarRate.textContent = `${settings.currency || '₹'}${Number(settings.electricityRate).toFixed(2)}`;

    // Update appliance badge counts in sidebar
    const badge = document.getElementById('navApplianceCountBadge');
    if (badge) {
      badge.textContent = summary.totalAppliancesCount.toString();
    }
  },

  /**
   * Populates the 4 executive summary cards and spotlight banner in Overview
   */
  renderOverviewMetrics(summary) {
    const elKwh = document.getElementById('metricTotalMonthlyKwh');
    const elBill = document.getElementById('metricEstimatedMonthlyBill');
    const elCount = document.getElementById('metricAppliancesCount');
    const elDaily = document.getElementById('metricAvgDailyKwh');

    if (elKwh) elKwh.textContent = WattWatchCalculations.formatKwh(summary.totalMonthlyKwh);
    if (elBill) elBill.textContent = WattWatchCalculations.formatCurrency(summary.totalMonthlyCost);
    if (elCount) elCount.textContent = `${summary.totalAppliancesCount} (${summary.totalUnits} Units)`;
    if (elDaily) elDaily.textContent = WattWatchCalculations.formatKwh(summary.totalDailyKwh);

    // Spotlight Banner: Highest consuming appliance
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
  },

  /**
   * Renders metrics and matrix table on dedicated Analytics view
   */
  renderAnalyticsData(summary) {
    const elDailyAvg = document.getElementById('analyticsDailyAvg');
    const elMonthlyTotal = document.getElementById('analyticsMonthlyTotal');
    const elPeakCat = document.getElementById('analyticsPeakCategory');
    const elDailyCost = document.getElementById('analyticsDailyCost');

    if (elDailyAvg) elDailyAvg.textContent = WattWatchCalculations.formatKwh(summary.totalDailyKwh);
    if (elMonthlyTotal) elMonthlyTotal.textContent = WattWatchCalculations.formatKwh(summary.totalMonthlyKwh);
    if (elDailyCost) elDailyCost.textContent = WattWatchCalculations.formatCurrency(summary.totalDailyKwh * summary.ratePerKwh);

    // Peak category
    let topCatName = 'None';
    let topCatKwh = 0;
    Object.values(summary.categoryBreakdown).forEach(c => {
      if (c.kwh > topCatKwh) {
        topCatKwh = c.kwh;
        topCatName = `${c.category} (${c.percentage.toFixed(0)}%)`;
      }
    });
    if (elPeakCat) elPeakCat.textContent = topCatName;

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
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--text-gold);">#${idx + 1}</td>
        <td>
          <strong>${WattWatchAppliances.escapeHtml(app.name)}</strong>
          <div style="font-size: 0.72rem; color: var(--text-secondary);">${app.category} · ${app.quantity} unit(s)</div>
        </td>
        <td>${app.powerWatts} W</td>
        <td>${app.dailyHours} h / day (${app.operatingDays} d)</td>
        <td><strong>${WattWatchCalculations.formatKwh(app.monthlyKwh)}</strong></td>
        <td><strong style="color: var(--deep-burgundy);">${WattWatchCalculations.formatCurrency(app.monthlyCost)}</strong> <span style="font-size: 0.75rem; color: var(--text-secondary);">(${app.sharePercentage.toFixed(1)}%)</span></td>
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
      card.innerHTML = `
        <div>
          <div class="tip-card-header">
            <div>
              <span class="badge ${tip.impactClass}">${tip.impactLevel}</span>
              <h3 class="tip-appliance-title" style="margin-top: 0.4rem;">${WattWatchAppliances.escapeHtml(tip.applianceName)}</h3>
            </div>
            <span class="badge badge-outline" style="border: 1px solid var(--border-card);">${tip.category}</span>
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
   * Binds settings controls (Tariff, JSON Export/Import, Sample Data, Clear)
   */
  bindSettings() {
    // Tariff Rate Input
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput) {
      rateInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 8.00;
        WattWatchStorage.saveSettings({ electricityRate: val });
        this.refreshAll();
        this.showToast(`Electricity rate updated to ₹${val.toFixed(2)}/kWh`, 'success', 'Rate Updated');
      });
    }

    // Rate Stepper Buttons
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

    // Export JSON Button
    const btnExport = document.getElementById('btnExportJson');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const jsonStr = WattWatchStorage.exportDataJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `wattwatch-data-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Configuration exported as JSON', 'success', 'Export Complete');
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
          const res = WattWatchStorage.importDataJSON(event.target.result);
          if (res.success) {
            this.refreshAll();
            this.showToast(`Successfully imported ${res.count} appliance(s)`, 'success', 'Import Successful');
          } else {
            this.showToast(res.error || 'Failed to import data', 'error', 'Import Error');
          }
          fileInput.value = '';
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
          message: 'Are you sure you want to completely erase all appliances and restore default settings? This cannot be undone.',
          confirmText: 'Reset Everything',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            WattWatchStorage.clearAllData();
            this.refreshAll();
            this.showToast('All appliances cleared and settings reset', 'info', 'Data Reset');
          }
        });
      });
    }
  },

  populateSettingsFields(settings) {
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput && document.activeElement !== rateInput) {
      rateInput.value = Number(settings.electricityRate || 8.00).toFixed(2);
    }
  },

  /**
   * Keyboard shortcuts & modal listeners (Esc closes modal)
   */
  bindModalKeyboards() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        WattWatchAppliances.closeModal();
        this.closeConfirmDialog();
      }
    });

    // Close on backdrop click for appliance modal
    const applianceModal = document.getElementById('applianceModal');
    if (applianceModal) {
      applianceModal.addEventListener('click', (e) => {
        if (e.target === applianceModal) {
          WattWatchAppliances.closeModal();
        }
      });
    }

    // Close on backdrop click for confirm modal
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          this.closeConfirmDialog();
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
