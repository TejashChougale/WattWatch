/**
 * WATTWATCH - Charts Engine (Chart.js Integration)
 * Renders luxury-themed interactive visualizations using official brand colors.
 */

const WattWatchCharts = {
  // Chart instances registry
  instances: {
    overviewTrend: null,
    overviewCategory: null,
    analyticsTimeline: null,
    analyticsApplianceRank: null,
    analyticsCategoryShare: null
  },

  // Color palettes tailored for Light and Dark modes
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      isDark,
      royalBlue: isDark ? '#3D68B2' : '#172B55',
      deepBurgundy: isDark ? '#BA476C' : '#6E293F',
      antiqueGold: isDark ? '#D4AF37' : '#B99A62',
      antiqueGoldLight: isDark ? '#F1D988' : '#CBB07E',
      softSlate: isDark ? '#9AA8BF' : '#687386',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 43, 85, 0.08)',
      textColor: isDark ? '#F0E5D0' : '#172B55',
      cardBg: isDark ? '#14213B' : '#FAF7F0',
      categoryPalette: [
        isDark ? '#3D68B2' : '#172B55', // Cooling
        isDark ? '#D4AF37' : '#B99A62', // Lighting
        isDark ? '#BA476C' : '#6E293F', // Kitchen
        isDark ? '#8A5BB5' : '#5F2E8A', // Entertainment
        isDark ? '#2E946E' : '#1E6649', // Computing
        isDark ? '#7E8B9B' : '#687386'  // Other
      ]
    };
  },

  /**
   * Safely destroys an existing chart instance
   * @param {string} key
   */
  destroyChart(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      this.instances[key] = null;
    }
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

    this.destroyChart('overviewTrend');

    if (!summary || summary.appliances.length === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'Add appliances to visualize consumption trends');
      return;
    }

    const colors = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    // Generate 7-day representative weekly projection based on household appliances
    // (Considers regular daily loads + day-specific weighting)
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const baselineDailyKwh = summary.totalDailyKwh;

    // Realistic day variance (weekends tend to have ~10-15% higher cooling/entertainment load)
    const weeklyData = [
      Number((baselineDailyKwh * 0.98).toFixed(2)),
      Number((baselineDailyKwh * 0.96).toFixed(2)),
      Number((baselineDailyKwh * 0.97).toFixed(2)),
      Number((baselineDailyKwh * 1.00).toFixed(2)),
      Number((baselineDailyKwh * 1.05).toFixed(2)),
      Number((baselineDailyKwh * 1.15).toFixed(2)),
      Number((baselineDailyKwh * 1.12).toFixed(2))
    ];

    const weeklyCosts = weeklyData.map(kwh => (kwh * summary.ratePerKwh).toFixed(2));

    this.instances.overviewTrend = new Chart(ctx, {
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
          legend: {
            display: false
          },
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
                  `Est. Cost: ₹${cost}`
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
            grid: {
              color: colors.gridColor,
              drawBorder: false
            },
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

    this.destroyChart('overviewCategory');

    if (!summary || summary.appliances.length === 0 || summary.totalMonthlyKwh === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'No category data available');
      return;
    }

    const colors = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    const activeCategories = Object.values(summary.categoryBreakdown)
      .filter(c => c.kwh > 0)
      .sort((a, b) => b.kwh - a.kwh);

    if (activeCategories.length === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'No category data available');
      return;
    }

    const labels = activeCategories.map(c => c.category);
    const dataKwh = activeCategories.map(c => Number(c.kwh.toFixed(2)));
    const bgColors = activeCategories.map((_, idx) => colors.categoryPalette[idx % colors.categoryPalette.length]);

    this.instances.overviewCategory = new Chart(ctx, {
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
                const cost = (cat.kwh * summary.ratePerKwh).toFixed(2);
                return [
                  `Energy: ${cat.kwh.toFixed(2)} kWh (${cat.percentage.toFixed(1)}%)`,
                  `Est. Bill: ₹${cost}`
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
  },

  /**
   * Analytics Timeline Chart (Daily / Weekly / Monthly View)
   */
  renderAnalyticsTimelineChart(summary, timeframe = 'monthly') {
    const canvas = document.getElementById('analyticsTimelineChart');
    if (!canvas) return;

    this.destroyChart('analyticsTimeline');

    if (!summary || summary.appliances.length === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'Add appliances to generate analytics projection');
      return;
    }

    const colors = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    let labels = [];
    let kwhData = [];
    let costData = [];

    if (timeframe === 'daily') {
      // 24-hour diurnal load distribution pattern based on household appliance usage
      labels = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];
      const baseHourly = summary.totalDailyKwh / 8;
      // Typical residential curve: peaks around 7-10 AM and 6-10 PM
      const profileWeights = [0.65, 0.50, 0.90, 1.35, 1.10, 1.25, 1.60, 1.40];
      kwhData = profileWeights.map(w => Number((baseHourly * w).toFixed(2)));
      costData = kwhData.map(kwh => (kwh * summary.ratePerKwh).toFixed(2));
    } else if (timeframe === 'weekly') {
      // 4-week cycle projection
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const weeklyBase = summary.totalMonthlyKwh / 4;
      kwhData = [
        Number((weeklyBase * 0.96).toFixed(2)),
        Number((weeklyBase * 1.02).toFixed(2)),
        Number((weeklyBase * 0.98).toFixed(2)),
        Number((weeklyBase * 1.04).toFixed(2))
      ];
      costData = kwhData.map(kwh => (kwh * summary.ratePerKwh).toFixed(2));
    } else {
      // Monthly 6-month projected horizon based on current appliance inventory
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
      costData = kwhData.map(kwh => (kwh * summary.ratePerKwh).toFixed(2));
    }

    this.instances.analyticsTimeline = new Chart(ctx, {
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
                `Est. Cost: ₹${costData[context.dataIndex]}`
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

    this.destroyChart('analyticsApplianceRank');

    if (!summary || summary.appliances.length === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'No appliance consumption records found');
      return;
    }

    const colors = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    // Sort appliances by monthly kWh descending (take top 8 for clean visual presentation)
    const sortedAppliances = [...summary.appliances]
      .sort((a, b) => b.monthlyKwh - a.monthlyKwh)
      .slice(0, 8);

    const labels = sortedAppliances.map(a => a.name.length > 22 ? a.name.substr(0, 20) + '…' : a.name);
    const dataKwh = sortedAppliances.map(a => Number(a.monthlyKwh.toFixed(2)));

    this.instances.analyticsApplianceRank = new Chart(ctx, {
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
                  `Est. Bill: ₹${app.monthlyCost.toFixed(2)}`,
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

    this.destroyChart('analyticsCategoryShare');

    if (!summary || summary.appliances.length === 0 || summary.totalMonthlyCost === 0) {
      this.renderEmptyStateOnCanvas(canvas, 'No cost data available');
      return;
    }

    const colors = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    const activeCategories = Object.values(summary.categoryBreakdown)
      .filter(c => c.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    const labels = activeCategories.map(c => c.category);
    const dataCost = activeCategories.map(c => Number(c.cost.toFixed(2)));
    const bgColors = activeCategories.map((_, idx) => colors.categoryPalette[idx % colors.categoryPalette.length]);

    this.instances.analyticsCategoryShare = new Chart(ctx, {
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
                  `Est. Cost: ₹${cat.cost.toFixed(2)}`,
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
   * Renders a clean luxury empty state text inside canvas container
   * @param {HTMLCanvasElement} canvas
   * @param {string} message
   */
  renderEmptyStateOnCanvas(canvas, message) {
    const parent = canvas.parentElement;
    if (!parent) return;

    // Check if empty overlay exists, else inject
    let overlay = parent.querySelector('.canvas-empty-state-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'canvas-empty-state-overlay';
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.padding = '1.5rem';
      overlay.style.textAlign = 'center';
      overlay.style.pointerEvents = 'none';
      parent.appendChild(overlay);
    }

    const colors = this.getThemeColors();
    overlay.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${colors.antiqueGold}" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.85;">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
      <div style="font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 600; color: ${colors.textColor}; margin-bottom: 0.25rem;">
        No Usage Data
      </div>
      <div style="font-size: 0.825rem; color: ${colors.softSlate}; max-width: 280px;">
        ${message}
      </div>
    `;
    overlay.style.display = 'flex';
  },

  /**
   * Removes empty state overlay on canvas
   */
  clearEmptyState(canvas) {
    const parent = canvas?.parentElement;
    const overlay = parent?.querySelector('.canvas-empty-state-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
};
