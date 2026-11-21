/**
 * WATTWATCH - Energy-Saving Recommendations Engine
 * Generates rule-based, data-driven optimization strategies using actual appliance parameters.
 * Supports both uniform flat tariffs and progressive multi-slab tariffs by comparing
 * complete household bills before and after proposed reductions.
 * Note: All figures are calculated estimates based on nominal ratings; actual savings vary by utility.
 */

const WattWatchRecommendations = {
  /**
   * Evaluates active appliances and returns prioritized energy-saving tips
   * @param {Array} appliances - Raw appliance list
   * @param {number|Object} rateOrSettings - Electricity tariff rate (₹/kWh) or settings object
   * @returns {Object} { tips: Array, totalPotentialSavingsKwh: number, totalPotentialSavingsCost: number, ... }
   */
  generateRecommendations(appliances = [], rateOrSettings = 8.00) {
    if (!appliances || appliances.length === 0) {
      return {
        tips: [],
        totalPotentialSavingsKwh: 0,
        totalPotentialSavingsCost: 0,
        annualSavingsCost: 0,
        tariffMode: 'flat',
        isEstimated: true,
        accuracyDisclaimer: 'All recommendations are calculated estimates based on configured equipment ratings and operating schedules, not guaranteed utility reductions.'
      };
    }

    let settings = null;
    let fallbackRate = 8.00;

    if (typeof rateOrSettings === 'object' && rateOrSettings !== null) {
      settings = rateOrSettings;
      fallbackRate = WattWatchCalculations.validateTariffRate(settings.electricityRate, 8.00);
    } else {
      fallbackRate = WattWatchCalculations.validateTariffRate(rateOrSettings, 8.00);
      settings = { tariffModel: 'flat', electricityRate: fallbackRate };
    }

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings || fallbackRate);
    const enrichedList = summary.appliances || [];
    const totalMonthlyKwh = summary.totalMonthlyKwh || 0;
    const isSlab = settings && settings.tariffModel === 'slab';
    const tips = [];

    /**
     * Helper to compute exact monetary savings for a given kWh reduction.
     * For slab tariffs, compares the complete household bill before and after the reduction.
     * Avoids flat rate multiplication against tiered consumption.
     */
    const computeMonetarySavings = (savedKwh) => {
      if (!savedKwh || savedKwh <= 0 || isNaN(savedKwh)) return 0;
      if (isSlab && settings) {
        const curKwh = Math.max(0, totalMonthlyKwh);
        const postKwh = Math.max(0, curKwh - savedKwh);
        const baseTariff = WattWatchCalculations.calculateAdvancedTariff(curKwh, settings);
        const postTariff = WattWatchCalculations.calculateAdvancedTariff(postKwh, settings);
        if (baseTariff && baseTariff.isValid && postTariff && postTariff.isValid) {
          return Math.max(0, baseTariff.totalCost - postTariff.totalCost);
        }
      }
      return WattWatchCalculations.calculateCost(savedKwh, fallbackRate);
    };

    enrichedList.forEach(app => {
      const share = app.sharePercentage || 0;
      const power = app.powerWatts || 0;
      const hours = app.dailyHours || 0;
      const days = app.operatingDays || 0;
      const qty = app.quantity || 1;
      const appMonthlyKwh = app.monthlyKwh || 0;

      // RULE 1: High Share Dominance (> 22% of total household consumption)
      if (share >= 22 && totalMonthlyKwh > 50) {
        const reducedHours = Math.min(1.5, Math.max(0.5, hours * 0.2));
        const rawSavedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, reducedHours, days);
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, rawSavedKwh));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_dom_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'High Impact',
          impactClass: 'badge-burgundy',
          reason: `Accounts for ${share.toFixed(1)}% of your entire monthly electricity consumption.`,
          suggestedAction: `Moderate daily operating duration by ${(reducedHours).toFixed(1)} hours or adopt eco-mode settings.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 2: Extended High-Draw Operating Hours (> 600W running > 4 hours/day)
      if (power >= 600 && hours > 4) {
        const targetReductionHours = 1.0;
        const rawSavedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, targetReductionHours, days);
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, rawSavedKwh));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_highrun_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'High Impact',
          impactClass: 'badge-burgundy',
          reason: `High power draw (${power}W) operating for an extensive ${hours} hours per day.`,
          suggestedAction: `Utilize a programmable timer or thermostat shut-off to trim daily active usage by 1 hour.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 3: Cooling Efficiency & Temperature Management
      if (app.category === 'Cooling' && power >= 800) {
        // Bureau of Energy Efficiency (BEE) benchmark: Setting AC at 24°C saves ~6% per degree vs 18°-20°C
        const estimatedEcoSavingsRatio = 0.12; // 12% saving by shifting from 20°C to 24°C
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * estimatedEcoSavingsRatio));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_cooling_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'Moderate Impact',
          impactClass: 'badge-gold',
          reason: `Compressor operates at high thermal load during cooling cycles.`,
          suggestedAction: `Set baseline thermostat to 24°C and supplement with ceiling airflow to cut compressor duty by ~12%.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 4: Water Heating Overheating Prevention (Geysers running > 1.2 hours)
      if (app.category === 'Other' && (app.name.toLowerCase().includes('geyser') || app.name.toLowerCase().includes('heater') || power >= 1500) && hours > 1.2) {
        const trimHours = Math.max(0.5, hours - 0.75);
        const rawSavedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, trimHours, days);
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, rawSavedKwh));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_water_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'High Impact',
          impactClass: 'badge-burgundy',
          reason: `Water heaters continuously cycle elements when kept powered beyond heating requirements.`,
          suggestedAction: `Power on 20-30 minutes prior to bathing rather than prolonged continuous standby.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 5: High-Wattage Lighting Replacement Candidate
      if (app.category === 'Lighting' && power > 20) {
        // Replacing high wattage fixtures with 9W modern LEDs
        const wattageDifference = Math.max(10, power - 9);
        const rawSavedKwh = WattWatchCalculations.calculateMonthlyKwh(wattageDifference, qty, hours, days);
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, rawSavedKwh));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_lighting_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'Moderate Impact',
          impactClass: 'badge-gold',
          reason: `Installed fixtures draw ${power}W per unit, exceeding modern solid-state LED standards (9W-12W).`,
          suggestedAction: `Retrofit fixtures with 9W warm architectural LED bulbs yielding equivalent lumens.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 6: Entertainment & Computing Phantom Standby Load
      if ((app.category === 'Entertainment' || app.category === 'Computing') && hours >= 4) {
        // 8% conservation by isolating vampire standby draw with smart power strip
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * 0.08));
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_phantom_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'Optimization',
          impactClass: 'badge-blue',
          reason: `Audio-visual components and display clusters maintain continuous standby current when turned off.`,
          suggestedAction: `Connect peripheral clusters to a switched master strip to eliminate parasitic standby draw.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 7: Continuous Refrigeration & Thermal Calibration
      const isRefrig = app.name.toLowerCase().includes('fridge') || app.name.toLowerCase().includes('refrigerator');
      if (isRefrig || ((app.category === 'Cooling' || app.category === 'Kitchen') && hours >= 20 && power >= 120)) {
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * 0.08)); // ~8% duty reduction
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_refrig_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'Moderate Impact',
          impactClass: 'badge-gold',
          reason: `Operates continuously throughout the day with recurring compressor thermal cycles.`,
          suggestedAction: `Maintain 3°C to 4°C fresh compartment temperature and ensure door seals are airtight to prevent thermal leak.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }

      // RULE 8: Heavy Kitchen Thermal Optimization
      if (app.category === 'Kitchen' && power >= 1200 && hours > 1) {
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * 0.10)); // ~10% thermal efficiency
        const savedCost = computeMonetarySavings(savedKwh);

        tips.push({
          id: `tip_kitchen_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          category: app.category,
          impactLevel: 'Thermal Efficiency',
          impactClass: 'badge-burgundy',
          reason: `High heating wattage (${power}W) generates significant continuous thermal load.`,
          suggestedAction: `Use matching flat-bottom induction cookware with lids on to maximize direct thermal transfer and cut cook duration.`,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          isEstimated: true
        });
      }
    });

    // Deduplicate suggestions by unique appliance id + rule type
    const uniqueTips = [];
    const seenKeys = new Set();
    tips.forEach(t => {
      const key = `${t.applianceId}_${t.impactLevel}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueTips.push(t);
      }
    });

    // Sort by highest potential monetary savings
    uniqueTips.sort((a, b) => b.savedCostMonthly - a.savedCostMonthly);

    const totalPotentialSavingsKwh = uniqueTips.reduce((sum, item) => sum + item.savedKwhMonthly, 0);
    const totalPotentialSavingsCost = uniqueTips.reduce((sum, item) => sum + item.savedCostMonthly, 0);

    return {
      tips: uniqueTips,
      totalPotentialSavingsKwh,
      totalPotentialSavingsCost,
      annualSavingsCost: totalPotentialSavingsCost * 12,
      tariffMode: isSlab ? 'slab' : 'flat',
      isEstimated: true,
      accuracyDisclaimer: 'All recommendations are calculated estimates based on configured equipment ratings and operating schedules, not guaranteed utility reductions.'
    };
  },

  /**
   * Identifies top-consuming appliances and generates actionable what-if simulation scenarios
   * with precise monthly and annual energy & rupee savings calculations.
   * @param {Array} appliances
   * @param {number|Object} rateOrSettings
   * @returns {Object} Scenarios and ranked consumers
   */
  generateWhatIfScenarios(appliances = [], rateOrSettings = 8.00) {
    if (!appliances || appliances.length === 0) {
      return {
        scenarios: [],
        rankedConsumers: [],
        isEstimated: true,
        accuracyDisclaimer: 'Calculated estimates based on active tariff structure.'
      };
    }

    let settings = null;
    let fallbackRate = 8.00;

    if (typeof rateOrSettings === 'object' && rateOrSettings !== null) {
      settings = rateOrSettings;
      fallbackRate = WattWatchCalculations.validateTariffRate(settings.electricityRate, 8.00);
    } else {
      fallbackRate = WattWatchCalculations.validateTariffRate(rateOrSettings, 8.00);
      settings = { tariffModel: 'flat', electricityRate: fallbackRate };
    }

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
    const enriched = (summary && summary.appliances) ? [...summary.appliances] : [];
    const totalMonthlyKwh = summary.totalMonthlyKwh || 0;
    const isSlab = settings.tariffModel === 'slab';

    // Rank appliances by monthly kWh descending
    enriched.sort((a, b) => (b.monthlyKwh || 0) - (a.monthlyKwh || 0));

    const computeMonetarySavings = (savedKwh) => {
      if (!savedKwh || savedKwh <= 0 || isNaN(savedKwh)) return 0;
      if (isSlab && settings) {
        const curKwh = Math.max(0, totalMonthlyKwh);
        const postKwh = Math.max(0, curKwh - savedKwh);
        const baseTariff = WattWatchCalculations.calculateAdvancedTariff(curKwh, settings);
        const postTariff = WattWatchCalculations.calculateAdvancedTariff(postKwh, settings);
        if (baseTariff && baseTariff.isValid && postTariff && postTariff.isValid) {
          return Math.max(0, baseTariff.totalCost - postTariff.totalCost);
        }
      }
      return WattWatchCalculations.calculateCost(savedKwh, fallbackRate);
    };

    const scenarios = [];
    const topConsumers = enriched.slice(0, 4);

    topConsumers.forEach((app, rankIdx) => {
      const curKwh = app.monthlyKwh || 0;
      const curHours = app.dailyHours || 0;
      const power = app.powerWatts || 0;
      const days = app.operatingDays || 30;
      const qty = app.quantity || 1;

      if (curKwh <= 0) return;

      // Scenario 1: Runtime Reduction (-1 hr/day, or -0.5 hr if hours <= 2)
      if (curHours >= 1.0) {
        const trimHours = curHours > 2.0 ? 1.0 : 0.5;
        const targetHours = Math.max(0.5, curHours - trimHours);
        const savedKwh = Math.min(curKwh, Math.max(0, WattWatchCalculations.calculateMonthlyKwh(power, qty, trimHours, days)));
        const savedCost = computeMonetarySavings(savedKwh);

        if (savedKwh > 0.5) {
          scenarios.push({
            id: `whatif_runtime_${app.id}`,
            applianceId: app.id,
            applianceName: app.name,
            rank: rankIdx + 1,
            category: app.category,
            title: `Trim ${app.name} by ${trimHours} hr/day`,
            badge: 'Runtime Reduction',
            badgeClass: 'badge-burgundy',
            description: `Operating for ${targetHours}h instead of ${curHours}h daily reduces consumption while maintaining regular household convenience.`,
            currentMonthlyKwh: curKwh,
            savedKwhMonthly: savedKwh,
            savedCostMonthly: savedCost,
            annualSavingsCost: savedCost * 12,
            targetWatts: power,
            targetHours: targetHours,
            targetDays: days,
            targetQty: qty,
            isEstimated: true
          });
        }
      }

      // Scenario 2: Temperature / Duty Optimization (for Cooling / AC)
      if (app.category === 'Cooling' && power >= 750) {
        // Shifting from 20C to 24C saves approx 12-18% of compressor duty
        const savedKwh = Math.min(curKwh, curKwh * 0.15);
        const savedCost = computeMonetarySavings(savedKwh);
        const targetWatts = Math.round(power * 0.85);

        scenarios.push({
          id: `whatif_eco_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          rank: rankIdx + 1,
          category: app.category,
          title: `Set ${app.name} to 24°C Eco Thermostat`,
          badge: 'Thermal Optimization',
          badgeClass: 'badge-gold',
          description: `BEE benchmarks show each degree above 20°C saves ~6% compressor electricity. Setting 24°C cuts thermal load by ~15%.`,
          currentMonthlyKwh: curKwh,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          targetWatts: targetWatts,
          targetHours: curHours,
          targetDays: days,
          targetQty: qty,
          isEstimated: true
        });
      }

      // Scenario 3: Phantom Standby Elimination (for TV, PCs, Audio, or standbyWatts > 0)
      if ((app.category === 'Entertainment' || app.category === 'Computing' || (app.standbyWatts && app.standbyWatts > 0)) && curKwh > 10) {
        const standbyW = (app.standbyWatts && app.standbyWatts > 0) ? app.standbyWatts : 12;
        const idleHours = Math.max(4, 24 - curHours);
        const savedKwh = Math.min(curKwh, (standbyW * idleHours * 30 * qty) / 1000);
        const savedCost = computeMonetarySavings(savedKwh);

        if (savedKwh > 0.5) {
          scenarios.push({
            id: `whatif_standby_${app.id}`,
            applianceId: app.id,
            applianceName: app.name,
            rank: rankIdx + 1,
            category: app.category,
            title: `Eliminate Standby Phantom Draw on ${app.name}`,
            badge: 'Zero Phantom Load',
            badgeClass: 'badge-blue',
            description: `Powering down from the wall socket or using a smart strip cuts continuous ~${standbyW}W parasitic standby draw during idle hours.`,
            currentMonthlyKwh: curKwh,
            savedKwhMonthly: savedKwh,
            savedCostMonthly: savedCost,
            annualSavingsCost: savedCost * 12,
            targetWatts: power,
            targetHours: curHours,
            targetDays: days,
            targetQty: qty,
            isEstimated: true
          });
        }
      }

      // Scenario 4: High Wattage Lighting Modernization
      if (app.category === 'Lighting' && power >= 25) {
        const targetWatts = 9;
        const savedKwh = Math.min(curKwh, WattWatchCalculations.calculateMonthlyKwh(power - targetWatts, qty, curHours, days));
        const savedCost = computeMonetarySavings(savedKwh);

        scenarios.push({
          id: `whatif_led_${app.id}`,
          applianceId: app.id,
          applianceName: app.name,
          rank: rankIdx + 1,
          category: app.category,
          title: `Retrofit ${app.name} with 9W High-Efficiency LED`,
          badge: 'Hardware Modernization',
          badgeClass: 'badge-cooling',
          description: `Replace legacy bulbs with modern 9W architectural LEDs offering identical illumination with ~${((power - targetWatts) / power * 100).toFixed(0)}% lower wattage.`,
          currentMonthlyKwh: curKwh,
          savedKwhMonthly: savedKwh,
          savedCostMonthly: savedCost,
          annualSavingsCost: savedCost * 12,
          targetWatts: targetWatts,
          targetHours: curHours,
          targetDays: days,
          targetQty: qty,
          isEstimated: true
        });
      }
    });

    // Sort scenarios by highest monthly cost savings
    scenarios.sort((a, b) => b.savedCostMonthly - a.savedCostMonthly);

    return {
      scenarios,
      rankedConsumers: topConsumers.map((a, i) => ({
        rank: i + 1,
        id: a.id,
        name: a.name,
        category: a.category,
        monthlyKwh: a.monthlyKwh,
        monthlyCost: a.monthlyCost,
        sharePercentage: a.sharePercentage
      })),
      isEstimated: true,
      accuracyDisclaimer: 'Calculated estimates based on active household tariff structure.'
    };
  }
};
