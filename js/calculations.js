/**
 * WATTWATCH - Electricity Calculation Engine
 * Implements physical formulas for electrical consumption, flat and multi-slab tariffs,
 * budget tracking thresholds, appliance replacement simulations, month-to-month deltas,
 * and grid carbon emission analytics.
 */

const WattWatchCalculations = {
  /**
   * Centralized Numeric Validation Helpers
   */

  /**
   * Validates whether a value is a strictly finite numeric quantity.
   * Rejects NaN, Infinity, -Infinity, null, undefined, booleans, and empty strings.
   * @param {*} val
   * @returns {boolean}
   */
  isFiniteNumber(val) {
    if (val === null || val === undefined || typeof val === 'boolean') return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    const num = Number(val);
    return typeof num === 'number' && Number.isFinite(num);
  },

  /**
   * Validates appliance nominal power in Watts (0 to 50,000 W).
   * Rejects negative numbers, non-finite values, and excessive ratings (> 50,000 W).
   * Preserves explicit 0 Watts.
   * @param {*} watts
   * @param {number|undefined} defaultValue
   * @returns {number} Validated wattage or defaultValue / NaN
   */
  validatePowerWatts(watts, defaultValue = undefined) {
    if (watts === undefined) return defaultValue !== undefined ? defaultValue : NaN;
    if (!this.isFiniteNumber(watts)) return NaN;
    const num = Number(watts);
    if (num < 0 || num > 50000) return NaN;
    return num;
  },

  /**
   * Validates appliance unit count.
   * Must be a non-negative whole integer (rejects decimals, negatives, and non-finite values).
   * By default, inventory appliances require quantity >= 1.
   * In replacement simulations or math contexts, allowZero can be true.
   * @param {*} qty
   * @param {boolean} allowZero
   * @param {number|undefined} defaultValue
   * @returns {number} Validated integer quantity or defaultValue / NaN
   */
  validateQuantity(qty, allowZero = false, defaultValue = undefined) {
    if (qty === undefined) return defaultValue !== undefined ? defaultValue : NaN;
    if (!this.isFiniteNumber(qty)) return NaN;
    const num = Number(qty);
    if (!Number.isInteger(num)) return NaN;
    if (allowZero ? num < 0 : num < 1) return NaN;
    if (num > 1000) return NaN;
    return num;
  },

  /**
   * Validates daily operating hours (0 to 24 hours).
   * Rejects negative values, values > 24, and non-finite values without silent clamping.
   * Preserves explicit 0 hours.
   * @param {*} hours
   * @param {number|undefined} defaultValue
   * @returns {number} Validated daily hours or defaultValue / NaN
   */
  validateDailyHours(hours, defaultValue = undefined) {
    if (hours === undefined) return defaultValue !== undefined ? defaultValue : NaN;
    if (!this.isFiniteNumber(hours)) return NaN;
    const num = Number(hours);
    if (num < 0 || num > 24) return NaN;
    return num;
  },

  /**
   * Validates monthly operating days (integer between 0 and 31).
   * Rejects negative values, values > 31, non-integers, and non-finite values without silent clamping.
   * Preserves explicit 0 days (e.g. seasonal appliances).
   * @param {*} days
   * @param {boolean} allowZero
   * @param {number|undefined} defaultValue
   * @returns {number} Validated operating days or defaultValue / NaN
   */
  validateOperatingDays(days, allowZero = true, defaultValue = undefined) {
    if (days === undefined) return defaultValue !== undefined ? defaultValue : NaN;
    if (!this.isFiniteNumber(days)) return NaN;
    const num = Number(days);
    if (!Number.isInteger(num)) return NaN;
    if (allowZero ? (num < 0 || num > 31) : (num < 1 || num > 31)) return NaN;
    return num;
  },

  /**
   * Validates electricity price rate per kWh (₹/kWh).
   * Must be a non-negative finite number.
   * If rate is genuinely omitted (undefined), applies defaultValue.
   * If explicitly supplied and invalid, returns NaN.
   * @param {*} rate
   * @param {number} defaultValue
   * @returns {number} Validated tariff rate
   */
  validateTariffRate(rate, defaultValue = 8.00) {
    if (rate === undefined) return defaultValue;
    if (!this.isFiniteNumber(rate)) return NaN;
    const num = Number(rate);
    if (num < 0) return NaN;
    return num;
  },

  /**
   * Validates monthly fixed meter charge in currency.
   * Must be a non-negative finite number.
   * If fixed is genuinely omitted (undefined), applies defaultValue (0).
   * If explicitly supplied and invalid, returns NaN.
   * @param {*} fixed
   * @param {number} defaultValue
   * @returns {number} Validated fixed charge
   */
  validateFixedCharge(fixed, defaultValue = 0) {
    if (fixed === undefined) return defaultValue;
    if (!this.isFiniteNumber(fixed)) return NaN;
    const num = Number(fixed);
    if (num < 0) return NaN;
    return num;
  },

  /**
   * Validates additional tax/duty percentage (0% to 100%).
   * Must be a finite number between 0 and 100.
   * If tax is genuinely omitted (undefined), applies defaultValue (0).
   * If explicitly supplied and invalid, returns NaN.
   * @param {*} tax
   * @param {number} defaultValue
   * @returns {number} Validated tax percentage
   */
  validateTaxPercent(tax, defaultValue = 0) {
    if (tax === undefined) return defaultValue;
    if (!this.isFiniteNumber(tax)) return NaN;
    const num = Number(tax);
    if (num < 0 || num > 100) return NaN;
    return num;
  },

  /**
   * Validates any general non-negative finite numeric quantity (e.g. kWh, costs, budgets).
   * Rejects negative numbers and non-finite values.
   * @param {*} val
   * @param {number|undefined} defaultValue
   * @returns {number} Validated non-negative number or defaultValue / NaN
   */
  validateNonNegative(val, defaultValue = undefined) {
    if (val === undefined) return defaultValue !== undefined ? defaultValue : NaN;
    if (!this.isFiniteNumber(val)) return NaN;
    const num = Number(val);
    if (num < 0) return NaN;
    return num;
  },

  /**
   * Calculates daily energy consumption in kWh
   * @param {number} powerWatts - Nominal wattage (W)
   * @param {number} quantity - Number of units
   * @param {number} dailyHours - Daily active operating hours (0 - 24)
   * @returns {number} Daily consumption in kWh (or NaN if invalid)
   */
  calculateDailyKwh(powerWatts = 0, quantity = 1, dailyHours = 0) {
    const p = this.validatePowerWatts(powerWatts, 0);
    const q = this.validateQuantity(quantity, true, 1);
    const h = this.validateDailyHours(dailyHours, 0);
    if (isNaN(p) || isNaN(q) || isNaN(h)) return NaN;
    return (p * q * h) / 1000;
  },

  /**
   * Calculates monthly energy consumption in kWh
   * @param {number} powerWatts - Nominal wattage (W)
   * @param {number} quantity - Number of units
   * @param {number} dailyHours - Daily active operating hours (0 - 24)
   * @param {number} operatingDays - Operating days per month (0 - 31)
   * @returns {number} Monthly consumption in kWh (or NaN if invalid)
   */
  calculateMonthlyKwh(powerWatts = 0, quantity = 1, dailyHours = 0, operatingDays = 30) {
    const p = this.validatePowerWatts(powerWatts, 0);
    const q = this.validateQuantity(quantity, true, 1);
    const h = this.validateDailyHours(dailyHours, 0);
    const d = this.validateOperatingDays(operatingDays, true, 30);
    if (isNaN(p) || isNaN(q) || isNaN(h) || isNaN(d)) return NaN;
    return (p * q * h * d) / 1000;
  },

  /**
   * Calculates estimated electricity cost using a flat rate per kWh
   * @param {number} energyKwh - Energy consumed in kWh
   * @param {number} ratePerKwh - Electricity price per unit (₹/kWh)
   * @returns {number} Cost in currency (or NaN if invalid)
   */
  calculateCost(energyKwh = 0, ratePerKwh = 8.00) {
    const kwh = this.validateNonNegative(energyKwh, 0);
    const rate = this.validateTariffRate(ratePerKwh, 8.00);
    if (isNaN(kwh) || isNaN(rate)) return NaN;
    return kwh * rate;
  },

  /**
   * Helper creating an invalid tariff result object
   * @private
   */
  _createInvalidTariffResult(totalKwh, model = 'flat', error = 'Invalid tariff calculation parameters') {
    return {
      isValid: false,
      error,
      model,
      totalKwh: typeof totalKwh === 'number' ? totalKwh : NaN,
      energyCharges: NaN,
      fixedCharge: NaN,
      taxPercent: NaN,
      taxCharges: NaN,
      totalCost: NaN,
      effectiveRatePerKwh: NaN,
      slabBreakdown: []
    };
  },

  /**
   * Advanced Tariff Calculator: Computes charges based on flat or multi-slab progressive tariffs,
   * incorporating fixed meter charges and user-configured electricity duty/tax.
   * @param {number} totalKwh - Total monthly consumption
   * @param {Object} settings - Full or partial settings object
   * @returns {Object} Comprehensive tariff breakdown
   */
  calculateAdvancedTariff(totalKwh = 0, settings = {}) {
    const safeSettings = (settings && typeof settings === 'object' && !Array.isArray(settings)) ? settings : {};
    const model = safeSettings.tariffModel || 'flat';

    if (!this.isFiniteNumber(totalKwh) || Number(totalKwh) < 0) {
      return this._createInvalidTariffResult(totalKwh, model, 'Consumption (kWh) must be a non-negative finite number');
    }
    const kwh = Number(totalKwh);

    // Flat rate validation:
    // If explicitly supplied, negative, malformed, NaN, or Infinity must invalidate tariff.
    // Apply default (8.00) only when genuinely omitted (undefined).
    const flatRate = this.validateTariffRate(safeSettings.electricityRate, 8.00);
    if (isNaN(flatRate)) {
      return this._createInvalidTariffResult(totalKwh, model, 'Electricity rate must be a non-negative finite number');
    }

    // Fixed charges validation:
    // If explicitly supplied, negative, malformed, NaN, or Infinity must invalidate tariff.
    // Apply default (0) only when genuinely omitted (undefined).
    const fixedCharge = this.validateFixedCharge(safeSettings.fixedCharges, 0);
    if (isNaN(fixedCharge)) {
      return this._createInvalidTariffResult(totalKwh, model, 'Fixed charges must be a non-negative finite number');
    }

    // Additional tax percentage validation:
    // Must be finite and between 0 and 100.
    // Apply default (0) only when genuinely omitted (undefined).
    const taxPercent = this.validateTaxPercent(safeSettings.additionalTaxPercent, 0);
    if (isNaN(taxPercent)) {
      return this._createInvalidTariffResult(totalKwh, model, 'Additional tax percent must be a finite number between 0 and 100');
    }

    let energyCharges = 0;
    const slabBreakdown = [];

    if (model === 'slab') {
      // Do not silently fall back to flat tariff when explicitly supplied slab configuration is invalid. Return an explicit invalid result.
      if (!Array.isArray(safeSettings.slabConfig) || safeSettings.slabConfig.length === 0) {
        return this._createInvalidTariffResult(totalKwh, model, 'Slab configuration must be a non-empty array');
      }

      const candidateSlabs = safeSettings.slabConfig;
      const validConfig = candidateSlabs.every((slab, index) => {
        if (!slab || typeof slab !== 'object' || Array.isArray(slab)) return false;
        if (!this.isFiniteNumber(slab.rate) || Number(slab.rate) < 0) return false;
        if (slab.upTo === null) return index === candidateSlabs.length - 1;
        if (!this.isFiniteNumber(slab.upTo) || Number(slab.upTo) <= 0) return false;
        return index === 0 || Number(slab.upTo) > Number(candidateSlabs[index - 1].upTo);
      });

      if (!validConfig) {
        return this._createInvalidTariffResult(totalKwh, model, 'Slab configuration contains invalid, negative, or non-progressive bounds/rates');
      }

      const validSlabs = candidateSlabs.map(slab => ({
        upTo: slab.upTo === null ? null : Number(slab.upTo),
        rate: Number(slab.rate)
      }));

      let remainingKwh = kwh;
      let lowerBound = 0;

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

      // If consumption remains above the highest slab upper bound (capped final slab),
      // bill excess consumption at the highest slab's rate (preserving M6 capped tariff slab fix)
      if (remainingKwh > 0 && validSlabs.length > 0) {
        const lastSlab = validSlabs[validSlabs.length - 1];
        const lastRate = lastSlab.rate;
        const costInExcess = remainingKwh * lastRate;
        energyCharges += costInExcess;

        slabBreakdown.push({
          tier: validSlabs.length + 1,
          label: `Excess above ${lastSlab.upTo || lowerBound} kWh`,
          units: remainingKwh,
          rate: lastRate,
          cost: costInExcess
        });
        remainingKwh = 0;
      }
    } else {
      // Standard Flat Rate model
      energyCharges = kwh * flatRate;
      slabBreakdown.push({
        tier: 1,
        label: 'All consumption (Flat rate)',
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
      isValid: true,
      model,
      totalKwh: kwh,
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
    // 1. Bill validity check: must be a finite number >= 0.
    // An invalid estimated bill must return status 'invalid', even when budget is zero, null or unset.
    // Never convert invalid bill values into zero.
    const isBillValid = this.isFiniteNumber(estimatedMonthlyBill) && Number(estimatedMonthlyBill) >= 0;
    if (!isBillValid) {
      const rawBudget = Number(budgetInr);
      const safeBudget = (this.isFiniteNumber(budgetInr) && rawBudget >= 0) ? rawBudget : NaN;
      return {
        hasBudget: false,
        budget: safeBudget,
        estimatedBill: NaN,
        remaining: NaN,
        utilizationPercent: NaN,
        status: 'invalid',
        statusLabel: 'Invalid Bill',
        warningLevel: null,
        message: 'Estimated bill amount is invalid, negative, or non-finite.'
      };
    }

    const bill = Number(estimatedMonthlyBill);

    // 2. Budget unset check: undefined, null, '', 0, or '0'
    const isBudgetUnset = budgetInr === undefined || budgetInr === null || budgetInr === '' ||
      (this.isFiniteNumber(budgetInr) && Number(budgetInr) === 0);

    if (isBudgetUnset) {
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

    // 3. Budget invalid check: negative, NaN, Infinity, malformed string, boolean
    const isBudgetValid = this.isFiniteNumber(budgetInr) && Number(budgetInr) > 0;
    if (!isBudgetValid) {
      return {
        hasBudget: false,
        budget: NaN,
        estimatedBill: bill,
        remaining: NaN,
        utilizationPercent: NaN,
        status: 'invalid',
        statusLabel: 'Invalid Budget',
        warningLevel: null,
        message: 'Monthly budget must be a positive number.'
      };
    }

    const budget = Number(budgetInr);
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
   * Includes robust zero-division safety and numeric integrity verification.
   * @param {Object} snapA - Base/earlier period snapshot
   * @param {Object} snapB - Target/later period snapshot
   * @returns {Object|null} Comparative deltas and percentage changes
   */
  compareSnapshots(snapA, snapB) {
    if (!snapA || !snapB || typeof snapA !== 'object' || typeof snapB !== 'object') return null;

    const validA = this.isFiniteNumber(snapA.totalKwh) && Number(snapA.totalKwh) >= 0 &&
                   this.isFiniteNumber(snapA.totalCost) && Number(snapA.totalCost) >= 0;
    const validB = this.isFiniteNumber(snapB.totalKwh) && Number(snapB.totalKwh) >= 0 &&
                   this.isFiniteNumber(snapB.totalCost) && Number(snapB.totalCost) >= 0;

    if (!validA || !validB) {
      return {
        isValid: false,
        periodA: snapA.period || null,
        periodLabelA: snapA.periodLabel || snapA.period || null,
        periodB: snapB.period || null,
        periodLabelB: snapB.periodLabel || snapB.period || null,
        kwhA: validA ? Number(snapA.totalKwh) : NaN,
        kwhB: validB ? Number(snapB.totalKwh) : NaN,
        costA: validA ? Number(snapA.totalCost) : NaN,
        costB: validB ? Number(snapB.totalCost) : NaN,
        kwhDiff: NaN,
        costDiff: NaN,
        kwhPercentDiff: NaN,
        costPercentDiff: NaN,
        kwhIncreased: false,
        costIncreased: false,
        isIdentical: false
      };
    }

    const kwhA = Number(snapA.totalKwh);
    const kwhB = Number(snapB.totalKwh);
    const costA = Number(snapA.totalCost);
    const costB = Number(snapB.totalCost);

    const kwhDiff = kwhB - kwhA;
    const costDiff = costB - costA;

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
      isValid: true,
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
   * Helper creating an invalid simulation result object
   * @private
   */
  _createInvalidSimulationResult(baselineAppliance, error = 'Invalid simulation parameters') {
    return {
      isValid: false,
      error,
      baseline: {
        name: baselineAppliance?.name || 'Baseline',
        watts: NaN,
        hours: NaN,
        days: NaN,
        quantity: NaN,
        monthlyKwh: NaN,
        monthlyCost: NaN
      },
      replacement: {
        watts: NaN,
        hours: NaN,
        days: NaN,
        quantity: NaN,
        monthlyKwh: NaN,
        monthlyCost: NaN
      },
      savings: {
        monthlyKwhSaved: NaN,
        monthlyCostSaved: NaN,
        annualKwhSaved: NaN,
        annualCostSaved: NaN,
        percentSaved: NaN,
        isSaving: false,
        upfrontCost: NaN,
        paybackMonths: null
      },
      tariffMode: 'flat',
      effectiveRate: NaN
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
   * @param {number} altQty - Units quantity (0 allowed for intentional removal)
   * @param {number|Object} rateOrSettings - Electricity tariff rate or full settings object
   * @param {number} purchaseCostInr - Optional upfront purchase cost of new appliance
   * @param {number} householdTotalKwh - Optional total household monthly consumption for marginal slab savings
   * @returns {Object|null} Comparative metrics & savings
   */
  simulateReplacement(baselineAppliance, altWatts, altDailyHours, altDays, altQty, rateOrSettings = 8.00, purchaseCostInr = 0, householdTotalKwh = 0) {
    if (!baselineAppliance || typeof baselineAppliance !== 'object') {
      return null;
    }

    const baseW = this.validatePowerWatts(baselineAppliance.powerWatts, 0);
    const baseH = this.validateDailyHours(baselineAppliance.dailyHours, 0);
    const baseD = this.validateOperatingDays(baselineAppliance.operatingDays, true, 30);
    const baseQ = this.validateQuantity(baselineAppliance.quantity, true, 1);

    const newW = this.validatePowerWatts(altWatts);
    const newH = this.validateDailyHours(altDailyHours !== undefined ? altDailyHours : baseH);
    const newD = this.validateOperatingDays(altDays !== undefined ? altDays : baseD, true);
    const newQ = this.validateQuantity(altQty !== undefined ? altQty : baseQ, true);

    const isBaseValid = !isNaN(baseW) && !isNaN(baseH) && !isNaN(baseD) && !isNaN(baseQ);
    const isNewValid = !isNaN(newW) && !isNaN(newH) && !isNaN(newD) && !isNaN(newQ);

    let upfrontCost = 0;
    if (purchaseCostInr !== undefined && purchaseCostInr !== null && purchaseCostInr !== '') {
      if (!this.isFiniteNumber(purchaseCostInr) || Number(purchaseCostInr) < 0) {
        return this._createInvalidSimulationResult(baselineAppliance, 'Upfront purchase cost must be a non-negative finite number');
      }
      upfrontCost = Number(purchaseCostInr);
    }

    if (!isBaseValid || !isNewValid) {
      return this._createInvalidSimulationResult(baselineAppliance, 'Baseline or replacement appliance parameters are invalid');
    }

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

      const validCurKwh = (this.isFiniteNumber(householdTotalKwh) && Number(householdTotalKwh) >= 0)
        ? Number(householdTotalKwh)
        : 0;
      const curHouseholdKwh = Math.max(baseMonthlyKwh, validCurKwh);
      const baseTariff = this.calculateAdvancedTariff(curHouseholdKwh, settings);
      const postHouseholdKwh = Math.max(0, curHouseholdKwh - monthlyKwhSaved);
      const postTariff = this.calculateAdvancedTariff(postHouseholdKwh, settings);

      if (!baseTariff.isValid || !postTariff.isValid) {
        return this._createInvalidSimulationResult(baselineAppliance, 'Tariff calculation failed for simulation');
      }

      effectiveRate = baseTariff.effectiveRatePerKwh;
      monthlyCostSaved = baseTariff.totalCost - postTariff.totalCost;
      baseMonthlyCost = baseMonthlyKwh * effectiveRate;
      newMonthlyCost = Math.max(0, baseMonthlyCost - monthlyCostSaved);
    } else {
      let rawVal = (typeof rateOrSettings === 'object' && rateOrSettings !== null)
        ? rateOrSettings.electricityRate
        : rateOrSettings;

      const rate = this.validateTariffRate(rawVal, 8.00);
      if (isNaN(rate)) {
        return this._createInvalidSimulationResult(baselineAppliance, 'Electricity rate is invalid');
      }
      effectiveRate = rate;
      baseMonthlyCost = this.calculateCost(baseMonthlyKwh, effectiveRate);
      newMonthlyCost = this.calculateCost(newMonthlyKwh, effectiveRate);
      monthlyCostSaved = baseMonthlyCost - newMonthlyCost;
    }

    const annualCostSaved = monthlyCostSaved * 12;

    let percentSaved = 0;
    if (baseMonthlyKwh > 0) {
      percentSaved = (monthlyKwhSaved / baseMonthlyKwh) * 100;
    }

    let paybackMonths = null;
    if (upfrontCost > 0 && monthlyCostSaved > 0) {
      paybackMonths = upfrontCost / monthlyCostSaved;
    }

    return {
      isValid: true,
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
    if (!this.isFiniteNumber(totalMonthlyKwh) || Number(totalMonthlyKwh) < 0) {
      return {
        isAvailable: false,
        isValid: false,
        emissionFactor: null,
        monthlyKgCO2: NaN,
        annualKgCO2: NaN,
        annualMetricTons: NaN,
        treesEquivalent: NaN,
        message: 'Invalid consumption value provided for carbon estimation.'
      };
    }

    const kwh = Number(totalMonthlyKwh);

    if (emissionFactor === null || emissionFactor === undefined || emissionFactor === '' ||
        (this.isFiniteNumber(emissionFactor) && Number(emissionFactor) === 0)) {
      return {
        isAvailable: false,
        isValid: true,
        emissionFactor: null,
        monthlyKgCO2: 0,
        annualKgCO2: 0,
        annualMetricTons: 0,
        treesEquivalent: 0,
        message: 'Carbon intensity factor is currently disabled or unconfigured in Settings.'
      };
    }

    if (!this.isFiniteNumber(emissionFactor) || Number(emissionFactor) < 0) {
      return {
        isAvailable: false,
        isValid: false,
        emissionFactor: null,
        monthlyKgCO2: NaN,
        annualKgCO2: NaN,
        annualMetricTons: NaN,
        treesEquivalent: NaN,
        message: 'Invalid carbon emission factor.'
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
      isValid: true,
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
   * @returns {Object|null} Appliance enriched with calculated energy & cost values
   */
  enrichAppliance(appliance, ratePerKwh = 8.00) {
    if (!appliance || typeof appliance !== 'object') return null;
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
   *
   * If any appliance has invalid ratings or schedule parameters, or if the tariff
   * is invalid, the summary returns isValid: false and does not compute misleading partial totals.
   * @param {Array} appliances
   * @param {number|Object} rateOrSettings
   * @returns {Object} Comprehensive summary metrics
   */
  calculateHouseholdSummary(appliances = [], rateOrSettings = 8.00) {
    const list = Array.isArray(appliances) ? appliances : [];
    let settings = null;
    let rate = 8.00;
    let isSlab = false;
    let isRateValid = true;

    if (typeof rateOrSettings === 'object' && rateOrSettings !== null) {
      settings = rateOrSettings;
      rate = this.validateTariffRate(settings.electricityRate, 8.00);
      if (isNaN(rate)) {
        isRateValid = false;
      }
      isSlab = settings.tariffModel === 'slab';
    } else {
      rate = this.validateTariffRate(rateOrSettings, 8.00);
      if (isNaN(rate)) {
        isRateValid = false;
      }
    }

    // First pass: validate each individual appliance
    const invalidAppliances = [];
    const validAppEntries = [];

    list.forEach((app, idx) => {
      if (!app || typeof app !== 'object' || Array.isArray(app)) {
        invalidAppliances.push({
          index: idx,
          id: null,
          name: 'Invalid entry',
          reasons: ['Appliance must be an object']
        });
        return;
      }

      const p = this.validatePowerWatts(app.powerWatts, 0);
      const q = this.validateQuantity(app.quantity, true, 1);
      const h = this.validateDailyHours(app.dailyHours, 0);
      const d = this.validateOperatingDays(app.operatingDays, true, 30);

      const failures = [];
      if (isNaN(p)) failures.push(`Power rating (${app.powerWatts}) is invalid or out of range (0-50,000 W)`);
      if (isNaN(q)) failures.push(`Quantity (${app.quantity}) must be a non-negative whole integer`);
      if (isNaN(h)) failures.push(`Daily hours (${app.dailyHours}) must be between 0 and 24`);
      if (isNaN(d)) failures.push(`Operating days (${app.operatingDays}) must be an integer between 0 and 31`);

      if (failures.length > 0) {
        invalidAppliances.push({
          index: idx,
          id: app.id || null,
          name: app.name || `Appliance #${idx + 1}`,
          reasons: failures
        });
      } else {
        const dailyKwh = (p * q * h) / 1000;
        const monthlyKwh = (p * q * h * d) / 1000;
        validAppEntries.push({ app, p, q, h, d, dailyKwh, monthlyKwh });
      }
    });

    const hasInvalidAppliances = invalidAppliances.length > 0;

    // If electricity rate was explicitly supplied and invalid:
    if (!isRateValid) {
      return {
        isValid: false,
        hasInvalidAppliances,
        invalidAppliances,
        error: 'Electricity tariff rate is invalid',
        totalDailyKwh: hasInvalidAppliances ? NaN : validAppEntries.reduce((acc, e) => acc + e.dailyKwh, 0),
        totalMonthlyKwh: hasInvalidAppliances ? NaN : validAppEntries.reduce((acc, e) => acc + e.monthlyKwh, 0),
        totalDailyCost: NaN,
        totalMonthlyCost: NaN,
        energyCharges: NaN,
        fixedCharges: NaN,
        taxCharges: NaN,
        totalAppliancesCount: list.length,
        validAppliancesCount: validAppEntries.length,
        totalUnits: hasInvalidAppliances ? NaN : validAppEntries.reduce((acc, e) => acc + e.q, 0),
        ratePerKwh: isSlab ? NaN : rate,
        baseRatePerKwh: rate,
        effectiveRatePerKwh: NaN,
        tariffModel: isSlab ? 'slab' : 'flat',
        advancedTariff: null,
        highestAppliance: null,
        categoryBreakdown: {},
        appliances: list.map(a => this.enrichAppliance(a, NaN))
      };
    }

    // If ANY appliance is invalid:
    // Do not silently skip invalid appliances and return an apparently valid partial total.
    // Return an explicit validity indicator and identify invalid appliance data safely.
    if (hasInvalidAppliances) {
      return {
        isValid: false,
        hasInvalidAppliances: true,
        invalidAppliances,
        error: `${invalidAppliances.length} appliance(s) in inventory contain invalid ratings or schedule parameters`,
        totalDailyKwh: NaN,
        totalMonthlyKwh: NaN,
        totalDailyCost: NaN,
        totalMonthlyCost: NaN,
        energyCharges: NaN,
        fixedCharges: NaN,
        taxCharges: NaN,
        totalAppliancesCount: list.length,
        validAppliancesCount: validAppEntries.length,
        totalUnits: NaN,
        ratePerKwh: isSlab ? NaN : rate,
        baseRatePerKwh: rate,
        effectiveRatePerKwh: NaN,
        tariffModel: isSlab ? 'slab' : 'flat',
        advancedTariff: null,
        highestAppliance: null,
        categoryBreakdown: {},
        appliances: list.map(a => this.enrichAppliance(a, rate))
      };
    }

    // All appliances are valid: compute genuine totals
    let totalDailyKwh = 0;
    let totalMonthlyKwh = 0;
    let totalUnits = 0;

    validAppEntries.forEach(e => {
      totalDailyKwh += e.dailyKwh;
      totalMonthlyKwh += e.monthlyKwh;
      totalUnits += e.q;
    });

    let advancedTariff = null;
    let effectiveRate = rate;
    let totalMonthlyCost = 0;

    if (settings) {
      advancedTariff = this.calculateAdvancedTariff(totalMonthlyKwh, settings);
      if (!advancedTariff.isValid) {
        return {
          isValid: false,
          hasInvalidAppliances: false,
          invalidAppliances: [],
          error: advancedTariff.error || 'Tariff calculation failed with provided settings',
          totalDailyKwh,
          totalMonthlyKwh,
          totalDailyCost: NaN,
          totalMonthlyCost: NaN,
          energyCharges: NaN,
          fixedCharges: NaN,
          taxCharges: NaN,
          totalAppliancesCount: list.length,
          validAppliancesCount: validAppEntries.length,
          totalUnits,
          ratePerKwh: NaN,
          baseRatePerKwh: rate,
          effectiveRatePerKwh: NaN,
          tariffModel: isSlab ? 'slab' : 'flat',
          advancedTariff,
          highestAppliance: null,
          categoryBreakdown: {},
          appliances: list.map(a => this.enrichAppliance(a, NaN))
        };
      }
      effectiveRate = advancedTariff.effectiveRatePerKwh;
      totalMonthlyCost = advancedTariff.totalCost;
    } else {
      totalMonthlyCost = totalMonthlyKwh * rate;
      effectiveRate = rate;
    }

    // Second pass: enrich appliances with costs using the tariff rate (flat energy rate or slab effective rate)
    const appCostRate = isSlab ? effectiveRate : rate;
    const enrichedList = list.map(app => {
      const dailyKwh = this.calculateDailyKwh(app.powerWatts, app.quantity, app.dailyHours);
      const monthlyKwh = this.calculateMonthlyKwh(app.powerWatts, app.quantity, app.dailyHours, app.operatingDays);
      const monthlyCost = (!isNaN(monthlyKwh) && monthlyKwh >= 0) ? (monthlyKwh * appCostRate) : NaN;
      const dailyCost = (!isNaN(dailyKwh) && dailyKwh >= 0) ? (dailyKwh * appCostRate) : NaN;

      return {
        ...app,
        dailyKwh,
        monthlyKwh,
        dailyCost,
        monthlyCost
      };
    });

    // Compute percentage contribution of each appliance
    const enrichedWithShares = enrichedList.map(app => {
      const mKwh = app.monthlyKwh;
      const share = (totalMonthlyKwh > 0 && this.isFiniteNumber(mKwh) && mKwh >= 0)
        ? (mKwh / totalMonthlyKwh) * 100
        : 0;
      return {
        ...app,
        sharePercentage: share
      };
    });

    // Find highest consuming appliance
    let highestAppliance = null;
    const validMonthlyApps = enrichedWithShares.filter(a => this.isFiniteNumber(a.monthlyKwh) && a.monthlyKwh > 0);
    if (validMonthlyApps.length > 0) {
      highestAppliance = [...validMonthlyApps].sort((a, b) => b.monthlyKwh - a.monthlyKwh)[0];
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
      if (this.isFiniteNumber(app.monthlyKwh) && app.monthlyKwh >= 0) {
        categoryBreakdown[cat].kwh += app.monthlyKwh;
      }
      if (this.isFiniteNumber(app.monthlyCost) && app.monthlyCost >= 0) {
        categoryBreakdown[cat].cost += app.monthlyCost;
      }
      const validQty = this.validateQuantity(app.quantity, true, 1);
      if (!isNaN(validQty) && validQty >= 0) {
        categoryBreakdown[cat].count += validQty;
      }
    });

    Object.keys(categoryBreakdown).forEach(cat => {
      categoryBreakdown[cat].percentage = totalMonthlyKwh > 0
        ? (categoryBreakdown[cat].kwh / totalMonthlyKwh) * 100
        : 0;
    });

    return {
      isValid: true,
      hasInvalidAppliances: false,
      invalidAppliances: [],
      error: null,
      totalDailyKwh,
      totalMonthlyKwh,
      totalDailyCost: totalDailyKwh * effectiveRate,
      totalMonthlyCost,
      energyCharges: advancedTariff && advancedTariff.isValid ? advancedTariff.energyCharges : totalMonthlyCost,
      fixedCharges: advancedTariff && advancedTariff.isValid ? advancedTariff.fixedCharge : 0,
      taxCharges: advancedTariff && advancedTariff.isValid ? advancedTariff.taxCharges : 0,
      totalAppliancesCount: list.length,
      validAppliancesCount: list.length,
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
   * Formats invalid/non-finite inputs safely as "-- kWh".
   * @param {number} val
   * @returns {string} e.g. "145.20 kWh" or "-- kWh"
   */
  formatKwh(val) {
    if (!this.isFiniteNumber(val) || Number(val) < 0) {
      return '-- kWh';
    }
    const num = Number(val);
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
  },

  /**
   * Formatting utility for Indian Rupee currency (always 2 decimals)
   * Formats invalid/non-finite inputs safely as "₹--".
   * @param {number} val
   * @param {string} symbol - Defaults to ₹
   * @returns {string} e.g. "₹1,245.50" or "₹--"
   */
  formatCurrency(val, symbol = '₹') {
    const sym = (typeof symbol === 'string' && symbol.trim()) ? symbol : '₹';
    if (!this.isFiniteNumber(val) || Number(val) < 0) {
      return `${sym}--`;
    }
    const num = Number(val);
    return `${sym}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  /**
   * Formatting helper for generic numbers
   * Formats invalid/non-finite inputs safely as "--".
   * @param {number} val
   * @param {number} decimals
   * @returns {string}
   */
  formatNumber(val, decimals = 2) {
    if (!this.isFiniteNumber(val)) {
      return '--';
    }
    const num = Number(val);
    const dec = (Number.isInteger(decimals) && decimals >= 0 && decimals <= 20) ? decimals : 2;
    return num.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};
