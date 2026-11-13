/**
 * WATTWATCH - Electricity Calculation Engine
 * Implements physical formulas for electrical consumption, flat and multi-slab tariffs,
 * budget tracking thresholds, appliance replacement simulations, month-to-month deltas,
 * and grid carbon emission analytics.
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
   * Calculates estimated electricity cost using a flat rate per kWh
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
   * Advanced Tariff Calculator: Computes charges based on flat or multi-slab progressive tariffs,
   * incorporating fixed meter charges and user-configured electricity duty/tax.
   * @param {number} totalKwh - Total monthly consumption
   * @param {Object} settings - Full or partial settings object
   * @returns {Object} Comprehensive tariff breakdown
   */
  calculateAdvancedTariff(totalKwh, settings = {}) {
    const kwh = Math.max(0, Number(totalKwh) || 0);
    const model = settings.tariffModel || 'flat';
    const rawFlat = Number(settings.electricityRate);
    const flatRate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawFlat))
      ? Math.max(0, rawFlat)
      : 8.00;

    const rawFixed = Number(settings.fixedCharges);
    const fixedCharge = (settings.fixedCharges !== undefined && settings.fixedCharges !== null && settings.fixedCharges !== '' && !isNaN(rawFixed))
      ? Math.max(0, rawFixed)
      : 0;

    const rawTax = Number(settings.additionalTaxPercent);
    const taxPercent = (settings.additionalTaxPercent !== undefined && settings.additionalTaxPercent !== null && settings.additionalTaxPercent !== '' && !isNaN(rawTax))
      ? Math.max(0, rawTax)
      : 0;

    let energyCharges = 0;
    const slabBreakdown = [];

    if (model === 'slab' && Array.isArray(settings.slabConfig) && settings.slabConfig.length > 0) {
      let remainingKwh = kwh;
      let lowerBound = 0;

      // Accept only a strictly increasing slab schedule with one open-ended final tier.
      const candidateSlabs = settings.slabConfig;
      const validConfig = candidateSlabs.length > 0
        && candidateSlabs[candidateSlabs.length - 1]?.upTo === null
        && candidateSlabs.every((slab, index) => {
          if (!slab || typeof slab !== 'object' || Array.isArray(slab)) return false;
          const rate = Number(slab.rate);
          if (!Number.isFinite(rate) || rate < 0) return false;
          if (slab.upTo === null) return index === candidateSlabs.length - 1;
          const limit = Number(slab.upTo);
          return Number.isFinite(limit) && limit > 0
            && (index === 0 || limit > Number(candidateSlabs[index - 1].upTo));
        });
      const validSlabs = validConfig
        ? candidateSlabs.map(slab => ({ upTo: slab.upTo === null ? null : Number(slab.upTo), rate: Number(slab.rate) }))
        : [{ upTo: null, rate: flatRate }];

      for (let i = 0; i < validSlabs.length; i++) {
        const slab = validSlabs[i];
        const slabRate = slab.rate;
        const upperBound = slab.upTo;

        let slabCapacity = 0;
        let unitsInSlab = 0;

        if (upperBound !== null) {
          slabCapacity = Math.max(0, upperBound - lowerBound);
          unitsInSlab = Math.min(remainingKwh, slabCapacity);
          lowerBound = upperBound;
        } else {
          // Open-ended highest tier (e.g., above 300 units)
          unitsInSlab = remainingKwh;
        }

        const costInSlab = unitsInSlab * slabRate;
        energyCharges += costInSlab;
        remainingKwh = Math.max(0, remainingKwh - unitsInSlab);

        slabBreakdown.push({
          tier: i + 1,
          label: upperBound !== null
            ? `${i === 0 ? '0' : validSlabs[i-1]?.upTo || 0} - ${upperBound} kWh`
            : `Above ${validSlabs[i-1]?.upTo || lowerBound} kWh`,
          units: unitsInSlab,
          rate: slabRate,
          cost: costInSlab
        });
      }

      // The final validated tier is open-ended, so no excess fallback is needed.
    } else {
      // Standard Flat Rate model
      energyCharges = kwh * flatRate;
      slabBreakdown.push({
        tier: 1,
        label: `All consumption (Flat rate)`,
        units: kwh,
        rate: flatRate,
        cost: energyCharges
      });
    }

    const subtotal = energyCharges + fixedCharge;
    const taxCharges = subtotal * (taxPercent / 100);
    const totalCost = subtotal + taxCharges;
    const effectiveRatePerKwh = kwh > 0 ? totalCost / kwh : flatRate;

    return {
      model,
      totalKwh,
      energyCharges,
      fixedCharge,
      taxPercent,
      taxCharges,
      totalCost,
      effectiveRatePerKwh,
      slabBreakdown
    };
  },

  /**
   * Budget Tracker: Computes budget utilization, remaining allowance, and threshold warnings
   * @param {number} estimatedMonthlyBill - Current estimated monthly cost
   * @param {number} budgetInr - Configured monthly budget in INR
   * @returns {Object} Budget tracking status
   */
  calculateBudgetStatus(estimatedMonthlyBill, budgetInr) {
    const bill = Math.max(0, Number(estimatedMonthlyBill) || 0);
    const budget = Math.max(0, Number(budgetInr) || 0);

    if (budget <= 0) {
      return {
        hasBudget: false,
        budget: 0,
        estimatedBill: bill,
        remaining: 0,
        utilizationPercent: 0,
        status: 'unset',
        statusLabel: 'No Budget Set',
        warningLevel: null,
        message: 'Set a monthly electricity budget in Settings to track utilization.'
      };
    }

    const remaining = budget - bill;
    const utilizationPercent = (bill / budget) * 100;

    let status = 'safe';
    let statusLabel = 'Within Budget';
    let warningLevel = null;
    let message = `You have utilized ${utilizationPercent.toFixed(1)}% of your monthly ₹${budget.toLocaleString('en-IN')} budget.`;

    if (utilizationPercent >= 100) {
      status = 'exceeded';
      statusLabel = 'Budget Exceeded';
      warningLevel = 100;
      message = `Alert: Current estimate (₹${bill.toFixed(2)}) exceeds your monthly budget by ₹${Math.abs(remaining).toFixed(2)} (${utilizationPercent.toFixed(1)}%).`;
    } else if (utilizationPercent >= 90) {
      status = 'critical';
      statusLabel = 'Critical (≥ 90%)';
      warningLevel = 90;
      message = `Warning: You have reached ${utilizationPercent.toFixed(1)}% of your monthly budget. Only ₹${remaining.toFixed(2)} remains.`;
    } else if (utilizationPercent >= 75) {
      status = 'warning';
      statusLabel = 'Caution (≥ 75%)';
      warningLevel = 75;
      message = `Notice: Consumption is at ${utilizationPercent.toFixed(1)}% of your budget limit.`;
    }

    return {
      hasBudget: true,
      budget,
      estimatedBill: bill,
      remaining,
      utilizationPercent,
      status,
      statusLabel,
      warningLevel,
      message
    };
  },

  /**
   * Month-to-Month Comparison: Calculates differentials between two billing snapshots
   * Includes robust zero-division safety handling.
   * @param {Object} snapA - Base/earlier period snapshot
   * @param {Object} snapB - Target/later period snapshot
   * @returns {Object} Comparative deltas and percentage changes
   */
  compareSnapshots(snapA, snapB) {
    if (!snapA || !snapB) return null;

    const kwhA = Math.max(0, Number(snapA.totalKwh) || 0);
    const kwhB = Math.max(0, Number(snapB.totalKwh) || 0);
    const costA = Math.max(0, Number(snapA.totalCost) || 0);
    const costB = Math.max(0, Number(snapB.totalCost) || 0);

    const kwhDiff = kwhB - kwhA;
    const costDiff = costB - costA;

    // Zero-division safety for percentage calculations
    let kwhPercentDiff = 0;
    if (kwhA > 0) {
      kwhPercentDiff = ((kwhB - kwhA) / kwhA) * 100;
    } else if (kwhB > 0) {
      kwhPercentDiff = 100.0;
    }

    let costPercentDiff = 0;
    if (costA > 0) {
      costPercentDiff = ((costB - costA) / costA) * 100;
    } else if (costB > 0) {
      costPercentDiff = 100.0;
    }

    return {
      periodA: snapA.period,
      periodLabelA: snapA.periodLabel || snapA.period,
      periodB: snapB.period,
      periodLabelB: snapB.periodLabel || snapB.period,
      kwhA,
      kwhB,
      costA,
      costB,
      kwhDiff,
      costDiff,
      kwhPercentDiff,
      costPercentDiff,
      kwhIncreased: kwhDiff > 0,
      costIncreased: costDiff > 0,
      isIdentical: Math.abs(kwhDiff) < 0.001 && Math.abs(costDiff) < 0.001
    };
  },

  /**
   * Appliance Replacement Simulator: Evaluates energy, bill, and ROI payback
   * between an existing baseline appliance and a prospective alternative.
   * Supports both uniform flat rates and active progressive multi-slab tariffs.
   * @param {Object} baselineAppliance
   * @param {number} altWatts - Prospective alternative power rating
   * @param {number} altDailyHours - Prospective daily operating hours
   * @param {number} altDays - Operating days per month
   * @param {number} altQty - Units quantity
   * @param {number|Object} rateOrSettings - Electricity tariff rate or full settings object
   * @param {number} purchaseCostInr - Optional upfront purchase cost of new appliance
   * @param {number} householdTotalKwh - Optional total household monthly consumption for marginal slab savings
   * @returns {Object} Comparative metrics & savings
   */
  simulateReplacement(baselineAppliance, altWatts, altDailyHours, altDays, altQty, rateOrSettings = 8.00, purchaseCostInr = 0, householdTotalKwh = 0) {
    const baseW = Number(baselineAppliance.powerWatts) || 0;
    const baseH = Number(baselineAppliance.dailyHours) || 0;
    const baseD = Number(baselineAppliance.operatingDays) || 30;
    const baseQ = Number(baselineAppliance.quantity) || 1;

    const newW = Math.max(0, Number(altWatts) || 0);
    const newH = Math.min(24, Math.max(0, Number(altDailyHours) || 0));
    const newD = Math.min(31, Math.max(1, Number(altDays) || baseD));
    const newQ = Math.max(1, Number(altQty) || baseQ);

    const baseMonthlyKwh = this.calculateMonthlyKwh(baseW, baseQ, baseH, baseD);
    const newMonthlyKwh = this.calculateMonthlyKwh(newW, newQ, newH, newD);
    const monthlyKwhSaved = baseMonthlyKwh - newMonthlyKwh;
    const annualKwhSaved = monthlyKwhSaved * 12;

    let baseMonthlyCost = 0;
    let newMonthlyCost = 0;
    let monthlyCostSaved = 0;
    let tariffMode = 'flat';
    let effectiveRate = 8.00;

    if (typeof rateOrSettings === 'object' && rateOrSettings !== null && rateOrSettings.tariffModel === 'slab') {
      tariffMode = 'slab';
      const settings = rateOrSettings;
      const flatRate = Math.max(0, Number(settings.electricityRate) || 8.00);

      // Evaluate household baseline bill and post-replacement bill to determine exact marginal reduction
      const curHouseholdKwh = Math.max(baseMonthlyKwh, Number(householdTotalKwh) || 0);
      const baseTariff = this.calculateAdvancedTariff(curHouseholdKwh, settings);
      const postHouseholdKwh = Math.max(0, curHouseholdKwh - monthlyKwhSaved);
      const postTariff = this.calculateAdvancedTariff(postHouseholdKwh, settings);

      effectiveRate = baseTariff.effectiveRatePerKwh;
      monthlyCostSaved = baseTariff.totalCost - postTariff.totalCost;
      baseMonthlyCost = baseMonthlyKwh * effectiveRate;
      newMonthlyCost = Math.max(0, baseMonthlyCost - monthlyCostSaved);
    } else {
      let rawVal = null;
      if (typeof rateOrSettings === 'object' && rateOrSettings !== null) {
        rawVal = rateOrSettings.electricityRate;
      } else {
        rawVal = rateOrSettings;
      }

      const numVal = Number(rawVal);
      const rate = (rawVal !== undefined && rawVal !== null && rawVal !== '' && !isNaN(numVal) && numVal >= 0)
        ? numVal
        : 8.00;

      effectiveRate = rate;
      baseMonthlyCost = this.calculateCost(baseMonthlyKwh, rate);
      newMonthlyCost = this.calculateCost(newMonthlyKwh, rate);
      monthlyCostSaved = baseMonthlyCost - newMonthlyCost;
    }

    const annualCostSaved = monthlyCostSaved * 12;

    let percentSaved = 0;
    if (baseMonthlyKwh > 0) {
      percentSaved = (monthlyKwhSaved / baseMonthlyKwh) * 100;
    }

    // Payback period in months
    const upfrontCost = Math.max(0, Number(purchaseCostInr) || 0);
    let paybackMonths = null;
    if (upfrontCost > 0 && monthlyCostSaved > 0) {
      paybackMonths = upfrontCost / monthlyCostSaved;
    }

    return {
      baseline: {
        name: baselineAppliance.name,
        watts: baseW,
        hours: baseH,
        days: baseD,
        quantity: baseQ,
        monthlyKwh: baseMonthlyKwh,
        monthlyCost: baseMonthlyCost
      },
      replacement: {
        watts: newW,
        hours: newH,
        days: newD,
        quantity: newQ,
        monthlyKwh: newMonthlyKwh,
        monthlyCost: newMonthlyCost
      },
      savings: {
        monthlyKwhSaved,
        monthlyCostSaved,
        annualKwhSaved,
        annualCostSaved,
        percentSaved,
        isSaving: monthlyCostSaved > 0,
        upfrontCost,
        paybackMonths
      },
      tariffMode,
      effectiveRate
    };
  },

  /**
   * Carbon Footprint Estimator: Quantifies electricity-driven CO2e emissions
   * @param {number} totalMonthlyKwh - Total household consumption in kWh
   * @param {number|null} emissionFactor - Grid carbon intensity in kg CO2e / kWh
   * @returns {Object} Carbon emission analytics
   */
  calculateCarbonFootprint(totalMonthlyKwh, emissionFactor = 0.82) {
    const kwh = Math.max(0, Number(totalMonthlyKwh) || 0);

    if (emissionFactor === null || emissionFactor === undefined || isNaN(Number(emissionFactor)) || Number(emissionFactor) <= 0) {
      return {
        isAvailable: false,
        emissionFactor: null,
        monthlyKgCO2: 0,
        annualKgCO2: 0,
        annualMetricTons: 0,
        treesEquivalent: 0,
        message: 'Carbon intensity factor is currently disabled or unconfigured in Settings.'
      };
    }

    const factor = Number(emissionFactor);
    const monthlyKgCO2 = kwh * factor;
    const annualKgCO2 = monthlyKgCO2 * 12;
    const annualMetricTons = annualKgCO2 / 1000;

    // An average mature urban tree sequesters ~21.77 kg of CO2 per year (US EPA / CEA standard)
    const treesEquivalent = Math.round(annualKgCO2 / 21.77);

    return {
      isAvailable: true,
      emissionFactor: factor,
      monthlyKgCO2,
      annualKgCO2,
      annualMetricTons,
      treesEquivalent,
      formula: `Monthly kWh (${kwh.toFixed(2)}) × Grid Factor (${factor.toFixed(2)} kg CO₂e/kWh)`
    };
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
   * Aggregates complete household consumption metrics across all appliances.
   * Supports both uniform flat rates and active progressive multi-slab tariffs.
   * In slab mode, individual appliance costs and categories are proportionally
   * allocated according to the active tariff's effective rate so all costs
   * sum exactly to the advanced tariff total bill.
   * @param {Array} appliances
   * @param {number|Object} rateOrSettings
   * @returns {Object} Comprehensive summary metrics
   */
  calculateHouseholdSummary(appliances = [], rateOrSettings = 8.00) {
    let settings = null;
    let rate = 8.00;
    let isSlab = false;

    if (typeof rateOrSettings === 'object' && rateOrSettings !== null) {
      settings = rateOrSettings;
      const rawRate = Number(settings.electricityRate);
      rate = (settings.electricityRate !== undefined && settings.electricityRate !== null && settings.electricityRate !== '' && !isNaN(rawRate))
        ? Math.max(0, rawRate)
        : 8.00;
      isSlab = settings.tariffModel === 'slab';
    } else {
      const rawRate = Number(rateOrSettings);
      rate = (rateOrSettings !== undefined && rateOrSettings !== null && rateOrSettings !== '' && !isNaN(rawRate))
        ? Math.max(0, rawRate)
        : 8.00;
    }

    // First pass: aggregate total consumption
    let totalDailyKwh = 0;
    let totalMonthlyKwh = 0;
    let totalUnits = 0;

    appliances.forEach(app => {
      const dailyKwh = this.calculateDailyKwh(app.powerWatts, app.quantity, app.dailyHours);
      const monthlyKwh = this.calculateMonthlyKwh(app.powerWatts, app.quantity, app.dailyHours, app.operatingDays);
      totalDailyKwh += dailyKwh;
      totalMonthlyKwh += monthlyKwh;
      totalUnits += Number(app.quantity) || 1;
    });

    let advancedTariff = null;
    let effectiveRate = rate;
    let totalMonthlyCost = 0;

    if (settings) {
      // Single consistent calculation source: calculateAdvancedTariff handles both 'slab' and 'flat' models,
      // ensuring fixed charges and electricity duty/taxes are treated consistently across dashboard and advanced tariff.
      advancedTariff = this.calculateAdvancedTariff(totalMonthlyKwh, settings);
      effectiveRate = advancedTariff.effectiveRatePerKwh;
      totalMonthlyCost = advancedTariff.totalCost;
    } else {
      totalMonthlyCost = totalMonthlyKwh * rate;
      effectiveRate = rate;
    }

    // Second pass: enrich appliances with costs using the tariff rate (flat energy rate or slab effective rate)
    const appCostRate = isSlab ? effectiveRate : rate;
    const enrichedList = appliances.map(app => {
      const dailyKwh = this.calculateDailyKwh(app.powerWatts, app.quantity, app.dailyHours);
      const monthlyKwh = this.calculateMonthlyKwh(app.powerWatts, app.quantity, app.dailyHours, app.operatingDays);
      const monthlyCost = monthlyKwh * appCostRate;
      const dailyCost = dailyKwh * appCostRate;

      return {
        ...app,
        dailyKwh,
        monthlyKwh,
        dailyCost,
        monthlyCost
      };
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
      categoryBreakdown[cat].count += Number(app.quantity) || 1;
    });

    Object.keys(categoryBreakdown).forEach(cat => {
      categoryBreakdown[cat].percentage = totalMonthlyKwh > 0
        ? (categoryBreakdown[cat].kwh / totalMonthlyKwh) * 100
        : 0;
    });

    return {
      totalDailyKwh,
      totalMonthlyKwh,
      totalDailyCost: totalDailyKwh * effectiveRate,
      totalMonthlyCost,
      energyCharges: advancedTariff ? advancedTariff.energyCharges : totalMonthlyCost,
      fixedCharges: advancedTariff ? advancedTariff.fixedCharge : 0,
      taxCharges: advancedTariff ? advancedTariff.taxCharges : 0,
      totalAppliancesCount: appliances.length,
      totalUnits,
      ratePerKwh: isSlab ? effectiveRate : rate,
      baseRatePerKwh: rate,
      effectiveRatePerKwh: effectiveRate,
      tariffModel: isSlab ? 'slab' : 'flat',
      advancedTariff,
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
