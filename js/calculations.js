/**
 * WATTWATCH - Electricity Calculation Engine
 * Implements standard physical formulas for electrical energy consumption & bill estimation.
 * 
 * Formulas:
 *   Daily Energy (kWh)   = (Power in Watts × Quantity × Usage Hours) / 1000
 *   Monthly Energy (kWh) = (Power in Watts × Quantity × Usage Hours × Operating Days) / 1000
 *   Estimated Cost (₹)   = Energy Consumption (kWh) × Electricity Rate (₹/kWh)
 */

const WattWatchCalculations = {
  /**
   * Calculates daily energy consumption in kWh
   * @param {number} powerWatts - Nominal wattage (W)
   * @param {number} quantity - Number of units
   * @param {number} dailyHours - Daily active operating hours (0 - 24)
   * @returns {number} Daily consumption in kWh
   */
  calculateDailyKwh(powerWatts, quantity = 1, dailyHours = 0) {
    const p = Math.max(0, Number(powerWatts) || 0);
    const q = Math.max(1, Number(quantity) || 1);
    const h = Math.min(24, Math.max(0, Number(dailyHours) || 0));
    return (p * q * h) / 1000;
  },

  /**
   * Calculates monthly energy consumption in kWh
   * @param {number} powerWatts - Nominal wattage (W)
   * @param {number} quantity - Number of units
   * @param {number} dailyHours - Daily active operating hours (0 - 24)
   * @param {number} operatingDays - Operating days per month (1 - 31)
   * @returns {number} Monthly consumption in kWh
   */
  calculateMonthlyKwh(powerWatts, quantity = 1, dailyHours = 0, operatingDays = 30) {
    const p = Math.max(0, Number(powerWatts) || 0);
    const q = Math.max(1, Number(quantity) || 1);
    const h = Math.min(24, Math.max(0, Number(dailyHours) || 0));
    const d = Math.min(31, Math.max(1, Number(operatingDays) || 30));
    return (p * q * h * d) / 1000;
  },

  /**
   * Calculates estimated electricity cost
   * @param {number} energyKwh - Energy consumed in kWh
   * @param {number} ratePerKwh - Electricity price per unit (₹/kWh)
   * @returns {number} Cost in currency
   */
  calculateCost(energyKwh, ratePerKwh = 8.00) {
    const kwh = Math.max(0, Number(energyKwh) || 0);
    const rate = Math.max(0, Number(ratePerKwh) || 0);
    return kwh * rate;
  },

  /**
   * Generates enriched metrics for a single appliance
   * @param {Object} appliance
   * @param {number} ratePerKwh
   * @returns {Object} Appliance enriched with calculated energy & cost values
   */
  enrichAppliance(appliance, ratePerKwh = 8.00) {
    const dailyKwh = this.calculateDailyKwh(appliance.powerWatts, appliance.quantity, appliance.dailyHours);
    const monthlyKwh = this.calculateMonthlyKwh(appliance.powerWatts, appliance.quantity, appliance.dailyHours, appliance.operatingDays);
    const monthlyCost = this.calculateCost(monthlyKwh, ratePerKwh);
    const dailyCost = this.calculateCost(dailyKwh, ratePerKwh);

    return {
      ...appliance,
      dailyKwh,
      monthlyKwh,
      dailyCost,
      monthlyCost
    };
  },

  /**
   * Aggregates complete household consumption metrics across all appliances
   * @param {Array} appliances
   * @param {number} ratePerKwh
   * @returns {Object} Comprehensive summary metrics
   */
  calculateHouseholdSummary(appliances = [], ratePerKwh = 8.00) {
    let totalDailyKwh = 0;
    let totalMonthlyKwh = 0;
    let totalMonthlyCost = 0;
    let totalUnits = 0;

    const enrichedList = appliances.map(app => {
      const enriched = this.enrichAppliance(app, ratePerKwh);
      totalDailyKwh += enriched.dailyKwh;
      totalMonthlyKwh += enriched.monthlyKwh;
      totalMonthlyCost += enriched.monthlyCost;
      totalUnits += Number(enriched.quantity) || 1;
      return enriched;
    });

    // Compute percentage contribution of each appliance
    const enrichedWithShares = enrichedList.map(app => ({
      ...app,
      sharePercentage: totalMonthlyKwh > 0 ? (app.monthlyKwh / totalMonthlyKwh) * 100 : 0
    }));

    // Find highest consuming appliance
    let highestAppliance = null;
    if (enrichedWithShares.length > 0) {
      highestAppliance = [...enrichedWithShares].sort((a, b) => b.monthlyKwh - a.monthlyKwh)[0];
    }

    // Category breakdown
    const categoryBreakdown = {};
    const defaultCategories = ['Cooling', 'Lighting', 'Kitchen', 'Entertainment', 'Computing', 'Other'];
    defaultCategories.forEach(cat => {
      categoryBreakdown[cat] = {
        category: cat,
        kwh: 0,
        cost: 0,
        count: 0,
        percentage: 0
      };
    });

    enrichedWithShares.forEach(app => {
      const cat = app.category || 'Other';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { category: cat, kwh: 0, cost: 0, count: 0, percentage: 0 };
      }
      categoryBreakdown[cat].kwh += app.monthlyKwh;
      categoryBreakdown[cat].cost += app.monthlyCost;
      categoryBreakdown[cat].count += app.quantity;
    });

    Object.keys(categoryBreakdown).forEach(cat => {
      categoryBreakdown[cat].percentage = totalMonthlyKwh > 0
        ? (categoryBreakdown[cat].kwh / totalMonthlyKwh) * 100
        : 0;
    });

    return {
      totalDailyKwh,
      totalMonthlyKwh,
      totalMonthlyCost,
      totalAppliancesCount: appliances.length,
      totalUnits,
      ratePerKwh,
      highestAppliance,
      categoryBreakdown,
      appliances: enrichedWithShares
    };
  },

  /**
   * Formatting utility for kilowatt-hours (always 2 decimals)
   * @param {number} val
   * @returns {string} e.g. "145.20 kWh"
   */
  formatKwh(val) {
    const num = Number(val) || 0;
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
  },

  /**
   * Formatting utility for Indian Rupee currency (always 2 decimals)
   * @param {number} val
   * @param {string} symbol - Defaults to ₹
   * @returns {string} e.g. "₹1,245.50"
   */
  formatCurrency(val, symbol = '₹') {
    const num = Number(val) || 0;
    return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  /**
   * Formatting helper for generic numbers
   * @param {number} val
   * @param {number} decimals
   * @returns {string}
   */
  formatNumber(val, decimals = 2) {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
};
