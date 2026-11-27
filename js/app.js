/**
 * WATTWATCH - Main Application Controller
 * Coordinates navigation, dashboard updates, budget tracking, analytics,
 * historical snapshots, simulators, PDF reporting, modals, and toasts.
 */

const WattWatchApp = {
  currentView: 'overview',
  analyticsTimeframe: 'monthly',
  currentTipFilter: 'all',
  confirmCallback: null,
  budgetWarnedSession: { 75: false, 90: false, 100: false },

  _eventsBound: false,
  _themeBound: false,
  previousActiveElement: null,
  _lastTipsSignature: null,

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

    // Bind navigation & UI controls (once)
    if (!this._eventsBound) {
      this._eventsBound = true;
      this.bindNavigation();
      this.bindOverviewControls();
      this.bindRecommendationsControls();
      this.bindSettings();
      this.bindModalKeyboards();
      this.bindFirstTimeGuide();
    }

    // First-time user guidance
    this.renderFirstTimeGuide();

    // Support deep-linking via URL hash (#appliances, #history, etc.)
    const initialHash = (window.location.hash || '').replace('#', '').toLowerCase();
    const validViews = ['overview', 'appliances', 'history', 'analytics', 'simulator', 'recommendations', 'settings'];
    if (validViews.includes(initialHash)) {
      this.navigateTo(initialHash, false);
    } else {
      // Refresh all views, summaries and charts
      this.refreshAll();
    }
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
    if (themeBtn && !this._themeBound) {
      this._themeBound = true;
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
        this.toggleMobileDrawer();
      });

      backdrop.addEventListener('click', () => {
        this.closeMobileDrawer();
      });
    }

    // Deep-linking hash navigation listener
    window.addEventListener('hashchange', () => {
      const hash = (window.location.hash || '').replace('#', '').toLowerCase();
      const validViews = ['overview', 'appliances', 'history', 'analytics', 'simulator', 'recommendations', 'settings'];
      if (validViews.includes(hash) && hash !== this.currentView) {
        this.navigateTo(hash, false);
      }
    });

    // Analytics Timeframe Pills
    const timePills = document.querySelectorAll('.time-pill-btn');
    timePills.forEach(btn => {
      btn.addEventListener('click', () => {
        timePills.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        this.analyticsTimeframe = btn.getAttribute('data-timeframe') || 'monthly';

        const settings = WattWatchStorage.getSettings();
        const appliances = WattWatchStorage.getAppliances();
        const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
        WattWatchCharts.renderAnalyticsTimelineChart(summary, this.analyticsTimeframe);
      });
    });

    const timePillsWrap = document.querySelector('.analytics-time-pills');
    if (timePillsWrap) {
      timePillsWrap.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
        const btns = Array.from(timePillsWrap.querySelectorAll('.time-pill-btn'));
        const curIdx = btns.indexOf(document.activeElement);
        if (curIdx === -1) return;
        e.preventDefault();
        let nextIdx = curIdx;
        if (e.key === 'ArrowRight') nextIdx = (curIdx + 1) % btns.length;
        else if (e.key === 'ArrowLeft') nextIdx = (curIdx - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = btns.length - 1;
        btns[nextIdx].focus();
        btns[nextIdx].click();
      });
    }
  },

  /**
   * Checks whether reduced motion is requested via media query or test override.
   * @returns {boolean}
   */
  _prefersReducedMotion() {
    if (this.reduceMotionOverride === true) return true;
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Triggers a brief subtle highlight pulse on an element when state updates.
   * @param {HTMLElement|null} el
   * @param {string} [cls='panel-flash']
   */
  _flashElement(el, cls = 'panel-flash') {
    if (!el || this._prefersReducedMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  },

  /**
   * Cancels active metric rAF loops / fallback timers when elements are detached or inside hidden view panes.
   */
  _cancelHiddenMetricAnimations() {
    if (!this._activeMetricEls) return;
    this._activeMetricEls.forEach(el => {
      const pane = el && el.closest ? el.closest('.view-pane') : null;
      if (!el || !el.isConnected || (pane && !pane.classList.contains('active'))) {
        if (el && el._metricRafId && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(el._metricRafId);
          el._metricRafId = null;
        }
        if (el && el._metricFallbackTimer) {
          clearTimeout(el._metricFallbackTimer);
          el._metricFallbackTimer = null;
        }
        if (el && el.isConnected && el.dataset && el.dataset.targetText !== undefined) {
          el.textContent = el.dataset.targetText;
        }
        this._activeMetricEls.delete(el);
      }
    });
  },

  /**
   * Smoothly animates a numeric metric text element only when its calculated value changes
   * and while the element is visible. Screen readers always receive the exact final value
   * via aria-label / synchronous dataset state without intermediate ticking noise.
   * @param {HTMLElement|null} el
   * @param {number} targetValue
   * @param {Function} formatter
   * @param {Object} [opts={}]
   */
  _animateMetricCounter(el, targetValue, formatter, opts = {}) {
    if (!el || typeof formatter !== 'function') return;
    if (!this._activeMetricEls) this._activeMetricEls = new Set();

    el._metricAnimToken = (el._metricAnimToken || 0) + 1;
    const animToken = el._metricAnimToken;

    const finalText = formatter(targetValue);
    if (el._metricRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(el._metricRafId);
      el._metricRafId = null;
    }
    if (el._metricFallbackTimer) {
      clearTimeout(el._metricFallbackTimer);
      el._metricFallbackTimer = null;
    }

    el.dataset.targetText = finalText;
    if (opts.setAriaLabel !== false && !el.hasAttribute('aria-labelledby')) {
      el.setAttribute('aria-label', finalText);
    }

    const numTarget = Number(targetValue);
    if (!Number.isFinite(numTarget) || numTarget < 0) {
      el.textContent = finalText;
      delete el.dataset.metricVal;
      delete el.dataset.lastVisibleVal;
      delete el.dataset.pendingAnimate;
      this._activeMetricEls.delete(el);
      return;
    }

    const pane = el.closest ? el.closest('.view-pane') : null;
    const isVisiblePane = !pane || pane.classList.contains('active');
    const prevSaved = el.dataset.metricVal !== undefined ? Number(el.dataset.metricVal) : NaN;
    const valueChanged = isNaN(prevSaved) ? numTarget > 0 : Math.abs(prevSaved - numTarget) > 1e-6;

    if (!isVisiblePane) {
      if (valueChanged) {
        el.dataset.pendingAnimate = '1';
      }
      el.dataset.metricVal = String(numTarget);
      el.textContent = finalText;
      this._activeMetricEls.delete(el);
      return;
    }

    const prevVisible = el.dataset.lastVisibleVal !== undefined ? Number(el.dataset.lastVisibleVal) : prevSaved;
    const reducedMotion = this._prefersReducedMotion();

    if (
      reducedMotion ||
      typeof requestAnimationFrame !== 'function' ||
      (Number.isFinite(prevVisible) && Math.abs(prevVisible - numTarget) < 1e-6 && el.dataset.pendingAnimate !== '1' && el.textContent.trim() === finalText) ||
      (isNaN(prevVisible) && numTarget === 0)
    ) {
      el.textContent = finalText;
      el.dataset.metricVal = String(numTarget);
      el.dataset.lastVisibleVal = String(numTarget);
      delete el.dataset.pendingAnimate;
      this._activeMetricEls.delete(el);
      return;
    }

    const startVal = Number.isFinite(prevVisible) && el.dataset.pendingAnimate !== '1'
      ? prevVisible
      : (Number.isFinite(Number(el.dataset.lastVisibleVal)) ? Number(el.dataset.lastVisibleVal) : 0);

    if (Math.abs(startVal - numTarget) < 1e-6) {
      el.textContent = finalText;
      el.dataset.metricVal = String(numTarget);
      el.dataset.lastVisibleVal = String(numTarget);
      delete el.dataset.pendingAnimate;
      this._activeMetricEls.delete(el);
      return;
    }

    el.dataset.metricVal = String(numTarget);
    el.dataset.lastVisibleVal = String(numTarget);
    delete el.dataset.pendingAnimate;
    this._activeMetricEls.add(el);

    const visualSpan = document.createElement('span');
    visualSpan.className = 'metric-count-visual';
    visualSpan.setAttribute('aria-hidden', 'true');
    visualSpan.textContent = formatter(startVal);
    el.textContent = '';
    el.appendChild(visualSpan);

    const duration = opts.duration || 320;
    const startTime = Date.now();

    const finalize = () => {
      if (el._metricRafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(el._metricRafId);
        el._metricRafId = null;
      }
      if (el._metricFallbackTimer) {
        clearTimeout(el._metricFallbackTimer);
        el._metricFallbackTimer = null;
      }
      this._activeMetricEls.delete(el);
      if (!el.isConnected || el._metricAnimToken !== animToken) return;
      el.textContent = finalText;
    };

    const step = () => {
      if (!el.isConnected || el._metricAnimToken !== animToken) {
        this._activeMetricEls.delete(el);
        return;
      }
      const curPane = el.closest ? el.closest('.view-pane') : null;
      if ((curPane && !curPane.classList.contains('active')) || this._prefersReducedMotion()) {
        finalize();
        return;
      }
      const elapsed = Math.max(0, Date.now() - startTime);
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (numTarget - startVal) * eased;

      if (t >= 1) {
        finalize();
        return;
      }

      visualSpan.textContent = formatter(current);
      el._metricRafId = requestAnimationFrame(step);
    };

    el._metricRafId = requestAnimationFrame(step);
    el._metricFallbackTimer = setTimeout(finalize, duration + 25);
  },

  /**
   * Sanitizes a badge class against an explicit allowlist.
   * @param {string} cls
   * @param {string} [fallback='badge-gold']
   * @returns {string}
   */
  _safeBadgeClass(cls, fallback = 'badge-gold') {
    const allowed = new Set([
      'badge-burgundy', 'badge-gold', 'badge-blue', 'badge-cooling',
      'badge-lighting', 'badge-kitchen', 'badge-entertainment',
      'badge-computing', 'badge-other', 'badge-outline'
    ]);
    return (typeof cls === 'string' && allowed.has(cls.trim())) ? cls.trim() : fallback;
  },

  /**
   * Binds filter buttons inside Recommendations view
   */
  bindRecommendationsControls() {
    const filterGroup = document.getElementById('tipsImpactFilters');
    if (filterGroup) {
      filterGroup.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-tip-filter]');
        if (!pill) return;
        this.setRecommendationsFilter(pill.getAttribute('data-tip-filter') || 'all');
      });
      filterGroup.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const pills = Array.from(filterGroup.querySelectorAll('[data-tip-filter]'));
        const curIdx = pills.indexOf(document.activeElement);
        if (curIdx === -1) return;
        e.preventDefault();
        let nextIdx = curIdx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (curIdx + 1) % pills.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (curIdx - 1 + pills.length) % pills.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = pills.length - 1;
        pills[nextIdx].focus();
        pills[nextIdx].click();
      });
    }

    const resetBtn = document.getElementById('btnResetTipsFilter');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.setRecommendationsFilter('all');
      });
    }

    const emptyAddBtn = document.getElementById('btnEmptyTipsAddAppliance');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => {
        if (typeof WattWatchAppliances !== 'undefined' && typeof WattWatchAppliances.openModal === 'function') {
          WattWatchAppliances.openModal();
        }
      });
    }
  },

  /**
   * Sets active recommendations filter and re-renders cards cleanly
   * @param {string} filterVal
   */
  setRecommendationsFilter(filterVal) {
    const valid = ['all', 'High Impact', 'Moderate Impact', 'Optimization'];
    this.currentTipFilter = valid.includes(filterVal) ? filterVal : 'all';

    document.querySelectorAll('#tipsImpactFilters [data-tip-filter]').forEach(btn => {
      const isMatch = btn.getAttribute('data-tip-filter') === this.currentTipFilter;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    const appliances = WattWatchStorage.getAppliances();
    const settings = WattWatchStorage.getSettings();
    this.renderRecommendationsView(appliances, settings);
  },

  /**
   * Binds timescale segmented controls on the Overview dashboard
   */
  bindOverviewControls() {
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.insights-tab');
      if (tab) {
        const tf = tab.getAttribute('data-timeframe');
        if (tf) this.setInsightsTimeframe(tf);
      }
    });

    const insightsTablist = document.querySelector('#overviewInsightsCard .insights-segmented-tabs[role="tablist"]');
    if (insightsTablist) {
      insightsTablist.addEventListener('keydown', (e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const tabs = Array.from(insightsTablist.querySelectorAll('.insights-tab[role="tab"]'));
        const curIdx = tabs.indexOf(document.activeElement);
        if (curIdx === -1) return;
        e.preventDefault();
        let nextIdx = curIdx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (curIdx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = (curIdx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;
        const targetTab = tabs[nextIdx];
        if (targetTab) {
          targetTab.focus();
          const tf = targetTab.getAttribute('data-timeframe');
          if (tf) this.setInsightsTimeframe(tf);
        }
      });
    }
  },

  closeMobileDrawer() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (sidebar) sidebar.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-visible');
    if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  },

  toggleMobileDrawer() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (!sidebar || !backdrop) return;
    const willOpen = !sidebar.classList.contains('is-open');
    if (willOpen) {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-visible');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      this.closeMobileDrawer();
    }
  },

  /**
   * Switches visible view tab
   * @param {string} viewId - 'overview' | 'appliances' | 'history' | 'analytics' | 'simulator' | 'recommendations' | 'settings'
   * @param {boolean} [updateHash=true] - Whether to update the browser URL hash
   */
  navigateTo(viewId, updateHash = true) {
    const validViews = ['overview', 'appliances', 'history', 'analytics', 'simulator', 'recommendations', 'settings'];
    const targetView = validViews.includes(viewId) ? viewId : 'overview';
    this.currentView = targetView;

    if (updateHash && typeof window !== 'undefined' && window.location) {
      if (window.location.hash !== `#${targetView}`) {
        try {
          if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
            history.replaceState(null, '', `#${targetView}`);
          } else {
            window.location.hash = targetView;
          }
        } catch (_) {}
      }
    }

    document.querySelectorAll('.nav-item-link').forEach(link => {
      if (link.getAttribute('data-view') === targetView) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`view-${targetView}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    this._cancelHiddenMetricAnimations();

    const titleMap = {
      overview: { title: 'Overview', sub: 'Comprehensive household energy metrics & bill projections' },
      appliances: { title: 'Appliance Inventory', sub: 'Manage electrical ratings, operating schedules, and unit counts' },
      history: { title: 'Monthly Bill History', sub: 'Frozen billing snapshots, historical trends, and month-to-month comparisons' },
      analytics: { title: 'Consumption Analytics', sub: 'Granular load distributions, category allocations, and carbon footprint' },
      simulator: { title: 'Simulators & Tariffs', sub: 'Model energy-efficient appliance upgrades and test progressive slab tariffs' },
      recommendations: { title: 'Energy Optimization Tips', sub: 'Actionable data-driven strategies to reduce consumption and costs' },
      settings: { title: 'System Settings', sub: 'Configure tariffs, budget limits, carbon factors, data portability, and display' }
    };

    const info = titleMap[targetView] || { title: 'WattWatch Dashboard', sub: 'Advanced Energy Analytics' };
    const titleEl = document.getElementById('topbarPageTitle');
    const subEl = document.getElementById('topbarPageSubtitle');

    if (titleEl && titleEl.textContent !== info.title) {
      titleEl.textContent = info.title;
      this._flashElement(titleEl, 'topbar-heading-fade');
    }
    if (subEl && subEl.textContent !== info.sub) {
      subEl.textContent = info.sub;
    }

    if (typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: this._prefersReducedMotion() ? 'auto' : 'smooth' });
      } catch (_) {}
    }

    this.closeMobileDrawer();
    this.refreshAll();
  },

  /**
   * Refreshes all data models, UI summaries, tables, charts, and recommendations
   */
  refreshAll() {
    // Notify user if corrupted storage was detected and safely quarantined
    if (typeof WattWatchStorage !== 'undefined' && WattWatchStorage.hasCorruptedData && WattWatchStorage.hasCorruptedData()) {
      const items = (typeof WattWatchStorage.getCorruptedItems === 'function')
        ? WattWatchStorage.getCorruptedItems()
        : (WattWatchStorage.corruptedState ? [WattWatchStorage.corruptedState] : []);
      if (typeof WattWatchStorage.clearCorruptedData === 'function') {
        WattWatchStorage.clearCorruptedData();
      } else {
        WattWatchStorage.corruptedState = null;
      }
      items.forEach(corrupted => {
        this.showToast(`Corrupted storage detected in "${corrupted?.key || 'storage'}". Safely quarantined to "${corrupted?.backupKey || 'backup'}". Clean defaults restored.`, 'warning', 'Storage Recovery');
      });
    }

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
    this.renderRecommendationsView(appliances, settings);

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
   * Resolves validated currency from settings without substituting ₹ when missing or invalid.
   * When an explicit partial settings object omits `.currency`, resolves from stored account settings.
   * @private
   */
  _getValidatedCurrency(settings = null) {
    if (settings && typeof settings === 'object' && Object.prototype.hasOwnProperty.call(settings, 'currency')) {
      return (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.resolveValidatedCurrency === 'function')
        ? WattWatchCalculations.resolveValidatedCurrency(settings.currency)
        : null;
    }
    const stored = (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function')
      ? WattWatchStorage.getSettings()
      : null;
    return (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.resolveValidatedCurrency === 'function')
      ? WattWatchCalculations.resolveValidatedCurrency(stored?.currency)
      : null;
  },

  /**
   * Updates topbar pills and sidebar tariff badges
   */
  updateGlobalTariffPills(summary, settings, effectiveBill, advancedTariff) {
    const safeSummary = (summary && typeof summary === 'object') ? summary : {};
    const safeSettings = (settings && typeof settings === 'object')
      ? settings
      : (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function' ? WattWatchStorage.getSettings() : {});
    const isSlab = safeSettings.tariffModel === 'slab';
    let effectiveRate = NaN;
    let rateStr = '-- / kWh';

    const validCurr = this._getValidatedCurrency(safeSettings);
    const currSym = validCurr || '';
    if (isSlab) {
      if (advancedTariff && advancedTariff.isValid) {
        effectiveRate = advancedTariff.effectiveRatePerKwh;
        rateStr = Number.isFinite(effectiveRate)
          ? `Slab Tariff (${WattWatchCalculations.formatRateWithCurrency(effectiveRate, validCurr, '/kWh')} avg)`
          : 'Slab Tariff (Configured)';
      } else {
        rateStr = 'Invalid Slab Configuration';
      }
    } else {
      const validRate = (typeof WattWatchCalculations !== 'undefined')
        ? WattWatchCalculations.validateTariffRate(safeSettings.electricityRate, 8.00)
        : Number(safeSettings.electricityRate ?? 8.00);
      if (Number.isFinite(validRate) && validRate >= 0) {
        effectiveRate = validRate;
        rateStr = WattWatchCalculations.formatRateWithCurrency(effectiveRate, validCurr, ' / kWh');
      } else {
        rateStr = 'Invalid Flat Rate';
      }
    }

    const topbarTariff = document.getElementById('topbarTariffRate');
    if (topbarTariff) topbarTariff.textContent = rateStr;

    const topbarBill = document.getElementById('topbarMonthlyBill');
    if (topbarBill) topbarBill.textContent = WattWatchCalculations.formatOptionalCurrency(effectiveBill, validCurr);

    const sidebarRate = document.getElementById('sidebarTariffVal');
    if (sidebarRate) {
      if (Number.isFinite(effectiveRate)) {
        sidebarRate.textContent = isSlab
          ? WattWatchCalculations.formatRateWithCurrency(effectiveRate, validCurr, '/u')
          : `${currSym}${effectiveRate.toFixed(2)}`;
        sidebarRate.title = isSlab
          ? `Progressive Slab Tariff: Effective rate is ${WattWatchCalculations.formatRateWithCurrency(effectiveRate, validCurr, '/kWh')} across ${Number.isFinite(safeSummary.totalMonthlyKwh) ? safeSummary.totalMonthlyKwh.toFixed(1) : 0} kWh`
          : `Uniform Flat Rate: ${WattWatchCalculations.formatRateWithCurrency(effectiveRate, validCurr, '')} per kWh`;
      } else {
        sidebarRate.textContent = `${currSym}--`;
        sidebarRate.title = 'Invalid Tariff Configuration';
      }
    }

    const sidebarLabel = document.querySelector('.sidebar-tariff-card .tariff-info-label');
    if (sidebarLabel) {
      sidebarLabel.textContent = isSlab ? 'Effective Tariff' : 'Active Tariff';
    }

    const badge = document.getElementById('navApplianceCountBadge');
    if (badge) {
      badge.textContent = (safeSummary.totalAppliancesCount !== undefined ? safeSummary.totalAppliancesCount : 0).toString();
    }
  },

  /**
   * Populates Overview metrics and the Electricity Budget Tracker widget
   */
  renderOverviewMetrics(summary, effectiveBill, settings, advancedTariff) {
    const safeSummary = (summary && typeof summary === 'object') ? summary : {};
    const safeSettings = (settings && typeof settings === 'object')
      ? settings
      : (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function' ? WattWatchStorage.getSettings() : {});
    const elKwh = document.getElementById('metricTotalMonthlyKwh');
    const elBill = document.getElementById('metricEstimatedMonthlyBill');
    const elCount = document.getElementById('metricAppliancesCount');
    const elDaily = document.getElementById('metricAvgDailyKwh');

    const validCurr = this._getValidatedCurrency(safeSettings);
    if (elKwh) {
      this._animateMetricCounter(elKwh, safeSummary.totalMonthlyKwh, (v) => WattWatchCalculations.formatKwh(v));
    }
    if (elBill) {
      this._animateMetricCounter(elBill, effectiveBill, (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr));
    }
    if (elCount) elCount.textContent = `${safeSummary.totalAppliancesCount} (${safeSummary.totalUnits} Units)`;
    if (elDaily) {
      this._animateMetricCounter(elDaily, safeSummary.totalDailyKwh, (v) => WattWatchCalculations.formatKwh(v));
    }

    // Update metric bill subtext with Effective Rate in slab mode
    const elBillSubtext = document.getElementById('metricBillSubtext');
    if (elBillSubtext) {
      if (safeSummary.isValid === false) {
        elBillSubtext.innerHTML = `<span>Calculation unavailable: invalid appliance or tariff setting</span>`;
      } else if (safeSettings.tariffModel === 'slab') {
        const effRate = advancedTariff ? advancedTariff.effectiveRatePerKwh : (safeSummary.totalMonthlyKwh > 0 ? effectiveBill / safeSummary.totalMonthlyKwh : 0);
        elBillSubtext.innerHTML = `<span>Effective Rate: <strong style="color: var(--royal-blue);">${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatRateWithCurrency(effRate, validCurr, ' / kWh'))}</strong> (Slab)</span>`;
      } else {
        const rateCheck = WattWatchCalculations.validateTariffRate(safeSettings.electricityRate, 8.00);
        const flatRate = !isNaN(rateCheck) ? rateCheck : NaN;
        elBillSubtext.innerHTML = `<span>Flat rate at ${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatRateWithCurrency(flatRate, validCurr, ' / kWh'))}</span>`;
      }
    }

    // Spotlight Banner
    const spotlightTitle = document.getElementById('spotlightApplianceTitle');
    const spotlightDesc = document.getElementById('spotlightApplianceDesc');

    if (safeSummary.highestAppliance && safeSummary.totalMonthlyKwh > 0) {
      const top = safeSummary.highestAppliance;
      if (spotlightTitle) spotlightTitle.textContent = `${top.name} (${top.sharePercentage.toFixed(1)}% of total load)`;
      if (spotlightDesc) {
        spotlightDesc.textContent =
          `Consumes ${WattWatchCalculations.formatKwh(top.monthlyKwh)} monthly (${WattWatchCalculations.formatOptionalCurrency(top.monthlyCost, validCurr)} est. cost). Operating at ${top.powerWatts}W for ${top.dailyHours} hrs/day across ${top.quantity} unit(s). Check Energy Tips for conservation opportunities.`;
      }
    } else {
      if (spotlightTitle) spotlightTitle.textContent = 'No Active Consumption Recorded';
      if (spotlightDesc) spotlightDesc.textContent = 'Add your appliances to identify your primary energy consumers and calculate estimated monthly electricity charges.';
    }

    // Budget Tracker Widget
    this.renderBudgetTracker(effectiveBill, safeSettings.budgetInr, safeSummary.totalMonthlyKwh, safeSettings);

    // Timescale Energy Insights & Appliance Load Comparison
    this.renderOverviewInsights(safeSummary, effectiveBill, safeSettings, advancedTariff);
    this.renderOverviewApplianceComparison(safeSummary, safeSettings);
  },

  /**
   * Renders the Electricity Budget Tracker widget on Overview, including month-end bill forecasting
   * and daily energy pacing metrics based on active calendar month days.
   * @param {number} effectiveBill
   * @param {number} budgetInr
   * @param {number} [totalMonthlyKwh=0]
   * @param {Object} [settings=null]
   */
  renderBudgetTracker(effectiveBill, budgetInr, totalMonthlyKwh = 0, settings = null) {
    const budgetCard = document.getElementById('overviewBudgetWidget');
    if (!budgetCard) return;

    const safeSettings = (settings && typeof settings === 'object')
      ? settings
      : (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function' ? WattWatchStorage.getSettings() : {});

    const b = WattWatchCalculations.calculateBudgetStatus(effectiveBill, budgetInr);
    const forecast = WattWatchCalculations.calculateBillForecast(effectiveBill, budgetInr, totalMonthlyKwh, safeSettings);
    const pacing = forecast.pacing;

    const elAmount = document.getElementById('budgetCardAmount');
    const elRemaining = document.getElementById('budgetCardRemaining');
    const elPercent = document.getElementById('budgetCardPercent');
    const elProgress = document.getElementById('budgetCardProgressFill');
    const elBadge = document.getElementById('budgetCardBadge');

    // Additional Forecast & Pacing Elements
    const elProjBill = document.getElementById('budgetForecastProjectedBill');
    const elTarget = document.getElementById('budgetForecastTarget');
    const elVariance = document.getElementById('budgetForecastVariance');
    const elExplanation = document.getElementById('budgetForecastExplanation');
    const elPacingBudget = document.getElementById('pacingDailyBudget');
    const elPacingDays = document.getElementById('pacingDaysLabel');
    const elPacingDailyKwh = document.getElementById('pacingDailyKwh');
    const elPacingCost = document.getElementById('pacingConfiguredCost');
    const elPacingKwhEst = document.getElementById('pacingDailyKwhEst');
    const elPacingDelta = document.getElementById('pacingProjectedDelta');
    const elPacingDeltaSub = document.getElementById('pacingDeltaSub');
    const elPacingNote = document.getElementById('budgetPacingNote');

    const validCurr = this._getValidatedCurrency(safeSettings);
    const currSym = validCurr || '';
    const fmtMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);

    if (b.status === 'invalid') {
      if (elAmount) elAmount.textContent = `${currSym}-- (Invalid)`;
      if (elRemaining) elRemaining.textContent = 'Invalid budget setting';
      if (elPercent) elPercent.textContent = '--%';
      if (elProgress) {
        elProgress.style.width = '0%';
        elProgress.style.backgroundColor = 'var(--muted-slate)';
      }
      if (elBadge) {
        elBadge.className = 'badge badge-outline';
        elBadge.textContent = 'Invalid Budget';
      }
      if (elProjBill) elProjBill.textContent = `${currSym}--`;
      if (elTarget) elTarget.textContent = `${currSym}--`;
      if (elVariance) {
        elVariance.textContent = 'Invalid Data';
        elVariance.style.color = 'var(--text-secondary)';
      }
      if (elExplanation) {
        elExplanation.textContent = forecast.explanation;
        elExplanation.className = 'budget-explanation-box';
      }
      if (elPacingBudget) elPacingBudget.textContent = `${currSym}-- / day`;
      if (elPacingDailyKwh) elPacingDailyKwh.textContent = '-- kWh / day';
      if (elPacingCost) elPacingCost.textContent = `${currSym}-- / day`;
      if (elPacingDelta) elPacingDelta.textContent = '--';
      if (elPacingDeltaSub) elPacingDeltaSub.textContent = 'Invalid input';
      if (elPacingNote) elPacingNote.textContent = pacing.explanation;
      return;
    }

    if (!b.hasBudget) {
      if (elAmount) elAmount.textContent = `${fmtMoney(0)} (Unset)`;
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
      if (elProjBill) elProjBill.textContent = fmtMoney(b.estimatedBill);
      if (elTarget) elTarget.textContent = 'No Budget Set';
      if (elVariance) {
        elVariance.textContent = 'Unset';
        elVariance.style.color = 'var(--text-secondary)';
      }
      if (elExplanation) {
        elExplanation.textContent = forecast.explanation;
        elExplanation.className = 'budget-explanation-box';
      }
      if (elPacingBudget) elPacingBudget.textContent = `${fmtMoney(0)} / day`;
      if (elPacingDailyKwh) elPacingDailyKwh.textContent = '-- kWh / day';
      if (elPacingCost) elPacingCost.textContent = pacing.isValid && !isNaN(pacing.dailyEstimatedCost) ? `${fmtMoney(pacing.dailyEstimatedCost)} / day` : `${fmtMoney(0)} / day`;
      if (elPacingKwhEst) elPacingKwhEst.textContent = pacing.isValid && !isNaN(pacing.dailyEstimatedKwh) ? `~${pacing.dailyEstimatedKwh.toFixed(2)} kWh/day` : '~0.00 kWh/day';
      if (elPacingDays) elPacingDays.textContent = `${pacing.daysInMonth}-day cycle`;
      if (elPacingDelta) elPacingDelta.textContent = '--';
      if (elPacingDeltaSub) elPacingDeltaSub.textContent = 'No budget set';
      if (elPacingNote) elPacingNote.textContent = pacing.explanation;
      return;
    }

    if (elAmount) elAmount.textContent = fmtMoney(b.budget);
    if (elRemaining) {
      elRemaining.textContent = b.remaining >= 0
        ? `${fmtMoney(b.remaining)} remaining`
        : `${fmtMoney(Math.abs(b.remaining))} over budget`;
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

    // Populate Forecast & Pacing details
    if (elProjBill) elProjBill.textContent = fmtMoney(b.estimatedBill);
    if (elTarget) elTarget.textContent = fmtMoney(b.budget);
    // Shared variance calculation: variance = targetBudget - projectedMonthEndBill
    const variance = (forecast && typeof forecast.variance === 'number' && !isNaN(forecast.variance))
      ? forecast.variance
      : (b.hasBudget && b.status !== 'invalid' ? (b.budget - b.estimatedBill) : NaN);

    const isOverBudget = Number.isFinite(variance) && variance < -0.005;

    if (elVariance) {
      if (isOverBudget) {
        elVariance.textContent = `+${fmtMoney(Math.abs(variance))} over`;
        elVariance.style.color = '#ef4444';
      } else {
        elVariance.textContent = `${fmtMoney(Math.max(0, variance))} under`;
        elVariance.style.color = 'var(--emerald-primary)';
      }
    }

    if (elExplanation) {
      elExplanation.textContent = forecast.explanation;
      elExplanation.className = `budget-explanation-box ${b.status === 'exceeded' ? 'state-exceeded' : (b.status === 'critical' || b.status === 'warning') ? 'state-caution' : ''}`;
    }

    if (elPacingBudget) elPacingBudget.textContent = `${fmtMoney(pacing.dailyBudgetInr)} / day`;
    if (elPacingDays) elPacingDays.textContent = `${pacing.daysInMonth}-day target`;
    if (elPacingDailyKwh) elPacingDailyKwh.textContent = !isNaN(pacing.dailyAllowedKwh) ? `${pacing.dailyAllowedKwh.toFixed(2)} kWh / day` : '-- kWh / day';
    if (elPacingCost) elPacingCost.textContent = `${fmtMoney(pacing.dailyEstimatedCost)} / day`;
    if (elPacingKwhEst) elPacingKwhEst.textContent = `~${pacing.dailyEstimatedKwh.toFixed(2)} kWh/day`;

    if (elPacingDelta) {
      if (isOverBudget) {
        elPacingDelta.textContent = `+${fmtMoney(Math.abs(variance))} over`;
        elPacingDelta.style.color = '#ef4444';
        if (elPacingDeltaSub) elPacingDeltaSub.textContent = 'Projected over budget';
      } else {
        elPacingDelta.textContent = `${fmtMoney(Math.max(0, variance))} surplus`;
        elPacingDelta.style.color = 'var(--emerald-primary)';
        if (elPacingDeltaSub) elPacingDeltaSub.textContent = 'Projected under budget';
      }
    }

    if (elPacingNote) elPacingNote.textContent = pacing.explanation;

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

  currentInsightsTimeframe: 'daily',

  /**
   * Switches the active timescale perspective for Overview insights (Daily, Weekly, Monthly)
   * @param {string} timeframe - 'daily' | 'weekly' | 'monthly'
   */
  setInsightsTimeframe(timeframe) {
    if (!['daily', 'weekly', 'monthly'].includes(timeframe)) return;
    this.currentInsightsTimeframe = timeframe;

    const tabs = document.querySelectorAll('.insights-tab');
    tabs.forEach(tab => {
      const isActive = tab.getAttribute('data-timeframe') === timeframe;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    const contentEl = document.getElementById('overviewInsightsContent');
    if (contentEl) {
      const tabLabelMap = {
        daily: 'tabDailyInsights',
        weekly: 'tabWeeklyInsights',
        monthly: 'tabMonthlyInsights'
      };
      if (tabLabelMap[timeframe]) {
        contentEl.setAttribute('aria-labelledby', tabLabelMap[timeframe]);
      }
    }

    const appliances = WattWatchStorage.getAppliances();
    const settings = WattWatchStorage.getSettings();
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const tariff = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);
    const effectiveBill = (summary.isValid && tariff.isValid) ? tariff.totalCost : NaN;

    this.renderOverviewInsights(summary, effectiveBill, settings, tariff);
    this._flashElement(document.getElementById('overviewInsightsContent'), 'insights-content-fade');
  },

  /**
   * Renders the Segmented Timescale Energy Insights card on Overview
   */
  renderOverviewInsights(summary, effectiveBill, settings, advancedTariff) {
    const container = document.getElementById('overviewInsightsContent');
    if (!container) return;

    if (!summary || !summary.isValid || isNaN(effectiveBill) || summary.appliances.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
          Add active electrical appliances to your household inventory to generate time-scale consumption, budget pacing, and expenditure insights.
        </div>
      `;
      return;
    }

    const timeframe = this.currentInsightsTimeframe || 'daily';
    const rawCurrency = (settings && settings.currency) ? settings.currency : 'INR';
    const currency = WattWatchCalculations.sanitizeCurrencySymbol(rawCurrency, 'INR');
    const validCurr = this._getValidatedCurrency(settings);
    const fmtMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);
    const fmtRate = (r) => WattWatchCalculations.formatRateWithCurrency(r, validCurr, '/kWh');
    const totalDailyKwh = summary.totalDailyKwh;
    const totalMonthlyKwh = summary.totalMonthlyKwh;
    const daysInMonth = WattWatchCalculations.getDaysInCurrentMonth();
    const dailyCost = effectiveBill / daysInMonth;
    const weeklyKwh = totalDailyKwh * 7;
    const weeklyCost = dailyCost * 7;
    const topApp = summary.highestAppliance;

    let kpi1 = {}, kpi2 = {}, kpi3 = {}, tipBanner = '';

    if (timeframe === 'daily') {
      kpi1 = {
        label: 'Daily Baseline Consumption',
        val: WattWatchCalculations.formatKwh(totalDailyKwh),
        sub: 'Calculated over active run cycles'
      };
      kpi2 = {
        label: 'Estimated Daily Cost',
        val: fmtMoney(dailyCost),
        sub: `Effective rate: ~${fmtRate(summary.effectiveRatePerKwh)}`
      };
      kpi3 = {
        label: 'Peak Load Driver',
        val: topApp ? topApp.name : 'None',
        sub: topApp ? `${Number(topApp.powerWatts) || 0}W · ${Number(topApp.dailyHours) || 0}h/day (${Number(topApp.sharePercentage || 0).toFixed(1)}% load)` : 'No active load'
      };

      tipBanner = topApp && topApp.sharePercentage >= 20
        ? `<div class="insights-tip-banner tip-caution">
            <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="insights-tip-text">
              <strong>High Daily Concentration:</strong> <strong>${WattWatchAppliances.escapeHtml(topApp.name)}</strong> accounts for ${Number(topApp.sharePercentage).toFixed(1)}% of your daily electricity. Trimming operating duration by 30-45 minutes could reduce daily billing run-rate significantly.
            </div>
          </div>`
        : `<div class="insights-tip-banner">
            <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div class="insights-tip-text">
              <strong>Balanced Daily Distribution:</strong> Your household energy demand is well-distributed across active appliances with steady daily baseload of ${WattWatchCalculations.formatKwh(totalDailyKwh)}.
            </div>
          </div>`;
    } else if (timeframe === 'weekly') {
      const weeklyBudget = settings.budgetInr ? (settings.budgetInr / 4.3) : 0;
      const weeklyBudgetStatus = weeklyBudget > 0 ? (weeklyCost <= weeklyBudget ? 'Pacing Within Budget' : 'Pacing Over Budget') : 'No Budget Configured';

      kpi1 = {
        label: 'Projected 7-Day Energy',
        val: WattWatchCalculations.formatKwh(weeklyKwh),
        sub: '7 continuous operating cycles'
      };
      kpi2 = {
        label: 'Projected 7-Day Outlay',
        val: fmtMoney(weeklyCost),
        sub: `~${fmtMoney(dailyCost)} per day average`
      };
      kpi3 = {
        label: 'Weekly Budget Target',
        val: weeklyBudget > 0 ? fmtMoney(weeklyBudget) : 'Unset',
        sub: weeklyBudgetStatus
      };

      tipBanner = `<div class="insights-tip-banner">
        <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div class="insights-tip-text">
          <strong>Weekly Projection:</strong> At your current operating pace, weekly household electricity consumption projects to ${WattWatchCalculations.formatKwh(weeklyKwh)} costing approximately ${WattWatchAppliances.escapeHtml(fmtMoney(weeklyCost))}.
        </div>
      </div>`;
    } else { // monthly
      const annualCost = effectiveBill * 12;
      const annualKwh = totalMonthlyKwh * 12;

      kpi1 = {
        label: `${daysInMonth}-Day Monthly Forecast`,
        val: WattWatchCalculations.formatKwh(totalMonthlyKwh),
        sub: `${summary.totalAppliancesCount} appliances (${summary.totalUnits} units)`
      };
      kpi2 = {
        label: 'Projected Monthly Bill',
        val: fmtMoney(effectiveBill),
        sub: `Effective rate: ${fmtRate(summary.effectiveRatePerKwh)}`
      };
      kpi3 = {
        label: 'Annualized Run-Rate',
        val: fmtMoney(annualCost),
        sub: `Projected ~${WattWatchCalculations.formatKwh(annualKwh)} per year`
      };

      const recs = WattWatchRecommendations.generateRecommendations(summary.appliances, settings || summary.ratePerKwh);
      if (recs.isValid === false) {
        tipBanner = `<div class="insights-tip-banner" style="border-color: rgba(169, 38, 57, 0.35); background: rgba(169, 38, 57, 0.08);">
            <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="insights-tip-text">
              <strong>Conservation Analysis Unavailable:</strong> ${WattWatchAppliances.escapeHtml(recs.error || 'Verify tariff settings and appliance inventory values.')}
            </div>
          </div>`;
      } else {
        tipBanner = recs.tips.length > 0
          ? `<div class="insights-tip-banner">
              <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div class="insights-tip-text">
                <strong>Monthly Conservation Opportunity:</strong> Implementing top recommendations can unlock up to <strong>${WattWatchAppliances.escapeHtml(fmtMoney(recs.totalPotentialSavingsCost))}/month</strong> in savings (${WattWatchCalculations.formatKwh(recs.totalPotentialSavingsKwh)}).
              </div>
            </div>`
          : `<div class="insights-tip-banner">
              <svg class="insights-tip-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div class="insights-tip-text">
                <strong>Optimal Household Baseline:</strong> Current appliance runtimes and ratings reflect efficient operational parameters.
              </div>
            </div>`;
      }
    }

    container.innerHTML = `
      <div class="insights-grid">
        <div class="insights-kpi-card">
          <span class="insights-kpi-label">${WattWatchAppliances.escapeHtml(kpi1.label)}</span>
          <span class="insights-kpi-val">${WattWatchAppliances.escapeHtml(kpi1.val)}</span>
          <span class="insights-kpi-sub">${WattWatchAppliances.escapeHtml(kpi1.sub)}</span>
        </div>
        <div class="insights-kpi-card">
          <span class="insights-kpi-label">${WattWatchAppliances.escapeHtml(kpi2.label)}</span>
          <span class="insights-kpi-val" style="color: var(--deep-burgundy);">${WattWatchAppliances.escapeHtml(kpi2.val)}</span>
          <span class="insights-kpi-sub">${WattWatchAppliances.escapeHtml(kpi2.sub)}</span>
        </div>
        <div class="insights-kpi-card">
          <span class="insights-kpi-label">${WattWatchAppliances.escapeHtml(kpi3.label)}</span>
          <span class="insights-kpi-val" style="font-size: 1.25rem; font-weight: 600;">${WattWatchAppliances.escapeHtml(kpi3.val)}</span>
          <span class="insights-kpi-sub">${WattWatchAppliances.escapeHtml(kpi3.sub)}</span>
        </div>
      </div>
      ${tipBanner}
    `;
  },

  /**
   * Renders the Appliance Load Distribution (appliance-wise comparison) widget on Overview
   */
  renderOverviewApplianceComparison(summary, settings) {
    const container = document.getElementById('overviewApplianceComparisonContent');
    if (!container) return;

    if (!summary || !summary.isValid || summary.appliances.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
          No appliances in active inventory. Add devices to visualize comparative energy contribution.
        </div>
      `;
      return;
    }

    const rawCurrency = (settings && settings.currency) ? settings.currency : 'INR';
    const currency = WattWatchCalculations.sanitizeCurrencySymbol(rawCurrency, 'INR');
    const sorted = [...summary.appliances].sort((a, b) => (b.monthlyKwh || 0) - (a.monthlyKwh || 0));
    const topItems = sorted.slice(0, 5);

    let rowsHtml = '';
    topItems.forEach((app, idx) => {
      const share = Number(app.sharePercentage) || 0;
      const isHighLoad = share >= 20;
      const safeName = WattWatchAppliances.escapeHtml(app.name);
      const safeCat = WattWatchAppliances.escapeHtml(app.category || 'Other');
      const badgeClass = `badge-${encodeURIComponent(String(app.category || 'other').toLowerCase().replace(/[^a-z0-9]/g, ''))}`;

      rowsHtml += `
        <div class="appliance-load-row">
          <div class="appliance-load-row-header">
            <div class="appliance-load-identity">
              <span class="appliance-rank-badge">#${idx + 1}</span>
              <div>
                <span class="appliance-load-name">${safeName}</span>
                <span class="badge ${badgeClass}" style="margin-left: 0.4rem; font-size: 0.65rem;">${safeCat}</span>
                ${isHighLoad ? '<span class="badge badge-burgundy" style="margin-left: 0.25rem; font-size: 0.65rem;">High Load</span>' : ''}
                <div class="appliance-load-meta">${Number(app.powerWatts) || 0}W · ${Number(app.quantity) || 1} unit${(Number(app.quantity) || 1) > 1 ? 's' : ''} · ${Number(app.dailyHours) || 0}h/day</div>
              </div>
            </div>
            <div class="appliance-load-figures">
              <div>
                <div class="appliance-load-kwh">${WattWatchCalculations.formatKwh(app.monthlyKwh)}</div>
                <div style="font-size: 0.72rem; color: var(--text-secondary);">${share.toFixed(1)}% of total load</div>
              </div>
              <div>
                <div class="appliance-load-cost">${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatOptionalCurrency(app.monthlyCost, currency))}</div>
                <div style="font-size: 0.72rem; color: var(--text-secondary);">per month</div>
              </div>
            </div>
          </div>
          <div class="load-bar-track" aria-label="${safeName} represents ${share.toFixed(1)}% of total energy consumption">
            <div class="load-bar-fill ${isHighLoad ? 'fill-high' : ''}" style="width: ${Math.min(100, Math.max(3, share))}%;"></div>
          </div>
        </div>
      `;
    });

    const moreCount = sorted.length - topItems.length;
    const footerHtml = moreCount > 0
      ? `<div style="text-align: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); font-size: 0.8rem; color: var(--text-secondary);">
          Showing top 5 energy consumers. <strong>+${moreCount} more appliance${moreCount > 1 ? 's' : ''}</strong> tracked in your inventory.
          <a href="#appliances" onclick="WattWatchApp.navigateTo('appliances'); return false;" style="color: var(--royal-blue); font-weight: 600; margin-left: 0.5rem; text-decoration: underline;">View All in Inventory</a>
        </div>`
      : '';

    container.innerHTML = `
      <div class="appliance-comparison-list">
        ${rowsHtml}
      </div>
      ${footerHtml}
    `;
  },

  /**
   * Renders metrics, matrix table, and carbon analytics on Analytics view
   */
  renderAnalyticsData(summary, effectiveBill, settings) {
    const elDailyAvg = document.getElementById('analyticsDailyAvg');
    const elMonthlyTotal = document.getElementById('analyticsMonthlyTotal');
    const elPeakCat = document.getElementById('analyticsPeakCategory');
    const elDailyCost = document.getElementById('analyticsDailyCost');

    const daysInMonth = WattWatchCalculations.getDaysInCurrentMonth();
    const validCurr = this._getValidatedCurrency(settings);
    if (elDailyAvg) this._animateMetricCounter(elDailyAvg, summary.totalDailyKwh, (v) => WattWatchCalculations.formatKwh(v));
    if (elMonthlyTotal) this._animateMetricCounter(elMonthlyTotal, summary.totalMonthlyKwh, (v) => WattWatchCalculations.formatKwh(v));
    if (elDailyCost) this._animateMetricCounter(elDailyCost, effectiveBill / daysInMonth, (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr));

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
        <td><strong style="color: var(--deep-burgundy);">${WattWatchAppliances.escapeHtml(WattWatchCalculations.formatOptionalCurrency(app.monthlyCost, validCurr))}</strong> <span style="font-size: 0.75rem; color: var(--text-secondary);">(${(Number(app.sharePercentage) || 0).toFixed(1)}%)</span></td>
      `;
      tbody.appendChild(tr);
    });
  },

  /**
   * Renders rule-based tips and What-If Scenarios on Energy Optimization view
   */
  renderRecommendationsView(appliances, rateOrSettings) {
    const effectiveSettings = (rateOrSettings !== undefined)
      ? rateOrSettings
      : (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function' ? WattWatchStorage.getSettings() : 8.00);

    const validCurr = (typeof effectiveSettings === 'object' && effectiveSettings !== null && effectiveSettings.currency !== undefined)
      ? WattWatchCalculations.resolveValidatedCurrency(effectiveSettings.currency)
      : this._getValidatedCurrency(null);
    const fmtRecMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);

    const analysis = WattWatchRecommendations.generateRecommendations(appliances, effectiveSettings);
    const hasAppliances = Array.isArray(appliances) && appliances.length > 0;
    const whatIfData = (hasAppliances && typeof WattWatchRecommendations !== 'undefined' && typeof WattWatchRecommendations.generateWhatIfScenarios === 'function')
      ? WattWatchRecommendations.generateWhatIfScenarios(appliances, effectiveSettings)
      : null;

    const container = document.getElementById('tipsGridContainer');
    const warningsBanner = document.getElementById('tipsWarningsBanner');
    const emptyState = document.getElementById('tipsEmptyState');
    const filterBar = document.getElementById('tipsFilterBar');
    const filterCountBadge = document.getElementById('tipsFilterCountBadge');
    const filterEmptyState = document.getElementById('tipsFilterEmptyState');
    const filterEmptyDesc = document.getElementById('tipsFilterEmptyDesc');
    const whatIfCard = document.getElementById('whatIfScenariosCard');
    const whatIfList = document.getElementById('whatIfScenariosList');
    const overlapNote = document.getElementById('tipsOverlapNote');
    const liveStatus = document.getElementById('recommendationsLiveStatus');

    if (warningsBanner) {
      const issueMessages = new Set();
      if (Array.isArray(analysis.calculationIssues)) {
        analysis.calculationIssues.forEach(msg => { if (msg) issueMessages.add(msg); });
      }
      if (whatIfData && Array.isArray(whatIfData.calculationIssues)) {
        whatIfData.calculationIssues.forEach(msg => { if (msg) issueMessages.add(msg); });
      }
      if (issueMessages.size > 0) {
        const listHtml = Array.from(issueMessages).map(m => `<li>${WattWatchAppliances.escapeHtml(m)}</li>`).join('');
        warningsBanner.innerHTML = `<div style="background: rgba(197, 155, 67, 0.12); border: 1px solid rgba(197, 155, 67, 0.45); border-left: 4px solid var(--antique-gold); border-radius: var(--radius-md); padding: 0.75rem 1rem;"><strong style="display: block; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.25rem;">Calculation Warnings</strong><ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: var(--text-secondary);">${listHtml}</ul></div>`;
        warningsBanner.style.display = 'block';
      } else {
        warningsBanner.innerHTML = '';
        warningsBanner.style.display = 'none';
      }
    }

    const totalSavedCostEl = document.getElementById('tipsTotalSavingsCost');
    const totalSavedKwhEl = document.getElementById('tipsTotalSavingsKwh');

    const finalCostNum = analysis.isValid === false ? NaN : analysis.totalPotentialSavingsCost;
    const finalKwhNum = analysis.isValid === false ? NaN : analysis.totalPotentialSavingsKwh;

    if (totalSavedCostEl) {
      this._animateMetricCounter(
        totalSavedCostEl,
        finalCostNum,
        (v) => fmtRecMoney(v),
        { setAriaLabel: false }
      );
    }
    if (totalSavedKwhEl) {
      this._animateMetricCounter(
        totalSavedKwhEl,
        finalKwhNum,
        (v) => WattWatchCalculations.formatKwh(v),
        { setAriaLabel: false }
      );
    }

    if (overlapNote) {
      if (analysis.isValid !== false && analysis.hasOverlappingRecommendations && analysis.tips.length > 1) {
        overlapNote.style.display = 'block';
        overlapNote.textContent = `Combined achievable total reflects reconciled household contributions across overlapping tips and tariff tiers (standalone individual tip sum: ${fmtRecMoney(analysis.individualSumSavingsCost)} / ${WattWatchCalculations.formatKwh(analysis.individualSumSavingsKwh)}).`;
      } else {
        overlapNote.style.display = 'none';
        overlapNote.textContent = '';
      }
    }

    const renderWhatIfSection = () => {
      if (!whatIfList) return;
      if (!hasAppliances || !whatIfData) {
        whatIfList.innerHTML = '';
        if (whatIfCard) whatIfCard.style.display = 'none';
        return;
      }

      if (whatIfData.isValid === false) {
        if (whatIfCard) {
          whatIfCard.style.display = 'block';
          whatIfCard.classList.add('card-animate-in');
        }
        whatIfList.innerHTML = `<div role="alert" style="grid-column: 1 / -1; background: rgba(169, 38, 57, 0.08); border: 1px solid rgba(169, 38, 57, 0.28); border-radius: var(--radius-md); padding: 0.9rem 1rem; color: var(--deep-burgundy); font-size: 0.85rem;"><strong>What-If Scenarios Unavailable:</strong> ${WattWatchAppliances.escapeHtml(whatIfData.error || 'Unable to compute scenario projections with current settings.')}</div>`;
        return;
      }

      if (!whatIfData.scenarios || whatIfData.scenarios.length === 0) {
        whatIfList.innerHTML = '';
        if (whatIfCard) whatIfCard.style.display = 'none';
        return;
      }

      if (whatIfCard) {
        whatIfCard.style.display = 'block';
        whatIfCard.classList.add('card-animate-in');
      }
      whatIfList.innerHTML = '';
      const reducedMotion = this._prefersReducedMotion();

      const scenarioBaseCounts = {};
      whatIfData.scenarios.forEach(s => {
        const key = `${s.title || 'Scenario'}|${s.badge || 'Scenario'}`;
        scenarioBaseCounts[key] = (scenarioBaseCounts[key] || 0) + 1;
      });
      const scenarioBaseSeen = {};

      whatIfData.scenarios.forEach((sc, idx) => {
        const card = document.createElement('article');
        card.className = reducedMotion ? 'tip-card' : 'tip-card card-animate-in';
        if (!reducedMotion) {
          card.style.animationDelay = `${Math.min(idx * 40, 160)}ms`;
        }
        const safeBadgeClass = this._safeBadgeClass(sc.badgeClass, 'badge-gold');
        const safeTitleId = `whatifTitle_${idx}_${String(sc.id || '').replace(/[^a-zA-Z0-9_\-]/g, '')}`;
        card.setAttribute('aria-labelledby', safeTitleId);

        const costStr = fmtRecMoney(sc.savedCostMonthly);
        const annualStr = fmtRecMoney(sc.annualSavingsCost);
        const kwhStr = WattWatchCalculations.formatKwh(sc.savedKwhMonthly);
        const safeTitle = WattWatchAppliances.escapeHtml(sc.title || 'Scenario');
        const safeBadge = WattWatchAppliances.escapeHtml(sc.badge || 'Scenario');
        const labelKey = `${sc.title || 'Scenario'}|${sc.badge || 'Scenario'}`;
        scenarioBaseSeen[labelKey] = (scenarioBaseSeen[labelKey] || 0) + 1;
        const dupTag = scenarioBaseCounts[labelKey] > 1 ? ` #${scenarioBaseSeen[labelKey]}` : '';
        const scAriaLabel = `Preview ${safeTitle} (${safeBadge}${sc.isHeuristicEstimate ? ', benchmark estimate' : ''})${dupTag} in simulator`;
        const heuristicBadge = sc.isHeuristicEstimate
          ? `<span class="badge badge-outline" style="margin-left: 0.35rem; font-size: 0.65rem;" title="Projected using benchmark engineering assumptions">Benchmark Estimate</span>`
          : '';

        card.innerHTML = `
          <div>
            <div class="tip-card-header">
              <div>
                <span class="badge ${safeBadgeClass}">${safeBadge}</span>${heuristicBadge}
                <h3 class="tip-appliance-title" id="${safeTitleId}" style="margin-top: 0.4rem;">${safeTitle}</h3>
              </div>
              <span class="badge badge-outline">Rank #${Number(sc.rank) || 1} Consumer</span>
            </div>
            <div class="tip-reason" style="margin-top: 0.5rem;">
              ${WattWatchAppliances.escapeHtml(sc.description)}
            </div>
          </div>
          <div class="tip-savings-row" style="margin-top: 1rem;">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Projected Monthly Reduction</div>
              <div class="tip-savings-pill">${WattWatchAppliances.escapeHtml(costStr)} <span style="font-size: 0.78rem; font-family: var(--font-sans); color: var(--royal-blue); font-weight: 500;">(${WattWatchAppliances.escapeHtml(kwhStr)})</span></div>
              ${sc.savedCostMonthly <= 0 && sc.savedKwhMonthly > 0 ? '<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">Bill unchanged (free allowance / subsidy covers consumption)</div>' : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Est. Annual Savings</div>
              <div style="font-family: var(--font-serif); font-size: 1rem; font-weight: 600; color: var(--text-gold);">${WattWatchAppliances.escapeHtml(annualStr)}</div>
            </div>
          </div>
          <div style="margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid var(--border-subtle);">
            <button type="button" class="btn btn-primary btn-sm" style="width: 100%;" data-action="apply-whatif" data-id="${WattWatchAppliances.escapeHtml(sc.id)}" aria-label="${scAriaLabel}">
              Preview in Simulator <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        `;
        const btn = card.querySelector('[data-action="apply-whatif"]');
        if (btn) {
          btn.addEventListener('click', () => {
            if (typeof WattWatchSimulator !== 'undefined' && WattWatchSimulator.applyScenario) {
              WattWatchSimulator.applyScenario(sc);
            }
          });
        }
        whatIfList.appendChild(card);
      });
    };

    const announceFinalStatus = (tipsCount) => {
      if (!liveStatus) return;
      if (analysis.isValid === false) {
        liveStatus.textContent = 'Recommendations unavailable due to invalid tariff or appliance configuration.';
      } else {
        const finalCostTxt = fmtRecMoney(analysis.totalPotentialSavingsCost);
        const finalKwhTxt = WattWatchCalculations.formatKwh(analysis.totalPotentialSavingsKwh);
        liveStatus.textContent = tipsCount === 0
          ? `No recommendations available. Potential monthly savings ${finalCostTxt}, energy conservation ${finalKwhTxt}.`
          : `Showing ${tipsCount} energy optimization recommendation${tipsCount === 1 ? '' : 's'}. Combined achievable monthly savings ${finalCostTxt} and ${finalKwhTxt}.`;
      }
    };

    if (!container) {
      renderWhatIfSection();
      announceFinalStatus(analysis.tips.length);
      return;
    }

    const emptyTitle = document.getElementById('tipsEmptyTitle');
    const emptyDesc = document.getElementById('tipsEmptyDesc');
    const emptySimBtn = document.getElementById('btnEmptyWhatIfSimulator');

    if (analysis.isValid === false || analysis.tips.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (filterBar) filterBar.style.display = 'none';
      if (filterEmptyState) filterEmptyState.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.classList.add('card-animate-in');
      }
      if (emptyTitle) {
        emptyTitle.textContent = analysis.isValid === false ? 'Calculation Data Requires Attention' : 'No Recommendations Available';
      }
      if (emptyDesc) {
        if (analysis.isValid === false) {
          emptyDesc.textContent = analysis.error || 'Recommendations cannot be generated until active tariff or appliance settings are corrected.';
        } else if (!hasAppliances) {
          emptyDesc.textContent = 'Add appliances to your inventory so our appliance analysis system can analyze your load profiles and recommend specific optimizations. What-If scenario previews are disabled until at least one appliance is added.';
        } else {
          emptyDesc.textContent = 'Your configured appliances are already operating efficiently within optimal consumption thresholds, so no additional high-impact reductions are currently flagged.';
        }
      }
      if (emptySimBtn) {
        emptySimBtn.disabled = true;
        emptySimBtn.style.display = hasAppliances && analysis.isValid !== false ? 'none' : 'inline-flex';
      }
      renderWhatIfSection();
      announceFinalStatus(0);
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (filterBar) filterBar.style.display = 'flex';

    // Sync filter button UI states
    const activeFilter = this.currentTipFilter || 'all';
    document.querySelectorAll('#tipsImpactFilters [data-tip-filter]').forEach(btn => {
      const isMatch = btn.getAttribute('data-tip-filter') === activeFilter;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    const filteredTips = analysis.tips.filter(tip => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'Optimization') {
        return tip.impactLevel === 'Optimization' || tip.impactLevel === 'Thermal Efficiency';
      }
      return tip.impactLevel === activeFilter;
    });

    if (filterCountBadge) {
      filterCountBadge.textContent = activeFilter === 'all'
        ? `Showing ${filteredTips.length} recommendation${filteredTips.length === 1 ? '' : 's'}`
        : `Showing ${filteredTips.length} of ${analysis.tips.length} (${activeFilter})`;
    }

    if (filteredTips.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      if (filterEmptyState) {
        filterEmptyState.style.display = 'flex';
        filterEmptyState.classList.add('card-animate-in');
      }
      if (filterEmptyDesc) {
        filterEmptyDesc.textContent = `No recommendations match "${activeFilter}". Select "All Tips" to view all ${analysis.tips.length} available optimization strategies.`;
      }
      renderWhatIfSection();
      announceFinalStatus(0);
      return;
    }

    if (filterEmptyState) filterEmptyState.style.display = 'none';
    container.style.display = 'grid';

    const newSig = JSON.stringify({
      filter: activeFilter,
      ids: filteredTips.map(t => `${t.id}:${t.savedKwhMonthly.toFixed(2)}:${t.savedCostMonthly.toFixed(2)}`)
    });
    const shouldAnimateCards = !this._prefersReducedMotion() && this._lastTipsSignature !== newSig;
    this._lastTipsSignature = newSig;

    container.innerHTML = '';

    const tipAriaCounts = {};
    filteredTips.forEach(t => {
      const grp = String(t.actionGroup || 'optimization').replace(/_/g, ' ');
      const key = `${t.applianceName || 'Appliance'}|${t.impactLevel || 'Recommendation'}|${grp}`;
      tipAriaCounts[key] = (tipAriaCounts[key] || 0) + 1;
    });
    const tipAriaSeen = {};

    filteredTips.forEach((tip, idx) => {
      const card = document.createElement('article');
      card.className = shouldAnimateCards ? 'tip-card card-animate-in' : 'tip-card';
      if (shouldAnimateCards) {
        card.style.animationDelay = `${Math.min(idx * 40, 200)}ms`;
      }

      const safeBadgeClass = this._safeBadgeClass(tip.impactClass, 'badge-gold');
      const safeTipCategory = WattWatchAppliances.escapeHtml(tip.category || 'General');
      const safeApplianceName = WattWatchAppliances.escapeHtml(tip.applianceName || 'Appliance');
      const safeImpact = WattWatchAppliances.escapeHtml(tip.impactLevel || 'Recommendation');
      const safeTitleId = `tipTitle_${idx}_${String(tip.id || '').replace(/[^a-zA-Z0-9_\-]/g, '')}`;
      card.setAttribute('aria-labelledby', safeTitleId);

      const grpText = String(tip.actionGroup || 'optimization').replace(/_/g, ' ');
      const ariaKey = `${tip.applianceName || 'Appliance'}|${tip.impactLevel || 'Recommendation'}|${grpText}`;
      tipAriaSeen[ariaKey] = (tipAriaSeen[ariaKey] || 0) + 1;
      const dupTipSuffix = tipAriaCounts[ariaKey] > 1 ? ` #${tipAriaSeen[ariaKey]}` : '';
      const tipBtnAriaLabel = `Simulate efficiency upgrade for ${safeApplianceName} (${safeImpact} - ${WattWatchAppliances.escapeHtml(grpText)})${dupTipSuffix}`;
      const heuristicBadge = tip.isHeuristicEstimate
        ? `<span class="badge badge-outline" style="margin-left: 0.35rem; font-size: 0.65rem;" title="Estimated savings using benchmark assumptions">Benchmark Estimate</span>`
        : '';

      const costStr = fmtRecMoney(tip.savedCostMonthly);
      const annualStr = fmtRecMoney(tip.annualSavingsCost);
      const kwhStr = WattWatchCalculations.formatKwh(tip.savedKwhMonthly);

      const hasStandaloneDetails = Boolean(tip.hasReconciledAdjustment);
      const standaloneCostStr = hasStandaloneDetails ? fmtRecMoney(tip.individualSavedCostMonthly) : '';
      const standaloneKwhStr = hasStandaloneDetails ? WattWatchCalculations.formatKwh(tip.individualSavedKwhMonthly) : '';

      card.innerHTML = `
        <div>
          <div class="tip-card-header">
            <div>
              <span class="badge ${safeBadgeClass}">${safeImpact}</span>${heuristicBadge}
              <h3 class="tip-appliance-title" id="${safeTitleId}" style="margin-top: 0.4rem;">${safeApplianceName}</h3>
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
            <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">${hasStandaloneDetails ? 'Combined Household Share' : 'Potential Monthly Savings'}</div>
            <div class="tip-savings-pill">${WattWatchAppliances.escapeHtml(costStr)} <span style="font-size: 0.78rem; font-family: var(--font-sans); color: var(--royal-blue); font-weight: 500;">(${WattWatchCalculations.formatKwh(tip.savedKwhMonthly)})</span></div>
            ${tip.savedCostMonthly <= 0 && tip.savedKwhMonthly > 0 ? '<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">Bill unchanged within free allowance / subsidy</div>' : (hasStandaloneDetails ? `<div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.15rem;">Standalone if applied alone: ~${WattWatchAppliances.escapeHtml(standaloneCostStr)} (${WattWatchAppliances.escapeHtml(standaloneKwhStr)})</div>` : '')}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">Est. Annual Savings</div>
            <div style="font-family: var(--font-serif); font-size: 1rem; font-weight: 600; color: var(--text-gold);">${WattWatchAppliances.escapeHtml(annualStr)}</div>
          </div>
        </div>
        <div style="margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid var(--border-subtle);">
          <button type="button" class="btn btn-secondary btn-sm" style="width: 100%;" data-action="simulate-tip" data-appliance-id="${WattWatchAppliances.escapeHtml(tip.applianceId)}" aria-label="${tipBtnAriaLabel}">
            Simulate Efficiency Upgrade
          </button>
        </div>
      `;

      const simBtn = card.querySelector('[data-action="simulate-tip"]');
      if (simBtn) {
        simBtn.addEventListener('click', () => {
          WattWatchAppliances.simulateAppliance(tip.applianceId);
        });
      }

      container.appendChild(card);
    });

    renderWhatIfSection();
    announceFinalStatus(filteredTips.length);
  },

  /**
   * Binds settings controls (Tariff, Budget, Carbon Factor, JSON Export/Import, Sample Data, Clear)
   */
  bindSettings() {
    // Tariff Rate Input (Flat)
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput) {
      rateInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        const val = parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (raw === '' || isNaN(val) || val < 0 || !Number.isFinite(val)) {
          this.showToast('Electricity flat rate must be a valid non-negative number.', 'error', 'Invalid Tariff Rate');
          rateInput.value = Number(curSettings.electricityRate !== undefined ? curSettings.electricityRate : 8.00).toFixed(2);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ electricityRate: val, tariffModel: 'flat' });
        if (!saved) {
          this.showToast('Failed to update electricity flat rate.', 'error', 'Save Failed');
          rateInput.value = Number(curSettings.electricityRate !== undefined ? curSettings.electricityRate : 8.00).toFixed(2);
          return;
        }
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Electricity flat rate updated to ${WattWatchCalculations.formatRateWithCurrency(val, curSettings?.currency, '/kWh')} (Flat mode active)`, 'success', 'Rate Updated');
      });
    }

    // Rate Steppers
    const btnRateMinus = document.getElementById('btnRateStepMinus');
    const btnRatePlus = document.getElementById('btnRateStepPlus');
    if (btnRateMinus && rateInput) {
      btnRateMinus.addEventListener('click', () => {
        const parsed = parseFloat(rateInput.value);
        let current = !isNaN(parsed) ? parsed : 8.00;
        current = Math.max(0.5, current - 0.5);
        rateInput.value = current.toFixed(2);
        rateInput.dispatchEvent(new Event('change'));
      });
    }
    if (btnRatePlus && rateInput) {
      btnRatePlus.addEventListener('click', () => {
        const parsed = parseFloat(rateInput.value);
        let current = !isNaN(parsed) && Number.isFinite(parsed) ? parsed : 8.00;
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
        const raw = e.target.value;
        const val = parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (raw === '' || isNaN(val) || val < 0 || !Number.isFinite(val)) {
          this.showToast('Monthly electricity budget must be a valid non-negative number (0 to disable).', 'error', 'Invalid Budget');
          budgetInput.value = Number(curSettings.budgetInr || 0);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ budgetInr: val });
        if (!saved) {
          this.showToast('Failed to update monthly electricity budget.', 'error', 'Save Failed');
          budgetInput.value = Number(curSettings.budgetInr || 0);
          return;
        }
        // Reset session warning so user gets fresh alerts for new budget
        this.budgetWarnedSession = { 75: false, 90: false, 100: false };
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Monthly electricity budget set to ${WattWatchCalculations.formatOptionalCurrency(val, curSettings?.currency)}`, 'success', 'Budget Saved');
      });
    }

    // Carbon Emission Factor Input
    const carbonInput = document.getElementById('settingsCarbonFactor');
    if (carbonInput) {
      carbonInput.addEventListener('change', (e) => {
        const valStr = e.target.value.trim();
        const curSettings = WattWatchStorage.getSettings();
        if (valStr !== '' && (isNaN(Number(valStr)) || Number(valStr) < 0 || !Number.isFinite(Number(valStr)))) {
          this.showToast('Carbon emission factor must be a positive number or empty to disable.', 'error', 'Invalid Emission Factor');
          carbonInput.value = curSettings.carbonEmissionFactor !== null ? Number(curSettings.carbonEmissionFactor).toFixed(2) : '';
          return;
        }
        const factor = valStr === '' ? null : Number(valStr);
        const saved = WattWatchStorage.saveSettings({ carbonEmissionFactor: factor });
        if (!saved) {
          this.showToast('Failed to update carbon emission factor.', 'error', 'Save Failed');
          carbonInput.value = curSettings.carbonEmissionFactor !== null ? Number(curSettings.carbonEmissionFactor).toFixed(2) : '';
          return;
        }
        this.refreshAll();
        this.showToast(factor !== null ? `Grid carbon factor set to ${factor} kg CO₂e/kWh` : 'Carbon factor disabled', 'info', 'Carbon Setting');
      });
    }

    // Free Units Allowance Input
    const freeUnitsInput = document.getElementById('settingsFreeUnits');
    if (freeUnitsInput) {
      freeUnitsInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        const val = (typeof WattWatchCalculations !== 'undefined')
          ? WattWatchCalculations.validateFreeUnits(raw, NaN)
          : parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (isNaN(val) || val < 0 || !Number.isFinite(val)) {
          this.showToast('Free electricity allowance must be a valid non-negative number.', 'error', 'Invalid Allowance');
          freeUnitsInput.value = Number(curSettings.freeUnits || 0);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ freeUnits: val });
        if (!saved) {
          this.showToast('Failed to update free electricity allowance.', 'error', 'Save Failed');
          freeUnitsInput.value = Number(curSettings.freeUnits || 0);
          return;
        }
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Lifeline allowance updated to ${val} kWh/month`, 'success', 'Tariff Saved');
      });
    }

    // Government Subsidy / Bill Credit Input
    const billCreditInput = document.getElementById('settingsBillCredit');
    if (billCreditInput) {
      billCreditInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        const val = (typeof WattWatchCalculations !== 'undefined')
          ? WattWatchCalculations.validateBillCredit(raw, NaN)
          : parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (isNaN(val) || val < 0 || !Number.isFinite(val)) {
          this.showToast('Government subsidy or bill credit must be a valid non-negative number.', 'error', 'Invalid Subsidy');
          billCreditInput.value = Number(curSettings.billCreditInr || 0);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ billCreditInr: val });
        if (!saved) {
          this.showToast('Failed to update government subsidy / bill credit.', 'error', 'Save Failed');
          billCreditInput.value = Number(curSettings.billCreditInr || 0);
          return;
        }
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Government subsidy / bill credit set to ${WattWatchCalculations.formatOptionalCurrency(val, curSettings?.currency)}`, 'success', 'Tariff Saved');
      });
    }

    // Fixed Meter Charges Input in Settings
    const fixedChargesInput = document.getElementById('settingsFixedCharges');
    if (fixedChargesInput) {
      fixedChargesInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        const val = (typeof WattWatchCalculations !== 'undefined')
          ? WattWatchCalculations.validateFixedCharge(raw, NaN)
          : parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (isNaN(val) || val < 0 || !Number.isFinite(val)) {
          this.showToast('Fixed meter charges must be a valid non-negative number.', 'error', 'Invalid Fixed Charges');
          fixedChargesInput.value = Number(curSettings.fixedCharges || 0).toFixed(2);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ fixedCharges: val });
        if (!saved) {
          this.showToast('Failed to update fixed meter charges.', 'error', 'Save Failed');
          fixedChargesInput.value = Number(curSettings.fixedCharges || 0).toFixed(2);
          return;
        }
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Fixed meter charges set to ${WattWatchCalculations.formatRateWithCurrency(val, curSettings?.currency, '/month')}`, 'success', 'Tariff Saved');
      });
    }

    // Electricity Duty / Tax Input in Settings
    const taxPercentInput = document.getElementById('settingsTaxPercent');
    if (taxPercentInput) {
      taxPercentInput.addEventListener('change', (e) => {
        const raw = e.target.value;
        const val = (typeof WattWatchCalculations !== 'undefined')
          ? WattWatchCalculations.validateTaxPercent(raw, NaN)
          : parseFloat(raw);
        const curSettings = WattWatchStorage.getSettings();
        if (isNaN(val) || val < 0 || val > 100 || !Number.isFinite(val)) {
          this.showToast('Electricity duty/tax must be between 0% and 100%.', 'error', 'Invalid Tax Rate');
          taxPercentInput.value = Number(curSettings.additionalTaxPercent || 0).toFixed(1);
          return;
        }
        const saved = WattWatchStorage.saveSettings({ additionalTaxPercent: val });
        if (!saved) {
          this.showToast('Failed to update electricity duty / tax.', 'error', 'Save Failed');
          taxPercentInput.value = Number(curSettings.additionalTaxPercent || 0).toFixed(1);
          return;
        }
        this.refreshAll();
        this._flashElement(document.getElementById('settingsActiveTariffBanner'));
        this.showToast(`Electricity duty set to ${val.toFixed(1)}%`, 'success', 'Tariff Saved');
      });
    }

    // Switch to Flat Rate button in Settings
    const btnSwitchFlat = document.getElementById('btnSettingsSwitchToFlat');
    if (btnSwitchFlat) {
      btnSwitchFlat.addEventListener('click', () => {
        const saved = WattWatchStorage.saveSettings({ tariffModel: 'flat' });
        if (saved) {
          this.refreshAll();
          this._flashElement(document.getElementById('settingsActiveTariffBanner'));
          this.showToast('Switched to uniform flat rate billing model.', 'info', 'Billing Model Updated');
        }
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

    // Sample Household Presets Selector & Loader
    const presetSelect = document.getElementById('settingsPresetSelect');
    const presetDesc = document.getElementById('settingsPresetDesc');
    const presetsMeta = (typeof WattWatchStorage.getSamplePresets === 'function') ? WattWatchStorage.getSamplePresets() : [];
    const updatePresetDesc = () => {
      if (!presetSelect || !presetDesc) return;
      const chosen = presetsMeta.find(p => p.id === presetSelect.value);
      if (chosen) {
        presetDesc.textContent = `${chosen.description} (${chosen.applianceCount} appliances, ${chosen.totalUnits} units, ~${Math.round(chosen.estimatedMonthlyKwh)} kWh/month estimate).`;
      }
    };
    if (presetSelect) {
      presetSelect.addEventListener('change', updatePresetDesc);
      updatePresetDesc();
    }

    const btnLoadSample = document.getElementById('btnLoadSampleData');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        const selectedKey = presetSelect ? presetSelect.value : 'family_2bhk';
        const chosen = presetsMeta.find(p => p.id === selectedKey) || presetsMeta.find(p => p.id === 'family_2bhk') || { name: 'Sample Household', applianceCount: 8 };
        this.openConfirmDialog({
          title: `Load ${chosen.name}?`,
          message: `Warning: Loading this preset will replace your current appliance inventory with demonstration data for ${chosen.name} (${chosen.applianceCount} appliances). Your tariff settings, monthly budget, and billing history will remain preserved. Custom appliances in your active inventory will be replaced. Do you wish to proceed?`,
          confirmText: `Load ${chosen.name}`,
          confirmClass: 'btn-primary',
          onConfirm: () => {
            const loaded = WattWatchStorage.loadSampleHousehold(selectedKey);
            this.refreshAll();
            this.showToast(`${chosen.name} loaded with ${loaded.length} appliances`, 'success', 'Sample Data Ready');
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
          guideCard.scrollIntoView({ behavior: this._prefersReducedMotion() ? 'auto' : 'smooth' });
        }
        this.showToast('Getting Started Guide opened', 'info', 'Quick Start Guide');
      });
    }

    // Migrate Guest Data into Account Button
    const btnMigrateGuest = document.getElementById('btnSettingsMigrateGuest');
    if (btnMigrateGuest) {
      btnMigrateGuest.addEventListener('click', () => {
        const uid = WattWatchStorage.getActiveUser();
        const isGuestSession = (typeof WattWatchAuth !== 'undefined' && WattWatchAuth.chosenSessionType === 'guest');
        if (!uid || isGuestSession) {
          this.showToast('Please sign in to an account to transfer guest data.', 'warning', 'Sign In Required');
          return;
        }
        const res = WattWatchStorage.migrateGuestData(uid);
        if (res.success) {
          if (res.transferredAppliances === 0 && res.transferredHistory === 0 && (res.skippedAppliances > 0 || res.skippedHistory > 0)) {
            this.showToast(`All guest records already exist in your account (${res.skippedAppliances} appliance(s), ${res.skippedHistory} record(s) skipped as duplicates).`, 'info', 'Already Up to Date');
          } else {
            this.showToast(`Successfully transferred ${res.transferredAppliances} appliance(s) and ${res.transferredHistory} record(s) to your account.`, 'success', 'Migration Complete');
          }
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

        if (file.size > 5 * 1024 * 1024) {
          this.showToast('Backup file exceeds the 5 MB limit. Please select a valid WattWatch backup.', 'error', 'Import Error');
          fileInput.value = '';
          return;
        }

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
              if (res.warning) {
                this.showToast(`Imported ${res.count} appliance(s)${histMsg}${skippedMsg}. Warning: ${res.warning}`, 'warning', 'Import Notice');
              } else {
                this.showToast(`Successfully imported ${res.count} appliance(s)${histMsg}${skippedMsg}${mergeMsg}`, 'success', 'Import Successful');
              }
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
          message: 'Are you sure you want to completely erase all appliances, historical snapshots, and restore default settings for your active workspace? This action cannot be undone.',
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

    // CSV Appliances Import Trigger & Input
    const csvFileInput = document.getElementById('csvApplianceFileInput');
    const btnImportCsv = document.getElementById('btnImportAppliancesCSV');
    const btnImportCsvTb = document.getElementById('btnImportAppliancesCSVToolbar');

    const triggerCsvPick = () => {
      if (csvFileInput) csvFileInput.click();
    };
    if (btnImportCsv) btnImportCsv.addEventListener('click', triggerCsvPick);
    if (btnImportCsvTb) btnImportCsvTb.addEventListener('click', triggerCsvPick);

    if (csvFileInput) {
      csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          this.showToast('CSV file exceeds the 5 MB limit. Please select a smaller file.', 'error', 'Import Error');
          csvFileInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const rawText = event.target.result;
          const parsed = WattWatchStorage.parseAppliancesCSV(rawText);
          this.openCsvPreviewModal(parsed);
          csvFileInput.value = '';
        };
        reader.onerror = () => {
          this.showToast('Unable to read the selected CSV file.', 'error', 'Import Error');
          csvFileInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    // CSV Modal buttons
    const btnCloseCsv = document.getElementById('btnCloseCsvModal');
    const btnCancelCsv = document.getElementById('btnCancelCsvImport');
    const btnConfirmCsv = document.getElementById('btnConfirmCsvImport');
    if (btnCloseCsv) btnCloseCsv.addEventListener('click', () => this.closeCsvPreviewModal());
    if (btnCancelCsv) btnCancelCsv.addEventListener('click', () => this.closeCsvPreviewModal());
    if (btnConfirmCsv) btnConfirmCsv.addEventListener('click', () => this.confirmCsvImport());
  },

  openCsvPreviewModal(parsedResult) {
    this._pendingCsv = parsedResult;
    const modal = document.getElementById('csvPreviewModal');
    if (!modal) return;

    const banner = document.getElementById('csvSummaryBanner');
    const errBox = document.getElementById('csvErrorsBox');
    const tableBody = document.getElementById('csvPreviewTableBody');
    const btnConfirm = document.getElementById('btnConfirmCsvImport');

    if (banner) {
      const hasErrors = parsedResult.errors && parsedResult.errors.length > 0;
      banner.innerHTML = `
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.2rem;">
          CSV Analysis: Found ${parsedResult.validRecords.length} valid appliance record(s) out of ${parsedResult.totalRows} data rows.
        </div>
        <div style="font-size: 0.78rem; color: var(--text-secondary);">
          ${hasErrors ? `${parsedResult.errors.length} issue(s) detected during parsing. Resolve validation issues before importing; your current inventory remains unchanged.` : 'All rows passed schema validation.'}
        </div>
      `;
    }

    if (errBox) {
      if (parsedResult.errors.length > 0) {
        errBox.style.display = 'block';
        errBox.innerHTML = `<strong>Validation Issues (${parsedResult.errors.length}):</strong><ul style="margin: 0.35rem 0 0 1.25rem; padding: 0;">` +
          parsedResult.errors.map(err => `<li>${WattWatchAppliances.escapeHtml(err)}</li>`).join('') +
          `</ul>`;
      } else {
        errBox.style.display = 'none';
        errBox.innerHTML = '';
      }
    }

    const canConfirmImport = Boolean(
      parsedResult.success &&
      (!parsedResult.errors || parsedResult.errors.length === 0) &&
      parsedResult.validRecords &&
      parsedResult.validRecords.length > 0
    );

    if (tableBody) {
      tableBody.innerHTML = '';
      if (parsedResult.validRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1rem;">No valid records to preview.</td></tr>';
        if (btnConfirm) btnConfirm.disabled = true;
      } else {
        if (btnConfirm) btnConfirm.disabled = !canConfirmImport;
        parsedResult.validRecords.slice(0, 25).forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${WattWatchAppliances.escapeHtml(r.name)}</strong></td>
            <td><span class="badge badge-outline">${WattWatchAppliances.escapeHtml(r.category || 'Other')}</span></td>
            <td>${r.powerWatts} W</td>
            <td>${r.dailyHours} h/d</td>
            <td>${r.operatingDays} d/m</td>
            <td>${r.quantity}</td>
          `;
          tableBody.appendChild(tr);
        });
        if (parsedResult.validRecords.length > 25) {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--text-secondary); font-size: 0.78rem;">... and ${parsedResult.validRecords.length - 25} more records</td>`;
          tableBody.appendChild(tr);
        }
      }
    } else if (btnConfirm) {
      btnConfirm.disabled = !canConfirmImport;
    }

    if (this.modalManager) {
      this.modalManager.open(modal, document.activeElement);
    } else {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  closeCsvPreviewModal() {
    const modal = document.getElementById('csvPreviewModal');
    if (!modal) return;
    if (this.modalManager) {
      this.modalManager.close(modal);
    } else {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    this._pendingCsv = null;
  },

  confirmCsvImport() {
    if (!this._pendingCsv || !this._pendingCsv.success || (Array.isArray(this._pendingCsv.errors) && this._pendingCsv.errors.length > 0)) {
      const firstErr = this._pendingCsv?.errors?.[0] || 'CSV validation failed.';
      this.showToast(`CSV import rejected: ${firstErr}`, 'error', 'Import Rejected');
      this.closeCsvPreviewModal();
      return;
    }

    if (!this._pendingCsv.validRecords || this._pendingCsv.validRecords.length === 0) {
      this.showToast('No valid appliance records to import.', 'warning', 'Import Skipped');
      this.closeCsvPreviewModal();
      return;
    }

    const mode = document.querySelector('input[name="csvImportAction"]:checked')?.value || 'merge';
    const rawRecords = this._pendingCsv.validRecords;
    const validRecords = [];
    for (let i = 0; i < rawRecords.length; i++) {
      const check = WattWatchStorage.validateAppliance(rawRecords[i]);
      if (!check.valid) {
        this.showToast(`CSV import rejected: ${check.error}`, 'error', 'Import Rejected');
        this.closeCsvPreviewModal();
        return;
      }
      validRecords.push(check.sanitized);
    }

    if (mode === 'replace') {
      const saved = WattWatchStorage.saveAppliances(validRecords);
      if (!saved) {
        this.showToast('Failed to save imported appliances to browser storage.', 'error', 'Import Failed');
        return;
      }
      this.showToast(`Replaced active inventory with ${validRecords.length} appliances from CSV.`, 'success', 'Import Successful');
    } else {
      const existing = WattWatchStorage.getAppliances();
      let added = 0;
      let updated = 0;

      validRecords.forEach(newItem => {
        const normName = newItem.name.toLowerCase().trim();
        const matchIdx = existing.findIndex(e => e.name.toLowerCase().trim() === normName && Number(e.powerWatts) === Number(newItem.powerWatts));
        if (matchIdx !== -1) {
          existing[matchIdx] = { ...existing[matchIdx], ...newItem, id: existing[matchIdx].id };
          updated++;
        } else {
          const itemCopy = { ...newItem };
          if (existing.some(e => e.id === itemCopy.id)) {
            itemCopy.id = `app_csv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          }
          existing.push(itemCopy);
          added++;
        }
      });

      if (existing.length > 500) {
        this.showToast(`CSV merge would exceed the 500 appliance limit (${existing.length} total).`, 'error', 'Import Rejected');
        this.closeCsvPreviewModal();
        return;
      }

      const saved = WattWatchStorage.saveAppliances(existing);
      if (!saved) {
        this.showToast('Failed to save imported appliances to browser storage.', 'error', 'Import Failed');
        return;
      }
      this.showToast(`Imported ${validRecords.length} appliances (${added} added, ${updated} merged).`, 'success', 'Import Successful');
    }

    this.closeCsvPreviewModal();
    this.refreshAll();
  },

  populateSettingsFields(settings) {
    const rateInput = document.getElementById('settingsElectricityRate');
    if (rateInput && document.activeElement !== rateInput) {
      const flatRate = (typeof WattWatchCalculations !== 'undefined' && WattWatchCalculations.isFiniteNumber(settings.electricityRate) && Number(settings.electricityRate) >= 0)
        ? Number(settings.electricityRate)
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

    const freeUnitsInput = document.getElementById('settingsFreeUnits');
    if (freeUnitsInput && document.activeElement !== freeUnitsInput) {
      freeUnitsInput.value = Number(settings.freeUnits || 0);
    }

    const billCreditInput = document.getElementById('settingsBillCredit');
    if (billCreditInput && document.activeElement !== billCreditInput) {
      billCreditInput.value = Number(settings.billCreditInr || 0);
    }

    const fixedChargesInput = document.getElementById('settingsFixedCharges');
    if (fixedChargesInput && document.activeElement !== fixedChargesInput) {
      fixedChargesInput.value = Number(settings.fixedCharges || 0).toFixed(2);
    }

    const taxPercentInput = document.getElementById('settingsTaxPercent');
    if (taxPercentInput && document.activeElement !== taxPercentInput) {
      taxPercentInput.value = Number(settings.additionalTaxPercent || 0).toFixed(1);
    }

    // Active Tariff Mode Banner updates
    const modelBadge = document.getElementById('settingsTariffModeBadge');
    const modelName = document.getElementById('settingsActiveModelName');
    const effRateVal = document.getElementById('settingsEffectiveRateVal');
    const actionPrompt = document.getElementById('settingsTariffActionPrompt');

    const appliances = WattWatchStorage.getAppliances();
    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const isSlab = settings.tariffModel === 'slab';

    // Toggle Flat Rate controls vs Progressive Slab display in Settings
    const flatGroup = document.getElementById('settingsFlatRateGroup');
    const slabContainer = document.getElementById('settingsActiveSlabsContainer');
    const slabTbody = document.getElementById('settingsActiveSlabsTableBody');

    const validCurr = this._getValidatedCurrency(settings);
    const fmtRate = (r, sfx = ' / kWh') => WattWatchCalculations.formatRateWithCurrency(r, validCurr, sfx);
    const fmtMoney = (v) => WattWatchCalculations.formatOptionalCurrency(v, validCurr);

    if (isSlab) {
      if (flatGroup) flatGroup.style.display = 'none';
      if (slabContainer) slabContainer.style.display = 'block';
      if (slabTbody) {
        slabTbody.innerHTML = '';
        const slabs = Array.isArray(settings.slabConfig) ? settings.slabConfig : [];
        let prevLimit = 0;
        slabs.forEach((s, idx) => {
          const tr = document.createElement('tr');
          const rangeLabel = s.upTo !== null ? `${prevLimit} – ${s.upTo} kWh` : `Above ${prevLimit} kWh`;
          prevLimit = s.upTo || prevLimit;
          tr.innerHTML = `
            <td style="font-weight: 600;">Tier ${idx + 1}</td>
            <td>${rangeLabel}</td>
            <td style="font-weight: 600; color: var(--deep-burgundy);">${WattWatchAppliances.escapeHtml(fmtRate(Number(s.rate)))}</td>
          `;
          slabTbody.appendChild(tr);
        });
      }
    } else {
      if (flatGroup) flatGroup.style.display = 'block';
      if (slabContainer) slabContainer.style.display = 'none';
    }

    if (modelBadge) {
      modelBadge.className = isSlab ? 'badge badge-gold' : 'badge badge-blue';
      modelBadge.textContent = isSlab ? 'Slab Mode Active' : 'Flat Mode Active';
    }
    if (modelName) {
      modelName.textContent = isSlab ? 'Progressive Multi-Slab Tariff' : 'Uniform Flat Rate';
    }
    const isFinitePos = (v, defVal) => (
      typeof WattWatchCalculations !== 'undefined' && WattWatchCalculations.isFiniteNumber(v) && Number(v) >= 0
        ? Math.max(0, Number(v))
        : defVal
    );
    const flatRate = isFinitePos(settings.electricityRate, 8.00);
    const fixedCharges = isFinitePos(settings.fixedCharges, 0.00);
    const taxPercent = isFinitePos(settings.additionalTaxPercent, 0.0);

    if (effRateVal) {
      effRateVal.textContent = isSlab
        ? `${fmtRate(summary.effectiveRatePerKwh)} (Effective)`
        : fmtRate(flatRate);
    }
    if (actionPrompt) {
      const hasExtraFlatCharges = fixedCharges > 0 || taxPercent > 0;
      actionPrompt.innerHTML = isSlab
        ? `Progressive tiers, fixed meter charge (${WattWatchAppliances.escapeHtml(fmtMoney(fixedCharges))}), and duty (${taxPercent.toFixed(1)}%) are active. <a href="#simulator" onclick="WattWatchApp.navigateTo('simulator'); return false;" style="color: var(--royal-blue); font-weight: 600; text-decoration: underline;">Configure Slabs in Simulator &rarr;</a>`
        : hasExtraFlatCharges
          ? `Flat rate (${WattWatchAppliances.escapeHtml(fmtRate(flatRate, '/kWh'))}), fixed meter charge (${WattWatchAppliances.escapeHtml(fmtMoney(fixedCharges))}), and duty (${taxPercent.toFixed(1)}%) are active. <a href="#simulator" onclick="WattWatchApp.navigateTo('simulator'); return false;" style="color: var(--royal-blue); font-weight: 600; text-decoration: underline;">Open Tariff Calculator &rarr;</a>`
          : `Current billing uses a uniform flat rate. To configure progressive tiered slabs and fixed charges, <a href="#simulator" onclick="WattWatchApp.navigateTo('simulator'); return false;" style="color: var(--royal-blue); font-weight: 600; text-decoration: underline;">Open Tariff Calculator &rarr;</a>`;
    }
  },

  /**
   * Keyboard shortcuts & modal listeners (Esc closes modal, Tab traps focus)
   */
  bindModalKeyboards() {
    window.addEventListener('keydown', (e) => {
      // ARIA Tablist keyboard navigation (ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End)
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const activeEl = (e.target && e.target.getAttribute && e.target.getAttribute('role') === 'tab') ? e.target : document.activeElement;
        if (activeEl && activeEl.getAttribute('role') === 'tab') {
          const tablist = activeEl.closest('[role="tablist"]');
          if (tablist) {
            const tabs = Array.from(tablist.querySelectorAll('[role="tab"]:not([disabled])')).filter(t => {
              const style = window.getComputedStyle(t);
              return style.display !== 'none' && style.visibility !== 'hidden';
            });
            if (tabs.length > 1) {
              const curIdx = tabs.indexOf(activeEl);
              if (curIdx !== -1) {
                let targetIdx = -1;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  targetIdx = (curIdx + 1) % tabs.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  targetIdx = (curIdx - 1 + tabs.length) % tabs.length;
                } else if (e.key === 'Home') {
                  targetIdx = 0;
                } else if (e.key === 'End') {
                  targetIdx = tabs.length - 1;
                }
                if (targetIdx !== -1) {
                  e.preventDefault();
                  tabs[targetIdx].focus();
                  tabs[targetIdx].click();
                  return;
                }
              }
            }
          }
        }
      }

      if (e.key === 'Escape') {
        const sidebar = document.getElementById('appSidebar');
        if (sidebar && sidebar.classList.contains('is-open')) {
          this.closeMobileDrawer();
          return;
        }
        const privacyModal = document.getElementById('privacyModal');
        if (privacyModal && privacyModal.classList.contains('is-open')) {
          this.closePrivacyModal();
          return;
        }
        WattWatchAppliances.closeModal();
        WattWatchHistory.closeDetailsModal();
        WattWatchReport.closeReportModal();
        this.closeConfirmDialog();
        this.closeCsvPreviewModal();
        if (typeof WattWatchAuth !== 'undefined' && WattWatchAuth.hasUserChosenSession) {
          WattWatchAuth.closeModal();
        }
        return;
      }

      if (e.key === 'Tab') {
        let activeModal = this.modalManager ? this.modalManager.getTopModal() : null;
        if (!activeModal) {
          const modalIds = ['privacyModal', 'confirmModal', 'applianceModal', 'historyDetailModal', 'reportModal', 'authModal', 'csvPreviewModal'];
          for (const id of modalIds) {
            const m = document.getElementById(id);
            if (m && m.classList.contains('is-open')) {
              activeModal = m;
              break;
            }
          }
        }
        if (activeModal) {
          const focusables = activeModal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          const visibleFocusables = Array.from(focusables).filter(el => {
            return el.offsetParent !== null && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
          });

          if (visibleFocusables.length > 0) {
            const first = visibleFocusables[0];
            const last = visibleFocusables[visibleFocusables.length - 1];

            if (e.shiftKey) {
              if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      }
    });

    // Close on backdrop clicks for standard modals using dedicated close handlers
    const modalCloseMap = {
      applianceModal: () => WattWatchAppliances.closeModal(),
      confirmModal: () => this.closeConfirmDialog(),
      historyDetailModal: () => WattWatchHistory.closeDetailsModal(),
      reportModal: () => WattWatchReport.closeReportModal(),
      privacyModal: () => this.closePrivacyModal()
    };

    Object.keys(modalCloseMap).forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modalCloseMap[id]();
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
   * Centralized Modal Accessibility & Focus Manager
   * Coordinates background inertness, modal stacks, and focus restoration
   */
  modalManager: {
    stack: [],

    open(modal, previousActive) {
      if (!modal || !(modal instanceof Element)) return;
      const appLayout = document.querySelector('.app-layout');

      // Make any underlying open modal inert
      if (this.stack.length > 0) {
        const underlying = this.stack[this.stack.length - 1];
        if (underlying && underlying.element && 'inert' in underlying.element) {
          underlying.element.inert = true;
        }
      }

      // Record modal in stack (preserving previousActive if reopening an already-open modal)
      const existingIdx = this.stack.findIndex(e => e.element === modal);
      const savedPreviousActive = existingIdx !== -1 ? this.stack[existingIdx].previousActive : null;
      if (existingIdx !== -1) {
        this.stack.splice(existingIdx, 1);
      }
      this.stack.push({
        element: modal,
        previousActive: previousActive || savedPreviousActive || document.activeElement
      });

      // Isolate background application container cleanly
      if (appLayout) {
        if ('inert' in appLayout) appLayout.inert = true;
        appLayout.setAttribute('aria-hidden', 'true');
      }

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      if ('inert' in modal) {
        modal.inert = false;
      }
    },

    close(modal) {
      if (!modal || !(modal instanceof Element)) return;
      const appLayout = document.querySelector('.app-layout');

      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if ('inert' in modal) {
        modal.inert = false;
      }

      const idx = this.stack.findIndex(e => e.element === modal);
      let entry = null;
      const wasTop = idx !== -1 && idx === this.stack.length - 1;
      if (idx !== -1) {
        entry = this.stack.splice(idx, 1)[0];
      }

      if (this.stack.length > 0) {
        // Restore interaction to the new top modal
        const top = this.stack[this.stack.length - 1];
        if (top && top.element && 'inert' in top.element) {
          top.element.inert = false;
        }
        if (appLayout) {
          if ('inert' in appLayout) appLayout.inert = true;
          appLayout.setAttribute('aria-hidden', 'true');
        }
      } else {
        // All modals are closed: restore background layout if no other modals are open
        if (!this.hasOpenModals()) {
          if (appLayout) {
            if ('inert' in appLayout) appLayout.inert = false;
            appLayout.removeAttribute('aria-hidden');
          }
        }
      }

      // Restore focus to entry.previousActive only if closing the top modal (so focus stays in the top modal if closing an underlying one)
      if (wasTop && entry && entry.previousActive && typeof entry.previousActive.focus === 'function') {
        try {
          entry.previousActive.focus();
        } catch (e) {
          // ignore focus error
        }
      }
    },

    getTopModal() {
      if (this.stack.length === 0) return null;
      return this.stack[this.stack.length - 1].element;
    },

    hasOpenModals() {
      return this.stack.length > 0 || document.querySelectorAll('.modal-backdrop.is-open').length > 0;
    }
  },

  /**
   * Sets or restores the HTML5 inert property and aria-hidden on background application containers
   * @param {boolean} isInert
   */
  setInertBackground(isInert) {
    const appLayout = document.querySelector('.app-layout');
    if (isInert) {
      if (appLayout) {
        if ('inert' in appLayout) appLayout.inert = true;
        appLayout.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (!this.modalManager.hasOpenModals()) {
        if (appLayout) {
          if ('inert' in appLayout) appLayout.inert = false;
          appLayout.removeAttribute('aria-hidden');
        }
      }
    }
  },

  /**
   * Reusable Custom Confirmation Dialog
   */
  openConfirmDialog({ title, message, confirmText, cancelText, confirmClass, onConfirm }) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    this.previousActiveElement = document.activeElement;

    const titleEl = document.getElementById('confirmModalTitle');
    if (titleEl) titleEl.textContent = title || 'Confirmation Required';
    const msgEl = document.getElementById('confirmModalMessage');
    if (msgEl) msgEl.textContent = message || 'Are you sure you want to proceed?';

    const btnCancel = document.getElementById('confirmModalCancelBtn');
    if (btnCancel) {
      btnCancel.textContent = cancelText || 'Cancel';
    }

    const btnConfirm = document.getElementById('confirmModalOkBtn');
    if (btnConfirm) {
      btnConfirm.textContent = confirmText || 'Confirm';
      btnConfirm.className = `btn ${confirmClass || 'btn-primary'}`;
    }

    this.confirmCallback = onConfirm;

    this.modalManager.open(modal, this.previousActiveElement);
    if (btnConfirm) btnConfirm.focus();
  },

  confirmAction() {
    if (typeof this.confirmCallback === 'function') {
      this.confirmCallback();
    }
    this.closeConfirmDialog();
  },

  closeConfirmDialog() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      this.modalManager.close(modal);
    }
    this.confirmCallback = null;
  },

  /**
   * Opens the dedicated Privacy & Data Architecture Notice modal
   * @param {HTMLElement} [triggerElement]
   */
  openPrivacyModal(triggerElement) {
    if (typeof WattWatchAuth !== 'undefined') {
      if (WattWatchAuth._startupFocusTimeout) {
        clearTimeout(WattWatchAuth._startupFocusTimeout);
        WattWatchAuth._startupFocusTimeout = null;
      }
      if (WattWatchAuth._tabFocusTimeout) {
        clearTimeout(WattWatchAuth._tabFocusTimeout);
        WattWatchAuth._tabFocusTimeout = null;
      }
    }
    const modal = document.getElementById('privacyModal');
    if (!modal) return;
    const trigger = triggerElement || document.activeElement;
    if (this.modalManager && typeof this.modalManager.open === 'function') {
      this.modalManager.open(modal, trigger);
    } else {
      // Safe fallback when modalManager is unavailable
      this._privacyFallbackTrigger = trigger;
      const authModal = document.getElementById('authModal');
      if (authModal && authModal.classList.contains('is-open') && 'inert' in authModal) {
        authModal.inert = true;
      }
      this.setInertBackground(true);
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      if ('inert' in modal) modal.inert = false;
    }
    if (this._privacyFocusTimeout) {
      clearTimeout(this._privacyFocusTimeout);
      this._privacyFocusTimeout = null;
    }
    const closeBtn = document.getElementById('privacyModalCloseX') || modal.querySelector('button');
    if (closeBtn) {
      this._privacyFocusTimeout = setTimeout(() => {
        this._privacyFocusTimeout = null;
        if (modal.classList.contains('is-open') && modal.getAttribute('aria-hidden') === 'false') {
          try { closeBtn.focus(); } catch (e) {}
        }
      }, 50);
    }
  },

  /**
   * Closes the dedicated Privacy & Data Architecture Notice modal
   */
  closePrivacyModal() {
    if (this._privacyFocusTimeout) {
      clearTimeout(this._privacyFocusTimeout);
      this._privacyFocusTimeout = null;
    }
    const modal = document.getElementById('privacyModal');
    if (!modal) return;
    if (this.modalManager && typeof this.modalManager.close === 'function') {
      this.modalManager.close(modal);
    } else {
      // Safe fallback restoration
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if ('inert' in modal) modal.inert = false;
      const authModal = document.getElementById('authModal');
      if (authModal && authModal.classList.contains('is-open')) {
        if ('inert' in authModal) authModal.inert = false;
      } else {
        this.setInertBackground(false);
      }
      if (this._privacyFallbackTrigger && typeof this._privacyFallbackTrigger.focus === 'function') {
        try { this._privacyFallbackTrigger.focus(); } catch (e) {}
      }
      this._privacyFallbackTrigger = null;
    }
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
    const isGuestSession = (typeof WattWatchAuth !== 'undefined' && WattWatchAuth.chosenSessionType === 'guest');
    const isAuth = Boolean(activeUser) && !isGuestSession;

    const guestData = WattWatchStorage.hasGuestData();

    if (isAuth && guestData.hasData) {
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
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
    const activeCurr = this._getValidatedCurrency(null);
    const prevCurr = (typeof WattWatchHistory !== 'undefined' && typeof WattWatchHistory._getSnapshotCurrency === 'function')
      ? WattWatchHistory._getSnapshotCurrency(prevRecord)
      : WattWatchCalculations.resolveValidatedCurrency(prevRecord?.tariffSettings?.currency ?? prevRecord?.currency);
    const canCompareCurr = Boolean(activeCurr && prevCurr && activeCurr === prevCurr);
    const fmtCurMoney = (val) => WattWatchCalculations.formatOptionalCurrency(val, activeCurr);
    const fmtPrevMoney = (val) => WattWatchCalculations.formatOptionalCurrency(val, prevCurr);

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
      <div class="metrics-grid overview-compare-grid" style="margin-bottom: 1.25rem;">
        <div class="metric-card">
          <span class="metric-title">Current Month (Projected)</span>
          <div class="metric-value">${currentKwh.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 500;">kWh</span></div>
          <div class="metric-subtext">${WattWatchAppliances.escapeHtml(currentMonthLabel)} · ${WattWatchAppliances.escapeHtml(fmtCurMoney(currentCost))}</div>
        </div>

        <div class="metric-card">
          <span class="metric-title">Previous Month (${WattWatchAppliances.escapeHtml(prevMonthLabel)})</span>
          <div class="metric-value">${prevKwh.toFixed(1)} <span style="font-size: 0.9rem; font-weight: 500;">kWh</span></div>
          <div class="metric-subtext">Recorded Snapshot · ${WattWatchAppliances.escapeHtml(fmtPrevMoney(prevCost))}${!prevCurr ? ' (Currency unrecorded)' : ''}</div>
        </div>

        <div class="metric-card">
          <div class="metric-card-header">
            <span class="metric-title">Energy Variance vs ${WattWatchAppliances.escapeHtml(prevMonth.label)}</span>
            <span class="badge ${kwhBadgeClass}">${kwhIcon} ${Math.abs(kwhPercentDiff).toFixed(1)}%</span>
          </div>
          <div class="metric-value" style="color: ${isKwhInc ? 'var(--deep-burgundy)' : (isKwhDec ? 'var(--royal-blue)' : 'var(--text-primary)')}; font-size: 1.15rem;">
            ${kwhTrendText}
          </div>
          <div class="metric-subtext">
            ${canCompareCurr
              ? `Estimated Cost Delta: <strong>${costDiff >= 0 ? '+' : '-'}${WattWatchAppliances.escapeHtml(fmtCurMoney(Math.abs(costDiff)))}</strong> (${costPercentDiff >= 0 ? '+' : ''}${costPercentDiff.toFixed(1)}%)`
              : 'Estimated Cost Delta: <strong>Non-Comparable</strong> (currency missing or mismatched)'}
          </div>
        </div>
      </div>

      <!-- Visual Bar Comparison -->
      <div style="background: var(--bg-surface-elevated, rgba(15, 23, 42, 0.02)); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 1rem;">
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
            <span style="font-weight: 600; color: var(--text-primary);">Current (${WattWatchAppliances.escapeHtml(currentMonthLabel)})</span>
            <span style="color: var(--royal-blue); font-weight: 700;">${currentKwh.toFixed(1)} kWh</span>
          </div>
          <div style="height: 10px; background: rgba(0,0,0,0.06); border-radius: 5px; overflow: hidden;">
            <div style="width: ${curBarWidth}%; height: 100%; background: var(--royal-blue); border-radius: 5px; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
            <span style="font-weight: 600; color: var(--text-primary);">${WattWatchAppliances.escapeHtml(prevMonthLabel)}</span>
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
   * Safe Toast Notification (uses textContent for user/dynamic message strings to guarantee zero HTML injection)
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'info' | 'warning'
   * @param {string} title
   */
  showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const validTypes = ['success', 'error', 'info', 'warning'];
    const safeType = validTypes.includes(type) ? type : 'info';

    const toast = document.createElement('div');
    toast.className = `toast toast-${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

    let iconSvg = '';
    if (safeType === 'success') {
      iconSvg = `<svg class="toast-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (safeType === 'error') {
      iconSvg = `<svg class="toast-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (safeType === 'warning') {
      iconSvg = `<svg class="toast-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = iconSvg;

    const contentWrap = document.createElement('div');
    contentWrap.className = 'toast-content';
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = String(title);
      contentWrap.appendChild(titleEl);
    }
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = message !== undefined && message !== null ? String(message) : '';
    contentWrap.appendChild(msgEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.textContent = '×';

    toast.appendChild(contentWrap);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    let autoTimer = null;
    const dismiss = () => {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (!toast.isConnected) return;
      if (this._prefersReducedMotion()) {
        toast.remove();
        return;
      }
      toast.classList.add('toast-hiding');
      setTimeout(() => { if (toast.isConnected) toast.remove(); }, 250);
    };

    closeBtn.addEventListener('click', dismiss);
    autoTimer = setTimeout(dismiss, 4200);
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchApp = WattWatchApp;
}

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  WattWatchApp.init();
});
