/**
 * WATTWATCH - Energy-Saving Recommendations Engine
 * Generates rule-based, data-driven optimization strategies using actual appliance parameters.
 * Note: All figures are calculated estimates based on nominal ratings; actual savings vary by utility.
 */

const WattWatchRecommendations = {
  /**
   * Evaluates active appliances and returns prioritized energy-saving tips
   * @param {Array} appliances - Raw appliance list
   * @param {number} ratePerKwh - Electricity tariff rate (₹/kWh)
   * @returns {Object} { tips: Array, totalPotentialSavingsKwh: number, totalPotentialSavingsCost: number }
   */
  generateRecommendations(appliances = [], ratePerKwh = 8.00) {
    if (!appliances || appliances.length === 0) {
      return {
        tips: [],
        totalPotentialSavingsKwh: 0,
        totalPotentialSavingsCost: 0
      };
    }

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, ratePerKwh);
    const enrichedList = summary.appliances;
    const totalMonthlyKwh = summary.totalMonthlyKwh;
    const tips = [];

    enrichedList.forEach(app => {
      const share = app.sharePercentage;
      const power = app.powerWatts;
      const hours = app.dailyHours;
      const days = app.operatingDays;
      const qty = app.quantity;

      // RULE 1: High Share Dominance (> 22% of total household consumption)
      if (share >= 22 && totalMonthlyKwh > 50) {
        const reducedHours = Math.min(1.5, Math.max(0.5, hours * 0.2));
        const savedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, reducedHours, days);
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
        });
      }

      // RULE 2: Extended High-Draw Operating Hours (> 600W running > 4 hours/day)
      if (power >= 600 && hours > 4) {
        const targetReductionHours = 1.0;
        const savedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, targetReductionHours, days);
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
        });
      }

      // RULE 3: Cooling Efficiency & Temperature Management
      if (app.category === 'Cooling' && power >= 800) {
        // Bureau of Energy Efficiency (BEE) benchmark: Setting AC at 24°C saves ~6% per degree vs 18°-20°C
        const estimatedEcoSavingsRatio = 0.12; // 12% saving by shifting from 20°C to 24°C
        const savedKwh = app.monthlyKwh * estimatedEcoSavingsRatio;
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
        });
      }

      // RULE 4: Water Heating Overheating Prevention (Geysers running > 1.2 hours)
      if (app.category === 'Other' && (app.name.toLowerCase().includes('geyser') || app.name.toLowerCase().includes('heater') || power >= 1500) && hours > 1.2) {
        const trimHours = Math.max(0.5, hours - 0.75);
        const savedKwh = WattWatchCalculations.calculateMonthlyKwh(power, qty, trimHours, days);
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
        });
      }

      // RULE 5: High-Wattage Lighting Replacement Candidate
      if (app.category === 'Lighting' && power > 20) {
        // Replacing high wattage fixtures with 9W modern LEDs
        const wattageDifference = Math.max(10, power - 9);
        const savedKwh = WattWatchCalculations.calculateMonthlyKwh(wattageDifference, qty, hours, days);
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
        });
      }

      // RULE 6: Entertainment & Computing Phantom Standby Load
      if ((app.category === 'Entertainment' || app.category === 'Computing') && hours >= 4) {
        // 8% conservation by isolating vampire standby draw with smart power strip
        const savedKwh = app.monthlyKwh * 0.08;
        const savedCost = WattWatchCalculations.calculateCost(savedKwh, ratePerKwh);

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
          annualSavingsCost: savedCost * 12
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
      totalPotentialSavingsCost
    };
  }
};
