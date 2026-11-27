/**
 * WATTWATCH - Charts Engine (Chart.js Integration)
 * Renders luxury-themed interactive visualizations using official brand colors.
 * Includes Overview trends, Category shares, Multi-horizon Analytics,
 * Historical Bill Trends, Month-to-Month Comparisons, and Carbon Emissions.
 */

const WattWatchCharts = {
  // Chart instances registry
  instances: {
    overviewTrend: null,
    overviewCategory: null,
    analyticsTimeline: null,
    analyticsApplianceRank: null,
    analyticsCategoryShare: null,
    historyTrend: null,
    comparisonChart: null,
    carbonChart: null
  },

  // Color palettes tailored for Light and Dark modes
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      isDark,
      royalBlue: isDark ? '#3b82f6' : '#1e3a8a',
      deepBurgundy: isDark ? '#f43f5e' : '#be123c',
      antiqueGold: isDark ? '#fbbf24' : '#d97706',
      antiqueGoldLight: isDark ? '#fde68a' : '#f59e0b',
      softSlate: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)',
      textColor: isDark ? '#f8fafc' : '#0f172a',
      cardBg: isDark ? '#111827' : '#ffffff',
      categoryPalette: [
        isDark ? '#38bdf8' : '#0284c7', // Cooling (Sky)
        isDark ? '#fbbf24' : '#d97706', // Lighting (Amber)
        isDark ? '#f43f5e' : '#be123c', // Kitchen (Rose)
        isDark ? '#a78bfa' : '#7c3aed', // Entertainment (Violet)
        isDark ? '#34d399' : '#059669', // Computing (Emerald)
        isDark ? '#94a3b8' : '#64748b'  // Other (Slate)
      ]
    };
  },

  /**
   * Safely destroys an existing chart instance and clears any instance attached to canvas
   * @param {string} key
   * @param {HTMLCanvasElement} [canvas=null]
   */
  destroyChart(key, canvas = null) {
    if (this.instances[key]) {
      try {
        this.instances[key].destroy();
      } catch (e) {
        console.warn(`[WattWatch Charts] Error destroying chart ${key}:`, e);
      }
      this.instances[key] = null;
    }
    if (canvas && typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
      try {
        const existing = Chart.getChart(canvas);
        if (existing) {
          existing.destroy();
        }
      } catch (e) {
        console.warn(`[WattWatch Charts] Error destroying canvas instance for ${key}:`, e);
      }
    }
  },

  /**
   * Resolves validated effective or flat tariff rate without converting explicit 0 into 8.00.
   * @private
   */
  _resolveValidRate(summary) {
    if (!summary || typeof summary !== 'object') return NaN;
    if (WattWatchCalculations.isFiniteNumber(summary.effectiveRatePerKwh) && Number(summary.effectiveRatePerKwh) >= 0) {
      return Number(summary.effectiveRatePerKwh);
    }
    if (WattWatchCalculations.isFiniteNumber(summary.ratePerKwh) && Number(summary.ratePerKwh) >= 0) {
      return Number(summary.ratePerKwh);
    }
    return NaN;
  },

  /**
   * Resolves validated active account currency without assuming ₹ when missing/invalid.
   * @private
   */
  _getActiveCurrency() {
    const settings = (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function')
      ? WattWatchStorage.getSettings()
      : null;
    return (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.resolveValidatedCurrency === 'function')
      ? WattWatchCalculations.resolveValidatedCurrency(settings?.currency)
      : null;
  },

  /**
   * Resolves validated currency for a snapshot object (nested tariffSettings.currency then top-level currency).
   * @private
   */
  _resolveSnapshotCurrency(rec) {
    if (!rec || typeof rec !== 'object') return null;
    if (typeof WattWatchHistory !== 'undefined' && typeof WattWatchHistory._getSnapshotCurrency === 'function') {
      return WattWatchHistory._getSnapshotCurrency(rec);
    }
    const ts = (rec.tariffSettings && typeof rec.tariffSettings === 'object' && !Array.isArray(rec.tariffSettings))
      ? rec.tariffSettings
      : null;
    if (ts) {
      const nested = WattWatchCalculations.resolveValidatedCurrency(ts.currency);
      if (nested) return nested;
    }
    return WattWatchCalculations.resolveValidatedCurrency(rec.currency);
  },

  /**
   * Formats chart monetary values cleanly with validated currency or unlabelled fallback.
   * @private
   */
  _formatChartMoney(val, currency) {
    if (typeof WattWatchCalculations !== 'undefined' && typeof WattWatchCalculations.formatOptionalCurrency === 'function') {
      return WattWatchCalculations.formatOptionalCurrency(val, currency);
    }
    return WattWatchCalculations.formatNumber(val, 2);
  },

  /**
   * Checks whether reduced motion is requested via media query or test flag.
   * @returns {boolean}
   */
  _prefersReducedMotion() {
    if (typeof WattWatchApp !== 'undefined' && WattWatchApp.reduceMotionOverride === true) {
      return true;
    }
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Updates an existing Chart.js instance in place when compatible, avoiding
   * unnecessary destroy/recreate cycles while ensuring smooth transitions and
   * clean replacement when canvas or chart type changes.
   * @param {string} key
   * @param {HTMLCanvasElement} canvas
   * @param {Object} config
   * @returns {Chart|null}
   */
  _updateOrCreateChart(key, canvas, config) {
    if (!canvas || typeof Chart === 'undefined') return null;
    const reducedMotion = this._prefersReducedMotion();
    const animConfig = reducedMotion ? false : { duration: 420, easing: 'easeOutQuart' };
    const existing = this.instances[key];

    if (
      existing &&
      existing.canvas === canvas &&
      existing.config &&
      existing.config.type === config.type &&
      typeof existing.update === 'function'
    ) {
      try {
        existing.data.labels = config.data.labels;
        if (Array.isArray(existing.data.datasets) && Array.isArray(config.data.datasets) && existing.data.datasets.length === config.data.datasets.length) {
          config.data.datasets.forEach((ds, idx) => {
            const targetDs = existing.data.datasets[idx];
            Object.keys(targetDs).forEach(k => {
              if (!k.startsWith('$') && k !== 'hidden' && !Object.prototype.hasOwnProperty.call(ds, k)) {
                delete targetDs[k];
              }
            });
            Object.assign(targetDs, ds);
          });
        } else {
          existing.data.datasets = config.data.datasets;
        }
        if (config.options) {
          if (config.options.plugins) existing.options.plugins = config.options.plugins;
          if (config.options.scales) existing.options.scales = config.options.scales;
          if (config.options.cutout !== undefined) existing.options.cutout = config.options.cutout;
          if (config.options.indexAxis !== undefined) existing.options.indexAxis = config.options.indexAxis;
          existing.options.animation = animConfig;
        }
        existing.update(reducedMotion ? 'none' : undefined);
        return existing;
      } catch (e) {
        console.warn(`[WattWatch Charts] Falling back to clean recreate for ${key}:`, e);
      }
    }

    this.destroyChart(key, canvas);
    const ctx = canvas.getContext('2d');
    const finalConfig = {
      ...config,
      options: {
        ...(config.options || {}),
        animation: animConfig
      }
    };
    this.instances[key] = new Chart(ctx, finalConfig);
    return this.instances[key];
  },

  /**
   * Destroys all active chart instances
   */
  destroyAll() {
    Object.keys(this.instances).forEach(key => this.destroyChart(key));
  },

  /**
   * Initializes or updates Overview Dashboard charts
   * @param {Object} summary - Household summary from WattWatchCalculations
   */
  renderOverviewCharts(summary) {
    if (typeof Chart === 'undefined') {
      console.warn('[WattWatch Charts] Chart.js library is not available.');
      return;
    }

    this.renderOverviewTrendChart(summary);
    this.renderOverviewCategoryChart(summary);
  },

  /**
   * Overview Trend: Projected daily consumption profile across operating days
   */
  renderOverviewTrendChart(summary) {
    const canvas = document.getElementById('overviewTrendChart');
    if (!canvas) return;

    if (!summary || !Array.isArray(summary.appliances) || summary.appliances.length === 0 || !Number.isFinite(summary.totalDailyKwh) || summary.totalDailyKwh <= 0) {
      this.destroyChart('overviewTrend', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'Add appliances to visualize consumption trends');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const baselineDailyKwh = summary.totalDailyKwh;

    const weeklyData = [
      Number((baselineDailyKwh * 0.98).toFixed(2)),
      Number((baselineDailyKwh * 0.96).toFixed(2)),
      Number((baselineDailyKwh * 0.97).toFixed(2)),
      Number((baselineDailyKwh * 1.00).toFixed(2)),
      Number((baselineDailyKwh * 1.05).toFixed(2)),
      Number((baselineDailyKwh * 1.15).toFixed(2)),
      Number((baselineDailyKwh * 1.12).toFixed(2))
    ];

    const validEffRate = this._resolveValidRate(summary);
    const effRate = Number.isFinite(validEffRate) ? validEffRate : 0;
    const weeklyCosts = weeklyData.map(kwh => Number((kwh * effRate).toFixed(2)));
    const activeCurr = this._getActiveCurrency();

    this._updateOrCreateChart('overviewTrend', canvas, {
      type: 'bar',
      data: {
        labels: daysOfWeek,
        datasets: [
          {
            label: 'Projected Daily Consumption (kWh)',
            data: weeklyData,
            backgroundColor: colors.royalBlue,
            hoverBackgroundColor: colors.deepBurgundy,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 38
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => {
                const kwh = context.raw;
                const cost = weeklyCosts[context.dataIndex];
                return [
                  `Energy: ${kwh} kWh`,
                  `Est. Cost: ${this._formatChartMoney(cost, activeCurr)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val} kWh`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Overview Category: Share of monthly consumption by category
   */
  renderOverviewCategoryChart(summary) {
    const canvas = document.getElementById('overviewCategoryChart');
    if (!canvas) return;

    if (!summary || !summary.categoryBreakdown || !Array.isArray(summary.appliances) || summary.appliances.length === 0 || !Number.isFinite(summary.totalMonthlyKwh) || summary.totalMonthlyKwh <= 0) {
      this.destroyChart('overviewCategory', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No category data available');
      return;
    }

    const activeCategories = Object.values(summary.categoryBreakdown)
      .filter(c => c.kwh > 0)
      .sort((a, b) => b.kwh - a.kwh);

    if (activeCategories.length === 0) {
      this.destroyChart('overviewCategory', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No category data available');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const labels = activeCategories.map(c => c.category);
    const dataKwh = activeCategories.map(c => Number(c.kwh.toFixed(2)));
    const bgColors = activeCategories.map((_, idx) => colors.categoryPalette[idx % colors.categoryPalette.length]);
    const validEffRate = this._resolveValidRate(summary);
    const effRate = Number.isFinite(validEffRate) ? validEffRate : 0;
    const activeCurr = this._getActiveCurrency();

    this._updateOrCreateChart('overviewCategory', canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataKwh,
            backgroundColor: bgColors,
            borderColor: colors.cardBg,
            borderWidth: 3,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.textColor,
              font: { family: 'Inter', size: 12, weight: '500' },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const cat = activeCategories[context.dataIndex];
                const cost = cat.kwh * effRate;
                return [
                  `Energy: ${cat.kwh.toFixed(2)} kWh (${cat.percentage.toFixed(1)}%)`,
                  `Est. Bill: ${this._formatChartMoney(cost, activeCurr)}`
                ];
              }
            }
          }
        }
      }
    });
  },

  /**
   * Initializes or updates dedicated Analytics page charts
   * @param {Object} summary
   * @param {string} timeframe - 'daily' | 'weekly' | 'monthly'
   */
  renderAnalyticsCharts(summary, timeframe = 'monthly') {
    if (typeof Chart === 'undefined') return;

    this.renderAnalyticsTimelineChart(summary, timeframe);
    this.renderAnalyticsApplianceRankChart(summary);
    this.renderAnalyticsCategoryShareChart(summary);

    const settings = WattWatchStorage.getSettings();
    this.renderCarbonChart(summary, settings.carbonEmissionFactor);
  },

  /**
   * Analytics Timeline Chart (Daily / Weekly / Monthly View)
   */
  renderAnalyticsTimelineChart(summary, timeframe = 'monthly') {
    const canvas = document.getElementById('analyticsTimelineChart');
    if (!canvas) return;

    if (
      !summary || summary.isValid === false ||
      !Array.isArray(summary.appliances) || summary.appliances.length === 0 ||
      !Number.isFinite(summary.totalDailyKwh) || summary.totalDailyKwh <= 0 ||
      !Number.isFinite(summary.totalMonthlyKwh) || summary.totalMonthlyKwh <= 0
    ) {
      this.destroyChart('analyticsTimeline', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'Add active appliances to generate analytics projection');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const validEffRate = this._resolveValidRate(summary);
    const effRate = Number.isFinite(validEffRate) ? validEffRate : 0;
    const activeCurr = this._getActiveCurrency();

    let labels = [];
    let kwhData = [];
    let costData = [];

    if (timeframe === 'daily') {
      labels = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];
      const baseHourly = summary.totalDailyKwh / 8;
      const profileWeights = [0.65, 0.50, 0.90, 1.35, 1.10, 1.25, 1.60, 1.40];
      kwhData = profileWeights.map(w => Number((baseHourly * w).toFixed(2)));
      costData = kwhData.map(kwh => Number((kwh * effRate).toFixed(2)));
    } else if (timeframe === 'weekly') {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const weeklyBase = summary.totalMonthlyKwh / 4;
      kwhData = [
        Number((weeklyBase * 0.96).toFixed(2)),
        Number((weeklyBase * 1.02).toFixed(2)),
        Number((weeklyBase * 0.98).toFixed(2)),
        Number((weeklyBase * 1.04).toFixed(2))
      ];
      costData = kwhData.map(kwh => Number((kwh * effRate).toFixed(2)));
    } else {
      labels = ['Current Month', 'Month +1', 'Month +2', 'Month +3', 'Month +4', 'Month +5'];
      const mBase = summary.totalMonthlyKwh;
      kwhData = [
        Number(mBase.toFixed(2)),
        Number((mBase * 1.03).toFixed(2)),
        Number((mBase * 1.08).toFixed(2)),
        Number((mBase * 1.05).toFixed(2)),
        Number((mBase * 0.98).toFixed(2)),
        Number((mBase * 0.95).toFixed(2))
      ];
      costData = kwhData.map(kwh => Number((kwh * effRate).toFixed(2)));
    }

    this._updateOrCreateChart('analyticsTimeline', canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Energy Consumption (kWh)',
            data: kwhData,
            borderColor: colors.royalBlue,
            backgroundColor: colors.isDark ? 'rgba(61, 104, 178, 0.25)' : 'rgba(23, 43, 85, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: colors.antiqueGold,
            pointBorderColor: colors.cardBg,
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => [
                `Energy: ${context.raw} kWh`,
                `Est. Cost: ${this._formatChartMoney(costData[context.dataIndex], activeCurr)}`
              ]
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val} kWh`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Analytics Horizontal Bar: Appliance-wise monthly consumption ranking
   */
  renderAnalyticsApplianceRankChart(summary) {
    const canvas = document.getElementById('analyticsApplianceRankChart');
    if (!canvas) return;

    if (
      !summary || summary.isValid === false ||
      !Array.isArray(summary.appliances) || summary.appliances.length === 0 ||
      !Number.isFinite(summary.totalMonthlyKwh) || summary.totalMonthlyKwh <= 0
    ) {
      this.destroyChart('analyticsApplianceRank', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No appliance consumption records found');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const sortedAppliances = [...summary.appliances]
      .filter(a => a && Number.isFinite(Number(a.monthlyKwh)) && Number(a.monthlyKwh) > 0)
      .sort((a, b) => Number(b.monthlyKwh) - Number(a.monthlyKwh))
      .slice(0, 8);

    if (sortedAppliances.length === 0) {
      this.destroyChart('analyticsApplianceRank', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No appliance consumption records found');
      return;
    }

    const labels = sortedAppliances.map(a => {
      const n = String(a.name || 'Appliance');
      return n.length > 22 ? n.substr(0, 20) + '…' : n;
    });
    const dataKwh = sortedAppliances.map(a => Number(Number(a.monthlyKwh).toFixed(2)));

    this._updateOrCreateChart('analyticsApplianceRank', canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Monthly Consumption (kWh)',
            data: dataKwh,
            backgroundColor: sortedAppliances.map((_, idx) => idx === 0 ? colors.deepBurgundy : colors.antiqueGold),
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const app = sortedAppliances[context.dataIndex];
                return [
                  `Monthly: ${app.monthlyKwh.toFixed(2)} kWh`,
                  `Est. Bill: ${this._formatChartMoney(app.monthlyCost, this._getActiveCurrency())}`,
                  `Share: ${app.sharePercentage.toFixed(1)}%`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 10 },
              callback: (val) => `${val} kWh`
            },
            beginAtZero: true
          },
          y: {
            grid: { display: false },
            ticks: {
              color: colors.textColor,
              font: { family: 'Inter', size: 11, weight: '500' }
            }
          }
        }
      }
    });
  },

  /**
   * Analytics Category Share Donut / Cost Breakdown
   */
  renderAnalyticsCategoryShareChart(summary) {
    const canvas = document.getElementById('analyticsCategoryShareChart');
    if (!canvas) return;

    if (!summary || !summary.categoryBreakdown || !Array.isArray(summary.appliances) || summary.appliances.length === 0 || !Number.isFinite(summary.totalMonthlyCost) || summary.totalMonthlyCost <= 0) {
      this.destroyChart('analyticsCategoryShare', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No cost data available');
      return;
    }

    const activeCategories = Object.values(summary.categoryBreakdown)
      .filter(c => c.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    if (activeCategories.length === 0) {
      this.destroyChart('analyticsCategoryShare', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No cost data available');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const labels = activeCategories.map(c => c.category);
    const dataCost = activeCategories.map(c => Number(c.cost.toFixed(2)));
    const bgColors = activeCategories.map((_, idx) => colors.categoryPalette[idx % colors.categoryPalette.length]);

    this._updateOrCreateChart('analyticsCategoryShare', canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataCost,
            backgroundColor: bgColors,
            borderColor: colors.cardBg,
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: colors.textColor,
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const cat = activeCategories[context.dataIndex];
                return [
                  `Est. Cost: ${this._formatChartMoney(cat.cost, this._getActiveCurrency())}`,
                  `Energy: ${cat.kwh.toFixed(2)} kWh (${cat.percentage.toFixed(1)}%)`
                ];
              }
            }
          }
        }
      }
    });
  },

  /**
   * Carbon Emissions Breakdown Chart
   */
  renderCarbonChart(summary, emissionFactor) {
    const canvas = document.getElementById('analyticsCarbonChart');
    if (!canvas) return;

    if (
      !summary || summary.isValid === false || !summary.categoryBreakdown ||
      !Array.isArray(summary.appliances) || summary.appliances.length === 0 ||
      !Number.isFinite(summary.totalMonthlyKwh) || summary.totalMonthlyKwh <= 0 ||
      !emissionFactor || !Number.isFinite(Number(emissionFactor)) || Number(emissionFactor) <= 0
    ) {
      this.destroyChart('carbonChart', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'Configure active appliances and emission factor to view carbon breakdown');
      return;
    }

    const activeCategories = Object.values(summary.categoryBreakdown)
      .filter(c => c && Number.isFinite(Number(c.kwh)) && Number(c.kwh) > 0)
      .sort((a, b) => Number(b.kwh) - Number(a.kwh));

    if (activeCategories.length === 0) {
      this.destroyChart('carbonChart', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No active consumption available for carbon breakdown');
      return;
    }

    this.clearEmptyState(canvas);
    const colors = this.getThemeColors();

    const labels = activeCategories.map(c => c.category);
    const dataKg = activeCategories.map(c => Number((c.kwh * emissionFactor).toFixed(2)));
    const bgColors = activeCategories.map((_, idx) => colors.categoryPalette[idx % colors.categoryPalette.length]);

    this._updateOrCreateChart('carbonChart', canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Estimated Carbon Emissions (kg CO₂e)',
            data: dataKg,
            backgroundColor: bgColors,
            borderRadius: 6,
            maxBarThickness: 42
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => [
                `Emissions: ${context.raw} kg CO₂e`,
                `Energy: ${activeCategories[context.dataIndex].kwh.toFixed(1)} kWh`
              ]
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val} kg`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Historical Bill & Consumption Trend Chart
   */
  renderHistoryTrendChart(history) {
    const canvas = document.getElementById('historyTrendChart');
    if (!canvas) return;

    const validHistory = Array.isArray(history)
      ? history.filter(h =>
          h && typeof h === 'object' &&
          typeof h.period === 'string' && h.period.trim() !== '' &&
          WattWatchCalculations.isFiniteNumber(h.totalKwh) && Number(h.totalKwh) >= 0 &&
          WattWatchCalculations.isFiniteNumber(h.totalCost) && Number(h.totalCost) >= 0
        )
      : [];

    if (validHistory.length === 0) {
      this.destroyChart('historyTrend', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'No saved billing snapshots available');
      return;
    }

    this.clearEmptyState(canvas);

    const colors = this.getThemeColors();
    const sorted = [...validHistory].sort((a, b) => a.period.localeCompare(b.period));
    const labels = sorted.map(h => String(h.periodLabel || h.period));
    const dataKwh = sorted.map(h => Number(Number(h.totalKwh).toFixed(2)));
    const dataCost = sorted.map(h => Number(Number(h.totalCost).toFixed(2)));
    const pointCurrencies = sorted.map(h => this._resolveSnapshotCurrency(h));

    this._updateOrCreateChart('historyTrend', canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Monthly Energy (kWh)',
            data: dataKwh,
            borderColor: colors.royalBlue,
            backgroundColor: colors.isDark ? 'rgba(61, 104, 178, 0.2)' : 'rgba(23, 43, 85, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2.5,
            pointBackgroundColor: colors.antiqueGold,
            pointBorderColor: colors.cardBg,
            pointBorderWidth: 2,
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const ptCurr = pointCurrencies[context.dataIndex];
                const billStr = this._formatChartMoney(dataCost[context.dataIndex], ptCurr);
                return [
                  `Consumption: ${context.raw} kWh`,
                  `Estimated Bill: ${billStr}${ptCurr ? '' : ' (Currency unrecorded)'}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 },
              callback: (val) => `${val} kWh`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Month-to-Month Comparative Grouped Bar Chart
   */
  renderComparisonChart(comp, currencyMeta = null) {
    const canvas = document.getElementById('historyComparisonChart');
    if (!canvas) return;

    if (
      !comp || comp.isValid === false ||
      !WattWatchCalculations.isFiniteNumber(comp.kwhA) || !WattWatchCalculations.isFiniteNumber(comp.kwhB) ||
      !WattWatchCalculations.isFiniteNumber(comp.costA) || !WattWatchCalculations.isFiniteNumber(comp.costB)
    ) {
      this.destroyChart('comparisonChart', canvas);
      this.renderEmptyStateOnCanvas(canvas, 'Select two billing periods above to compare consumption and costs');
      return;
    }

    this.clearEmptyState(canvas);

    const meta = (currencyMeta && typeof currencyMeta === 'object') ? currencyMeta : null;
    const canCompareMoney = meta ? Boolean(meta.canCompareMoney) : (comp.canCompareMoney !== false);
    const compCurr = canCompareMoney
      ? WattWatchCalculations.resolveValidatedCurrency(meta ? meta.currency : comp.currency)
      : null;

    const kwhA = Number(comp.kwhA);
    const kwhB = Number(comp.kwhB);
    const costA = Number(comp.costA);
    const costB = Number(comp.costB);

    const chartLabels = canCompareMoney
      ? ['Energy Consumption (kWh)', `Estimated Bill (${compCurr ? compCurr + ' ' : ''}/ 10)`]
      : ['Energy Consumption (kWh)'];
    const dataA = canCompareMoney ? [kwhA, costA / 10] : [kwhA];
    const dataB = canCompareMoney ? [kwhB, costB / 10] : [kwhB];

    const colors = this.getThemeColors();
    this._updateOrCreateChart('comparisonChart', canvas, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: comp.periodLabelA,
            data: dataA,
            backgroundColor: colors.royalBlue,
            borderRadius: 4
          },
          {
            label: comp.periodLabelB,
            data: dataB,
            backgroundColor: colors.antiqueGold,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: colors.textColor,
              font: { family: 'Inter', size: 11 }
            }
          },
          tooltip: {
            backgroundColor: colors.isDark ? '#0D1628' : '#FAF7F0',
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.antiqueGold,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label;
                const isEnergy = context.dataIndex === 0;
                const raw = context.raw;
                return isEnergy
                  ? `${label}: ${raw.toFixed(2)} kWh`
                  : `${label}: ${this._formatChartMoney(raw * 10, compCurr)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.softSlate,
              font: { family: 'Inter', size: 11 }
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Renders a clean luxury empty state text inside canvas container
   * @param {HTMLCanvasElement} canvas
   * @param {string} message
   */
  renderEmptyStateOnCanvas(canvas, message) {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    if (window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Clear canvas pixels so no ghost traces remain
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (_) {}

    canvas.style.opacity = '0';
    canvas.setAttribute('aria-hidden', 'true');

    let overlay = parent.querySelector('.canvas-empty-state-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'canvas-empty-state-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.padding = '1.5rem';
      overlay.style.textAlign = 'center';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2';
      parent.appendChild(overlay);
    }

    const colors = this.getThemeColors();
    overlay.innerHTML = `
      <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${colors.antiqueGold}" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.85;">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      <div style="font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 600; color: ${colors.textColor}; margin-bottom: 0.25rem;">
        No Usage Data
      </div>
      <div class="canvas-empty-msg" style="font-size: 0.825rem; color: ${colors.softSlate}; max-width: 280px;"></div>
    `;
    const msgEl = overlay.querySelector('.canvas-empty-msg');
    if (msgEl) msgEl.textContent = message || 'No data available';
    overlay.style.display = 'flex';
    overlay.classList.add('is-visible');
  },

  /**
   * Removes empty state overlay on canvas and restores visibility
   */
  clearEmptyState(canvas) {
    if (!canvas) return;
    canvas.style.opacity = '1';
    canvas.removeAttribute('aria-hidden');
    const parent = canvas?.parentElement;
    const overlay = parent?.querySelector('.canvas-empty-state-overlay');
    if (overlay) {
      overlay.classList.remove('is-visible');
      overlay.style.display = 'none';
    }
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchCharts = WattWatchCharts;
}
