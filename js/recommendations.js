/**
 * WATTWATCH - Energy-Saving Recommendations Engine
 * Generates rule-based, data-driven optimization strategies using actual appliance parameters.
 * Supports both uniform flat tariffs and progressive multi-slab tariffs by comparing
 * complete household bills before and after proposed reductions, reconciling overlapping
 * per-appliance energy savings and sequential household bill savings cleanly.
 * Note: All figures are calculated estimates based on nominal ratings; actual savings vary by utility.
 */

const WattWatchRecommendations = {
  /**
   * Builds a standardized invalid recommendations response.
   * Ensures monetary/energy totals never silently display zero when calculation fails.
   * @param {string} error
   * @param {string} [tariffMode='flat']
   * @returns {Object}
   */
  _invalidRecommendationsResult(error, tariffMode = 'flat') {
    return {
      isValid: false,
      error: error || 'Recommendations calculation failed',
      tips: [],
      totalPotentialSavingsKwh: NaN,
      totalPotentialSavingsCost: NaN,
      individualSumSavingsKwh: NaN,
      individualSumSavingsCost: NaN,
      annualSavingsCost: NaN,
      hasOverlappingRecommendations: false,
      overlapAdjustmentKwh: NaN,
      overlapAdjustmentCost: NaN,
      calculationIssues: [error || 'Recommendations calculation failed'],
      hasCalculationIssues: true,
      tariffMode,
      isEstimated: true,
      accuracyDisclaimer: 'Recommendations unavailable: verify active tariff settings and appliance records.'
    };
  },

  /**
   * Builds a standardized empty/zero-consumption valid recommendations response.
   * @param {string} [tariffMode='flat']
   * @returns {Object}
   */
  _emptyRecommendationsResult(tariffMode = 'flat') {
    return {
      isValid: true,
      tips: [],
      totalPotentialSavingsKwh: 0,
      totalPotentialSavingsCost: 0,
      individualSumSavingsKwh: 0,
      individualSumSavingsCost: 0,
      annualSavingsCost: 0,
      hasOverlappingRecommendations: false,
      overlapAdjustmentKwh: 0,
      overlapAdjustmentCost: 0,
      calculationIssues: [],
      hasCalculationIssues: false,
      tariffMode,
      isEstimated: true,
      accuracyDisclaimer: 'All recommendations are calculated estimates based on configured equipment ratings and operating schedules, not guaranteed utility reductions.'
    };
  },

  /**
   * Builds a standardized invalid What-If scenarios response.
   * @param {string} error
   * @param {Array<string>} [issues]
   * @returns {Object}
   */
  _invalidWhatIfResult(error, issues = []) {
    const list = issues.length > 0 ? [...issues] : [error || 'What-If scenario calculation failed'];
    return {
      isValid: false,
      error: error || list[0],
      scenarios: [],
      rankedConsumers: [],
      calculationIssues: list,
      warnings: list,
      hasCalculationIssues: true,
      isEstimated: true,
      accuracyDisclaimer: 'Calculated estimates unavailable due to invalid tariff or appliance configuration.'
    };
  },

  /**
   * Builds a standardized empty/zero-consumption valid What-If scenarios response.
   * @returns {Object}
   */
  _emptyWhatIfResult() {
    return {
      isValid: true,
      scenarios: [],
      rankedConsumers: [],
      calculationIssues: [],
      warnings: [],
      hasCalculationIssues: false,
      isEstimated: true,
      accuracyDisclaimer: 'Calculated estimates based on active household tariff structure.'
    };
  },

  /**
   * Resolves a tariff rate or settings object into a validated settings structure.
   * Falls back to active storage settings when omitted.
   * @param {number|Object|null|undefined} rateOrSettings
   * @returns {{ isValid: boolean, settings: Object|null, error?: string }}
   */
  _resolveSettings(rateOrSettings) {
    let settings = null;
    if (typeof rateOrSettings === 'object' && rateOrSettings !== null && !Array.isArray(rateOrSettings)) {
      settings = { ...rateOrSettings };
      if (settings.electricityRate === undefined) {
        settings.electricityRate = 8.00;
      }
      if (!settings.tariffModel) {
        settings.tariffModel = 'flat';
      }
    } else if (rateOrSettings !== undefined && rateOrSettings !== null && rateOrSettings !== '') {
      const rate = WattWatchCalculations.validateTariffRate(rateOrSettings, NaN);
      if (isNaN(rate)) {
        return { isValid: false, settings: null, error: 'Electricity tariff rate is invalid' };
      }
      settings = {
        tariffModel: 'flat',
        electricityRate: rate,
        fixedCharges: 0,
        additionalTaxPercent: 0,
        freeUnits: 0,
        billCreditInr: 0
      };
    } else if (typeof WattWatchStorage !== 'undefined' && typeof WattWatchStorage.getSettings === 'function') {
      settings = WattWatchStorage.getSettings();
    } else {
      settings = {
        tariffModel: 'flat',
        electricityRate: 8.00,
        fixedCharges: 0,
        additionalTaxPercent: 0,
        freeUnits: 0,
        billCreditInr: 0
      };
    }

    const tariffCheck = WattWatchCalculations.calculateAdvancedTariff(0, settings);
    if (!tariffCheck || !tariffCheck.isValid) {
      return {
        isValid: false,
        settings: null,
        error: tariffCheck?.error || 'Tariff configuration is invalid'
      };
    }

    return { isValid: true, settings };
  },

  /**
   * Normalizes appliance standbyWatts safely, distinguishing genuinely unspecified standby
   * from explicit zero (0 / "0"), valid positive values, and malformed values.
   * @param {*} rawStandby
   * @returns {{ isSpecified: boolean, isExplicitZero: boolean, isValid: boolean, watts: number|null }}
   */
  _normalizeStandbyWatts(rawStandby) {
    if (rawStandby === undefined || rawStandby === null) {
      return { isSpecified: false, isExplicitZero: false, isValid: true, watts: null };
    }
    if (typeof rawStandby === 'string' && rawStandby.trim() === '') {
      return { isSpecified: false, isExplicitZero: false, isValid: true, watts: null };
    }
    const num = WattWatchCalculations.validateStandbyWatts(rawStandby, NaN);
    if (Number.isNaN(num)) {
      return { isSpecified: true, isExplicitZero: false, isValid: false, watts: NaN };
    }
    if (num === 0) {
      return { isSpecified: true, isExplicitZero: true, isValid: true, watts: 0 };
    }
    return { isSpecified: true, isExplicitZero: false, isValid: true, watts: num };
  },

  /**
   * Validates tariff settings and complete appliance list strictly without silently filtering
   * invalid appliances. Returns empty marker cleanly when array is empty.
   * @param {Array} appliances
   * @param {number|Object} rateOrSettings
   * @returns {Object}
   */
  _validateAndSummarize(appliances, rateOrSettings) {
    const resolved = this._resolveSettings(rateOrSettings);
    const tariffMode = resolved.settings?.tariffModel === 'slab' ? 'slab' : 'flat';

    if (!resolved.isValid || !resolved.settings) {
      return { isValid: false, error: resolved.error || 'Invalid tariff settings', tariffMode };
    }

    if (appliances === undefined) {
      return { isValid: true, isEmpty: true, settings: resolved.settings, tariffMode };
    }

    if (appliances === null) {
      return { isValid: false, error: 'Appliances inventory cannot be null', tariffMode };
    }

    if (!Array.isArray(appliances)) {
      return { isValid: false, error: 'Appliances inventory must be an array', tariffMode };
    }

    if (appliances.length === 0) {
      return { isValid: true, isEmpty: true, settings: resolved.settings, tariffMode };
    }

    const summary = WattWatchCalculations.calculateHouseholdSummary(appliances, resolved.settings);
    if (!summary || !summary.isValid) {
      const detailError = (Array.isArray(summary?.invalidAppliances) && summary.invalidAppliances.length > 0)
        ? `Invalid appliance record "${summary.invalidAppliances[0].name}": ${(summary.invalidAppliances[0].reasons || []).join(', ')}`
        : (summary?.error || 'One or more appliance records or tariff settings are invalid');
      return {
        isValid: false,
        error: summary?.error || detailError,
        invalidAppliances: summary?.invalidAppliances || [],
        tariffMode
      };
    }

    const enriched = Array.isArray(summary.appliances) ? summary.appliances : [];
    const failedMetric = enriched.find(a => !a.metrics || a.metrics.isValid === false || !Number.isFinite(a.monthlyKwh));
    if (failedMetric) {
      return {
        isValid: false,
        error: `Unable to calculate valid energy metrics for appliance "${failedMetric.name || 'Appliance'}"`,
        tariffMode
      };
    }

    return {
      isValid: true,
      isEmpty: false,
      settings: resolved.settings,
      tariffMode,
      summary,
      appliances: enriched,
      totalMonthlyKwh: Math.max(0, summary.totalMonthlyKwh || 0)
    };
  },

  /**
   * Computes exact marginal monetary savings using the central calculation engine
   * across both flat and progressive slab models (including free units, fixed charges,
   * duties/tax, and government subsidies). Propagates tariff errors instead of returning 0.
   * @param {number} curHouseholdKwh
   * @param {number} savedKwh
   * @param {Object} settings
   * @returns {{ isValid: boolean, savedCost: number, error?: string }}
   */
  _computeMarginalSavings(curHouseholdKwh, savedKwh, settings) {
    if (!Number.isFinite(curHouseholdKwh) || curHouseholdKwh < 0 || !Number.isFinite(savedKwh) || savedKwh < 0) {
      return { isValid: false, savedCost: NaN, error: 'Invalid energy values for tariff savings calculation' };
    }
    if (curHouseholdKwh === 0 || savedKwh === 0) {
      return { isValid: true, savedCost: 0 };
    }
    const clampedSavedKwh = Math.min(curHouseholdKwh, Math.max(0, savedKwh));
    const postKwh = Math.max(0, curHouseholdKwh - clampedSavedKwh);
    try {
      const baseTariff = WattWatchCalculations.calculateAdvancedTariff(curHouseholdKwh, settings);
      const postTariff = WattWatchCalculations.calculateAdvancedTariff(postKwh, settings);
      if (
        !baseTariff || !baseTariff.isValid || !Number.isFinite(baseTariff.totalCost) ||
        !postTariff || !postTariff.isValid || !Number.isFinite(postTariff.totalCost)
      ) {
        return {
          isValid: false,
          savedCost: NaN,
          error: baseTariff?.error || postTariff?.error || 'Tariff calculation failed while evaluating recommendation savings'
        };
      }
      return {
        isValid: true,
        savedCost: Math.max(0, baseTariff.totalCost - postTariff.totalCost)
      };
    } catch (err) {
      return {
        isValid: false,
        savedCost: NaN,
        error: err?.message || 'Unexpected error during tariff savings calculation'
      };
    }
  },

  /**
   * Calculates monthly kWh reduction when reducing daily operating hours,
   * preserving duty cycle, standby draw, active days/week, and split schedules.
   * Fails safely with zero savings if post-change metrics cannot be calculated cleanly.
   * @param {Object} app
   * @param {number} baseMonthlyKwh
   * @param {number} trimHours
   * @returns {{ isValid: boolean, savedKwh: number, error?: string }}
   */
  _computeRuntimeTrimKwh(app, baseMonthlyKwh, trimHours) {
    const rawHours = Number(app?.dailyHours);
    if (!Number.isFinite(rawHours) || rawHours < 0 || rawHours > 24 || !Number.isFinite(baseMonthlyKwh) || baseMonthlyKwh < 0 || !Number.isFinite(trimHours)) {
      return { isValid: false, savedKwh: 0, error: `Invalid runtime parameters for "${app?.name || 'Appliance'}"` };
    }
    if (rawHours === 0 || baseMonthlyKwh === 0 || trimHours <= 0) {
      return { isValid: true, savedKwh: 0 };
    }

    const curHours = rawHours;
    const actualTrim = Math.min(curHours, trimHours);
    const targetHours = Math.max(0, Math.min(24, curHours - actualTrim));

    const candidate = {
      ...app,
      dailyHours: targetHours,
      ...WattWatchCalculations.scaleApplianceForTargetHours(app, targetHours, true)
    };

    const baseMetrics = (app.metrics && app.metrics.isValid && Number.isFinite(app.metrics.monthlyKwh))
      ? app.metrics
      : WattWatchCalculations.calculateApplianceMetrics(app);
    const postMetrics = WattWatchCalculations.calculateApplianceMetrics(candidate);

    if (
      !baseMetrics || !baseMetrics.isValid || !Number.isFinite(baseMetrics.monthlyKwh) ||
      !postMetrics || !postMetrics.isValid || !Number.isFinite(postMetrics.monthlyKwh)
    ) {
      return {
        isValid: false,
        savedKwh: 0,
        error: `Unable to compute accurate post-change runtime metrics for "${app?.name || 'Appliance'}"`
      };
    }

    const reliableBaseline = baseMetrics.monthlyKwh;
    const saved = Math.min(reliableBaseline, Math.max(0, reliableBaseline - postMetrics.monthlyKwh));
    return { isValid: true, savedKwh: saved };
  },

  /**
   * Evaluates active appliances and returns prioritized, reconciled energy-saving tips.
   * Individual standalone estimates are preserved separately, while tip display metrics
   * (`savedKwhMonthly`, `savedCostMonthly`, `annualSavingsCost`) equal reconciled household shares
   * so recommendation cards never imply savings exceeding combined household potential.
   * @param {Array} appliances - Appliance inventory array
   * @param {number|Object} rateOrSettings - Electricity tariff rate or settings object
   * @returns {Object}
   */
  generateRecommendations(appliances = [], rateOrSettings) {
    const prep = this._validateAndSummarize(appliances, rateOrSettings);
    if (!prep.isValid) {
      return this._invalidRecommendationsResult(prep.error, prep.tariffMode || 'flat');
    }

    const { settings, tariffMode } = prep;
    if (prep.isEmpty) {
      return this._emptyRecommendationsResult(tariffMode);
    }

    const enrichedList = prep.appliances;
    const totalMonthlyKwh = prep.totalMonthlyKwh;
    if (totalMonthlyKwh <= 0) {
      return this._emptyRecommendationsResult(tariffMode);
    }

    const candidateTips = [];
    const calculationIssues = [];
    let hasFatalCalculationIssue = false;

    for (const app of enrichedList) {
      const share = Number(app.sharePercentage) || 0;
      const power = Number(app.powerWatts) || 0;
      const hours = Number(app.dailyHours) || 0;
      const days = Number(app.operatingDays) || 0;
      const qty = Number(app.quantity) || 1;
      const appMonthlyKwh = Number(app.monthlyKwh) || 0;
      const appName = String(app.name || 'Appliance');

      const standbyInfo = this._normalizeStandbyWatts(app.standbyWatts);
      if (!standbyInfo.isValid) {
        calculationIssues.push(`Malformed standby wattage on "${appName}" — standby optimization skipped cleanly.`);
      }

      if (appMonthlyKwh <= 0 || power <= 0 || qty <= 0 || days <= 0 || hours <= 0) {
        continue;
      }

      const pushCandidate = (tipSpec) => {
        const marginalRes = this._computeMarginalSavings(totalMonthlyKwh, tipSpec.savedKwh, settings);
        if (!marginalRes.isValid) {
          return { fatalError: marginalRes.error };
        }
        const indCost = marginalRes.savedCost;
        candidateTips.push({
          ...tipSpec,
          individualSavedKwhMonthly: tipSpec.savedKwh,
          individualSavedCostMonthly: indCost,
          individualAnnualSavingsCost: indCost * 12,
          combinedContributionKwh: tipSpec.savedKwh,
          combinedContributionCost: indCost,
          combinedAnnualSavingsCost: indCost * 12,
          savedKwhMonthly: tipSpec.savedKwh,
          savedCostMonthly: indCost,
          annualSavingsCost: indCost * 12,
          isEstimated: true
        });
        return { fatalError: null };
      };

      // RULE 1: High Share Dominance (>= 22% of total household consumption)
      if (share >= 22 && totalMonthlyKwh > 50 && hours >= 0.5) {
        const reducedHours = Math.min(hours, Math.min(1.5, Math.max(0.5, hours * 0.2)));
        const trimRes = this._computeRuntimeTrimKwh(app, appMonthlyKwh, reducedHours);
        if (!trimRes.isValid) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(trimRes.error);
        } else if (trimRes.savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_dom_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'runtime',
            applyOrder: 2,
            impactLevel: 'High Impact',
            impactClass: 'badge-burgundy',
            reason: `Accounts for ${share.toFixed(1)}% of your entire monthly electricity consumption.`,
            suggestedAction: `Moderate daily operating duration by ${reducedHours.toFixed(1)} hours or adopt eco-mode settings.`,
            savedKwh: trimRes.savedKwh
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 2: Extended High-Draw Operating Hours (>= 600W running > 4 hours/day)
      if (power >= 600 && hours > 4) {
        const targetReductionHours = Math.min(hours, 1.0);
        const trimRes = this._computeRuntimeTrimKwh(app, appMonthlyKwh, targetReductionHours);
        if (!trimRes.isValid) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(trimRes.error);
        } else if (trimRes.savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_highrun_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'runtime',
            applyOrder: 2,
            impactLevel: 'High Impact',
            impactClass: 'badge-burgundy',
            reason: `High power draw (${power}W) operating for an extensive ${hours} hours per day.`,
            suggestedAction: `Utilize a programmable timer or thermostat shut-off to trim daily active usage by 1 hour.`,
            savedKwh: trimRes.savedKwh
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 3: Cooling Efficiency & Temperature Management
      if (app.category === 'Cooling' && power >= 800) {
        const estimatedEcoSavingsRatio = 0.12;
        const activeKwh = (app.metrics && Number.isFinite(app.metrics.activeMonthlyKwh)) ? app.metrics.activeMonthlyKwh : appMonthlyKwh;
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, activeKwh * estimatedEcoSavingsRatio));
        if (savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_cooling_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'cooling_duty',
            applyOrder: 3,
            impactLevel: 'Moderate Impact',
            impactClass: 'badge-gold',
            reason: `Compressor operates at high thermal load during cooling cycles.`,
            suggestedAction: `Set baseline thermostat to 24°C and supplement with ceiling airflow to cut compressor duty by ~12%.`,
            savedKwh,
            isHeuristicEstimate: true
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 4: Water Heating Overheating Prevention (Geysers running > 1.2 hours)
      if (app.category === 'Other' && (appName.toLowerCase().includes('geyser') || appName.toLowerCase().includes('heater') || power >= 1500) && hours > 1.2) {
        const trimHours = Math.min(hours, Math.max(0.5, hours - 0.75));
        const trimRes = this._computeRuntimeTrimKwh(app, appMonthlyKwh, trimHours);
        if (!trimRes.isValid) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(trimRes.error);
        } else if (trimRes.savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_water_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'runtime',
            applyOrder: 2,
            impactLevel: 'High Impact',
            impactClass: 'badge-burgundy',
            reason: `Water heaters continuously cycle elements when kept powered beyond heating requirements.`,
            suggestedAction: `Power on 20-30 minutes prior to bathing rather than prolonged continuous standby.`,
            savedKwh: trimRes.savedKwh
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 5: High-Wattage Lighting Replacement Candidate (using full post-change appliance metrics)
      if (app.category === 'Lighting' && power > 20) {
        const targetWatts = 9;
        const postLedMetrics = WattWatchCalculations.calculateApplianceMetrics({
          ...app,
          powerWatts: targetWatts
        });
        if (!postLedMetrics || !postLedMetrics.isValid || !Number.isFinite(postLedMetrics.monthlyKwh)) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(`Unable to calculate accurate LED retrofit metrics for "${appName}"`);
        } else {
          const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh - postLedMetrics.monthlyKwh));
          if (savedKwh > 0) {
            const pushed = pushCandidate({
              id: `tip_lighting_${app.id}`,
              applianceId: app.id,
              applianceName: appName,
              category: app.category,
              actionGroup: 'hardware_led',
              applyOrder: 1,
              impactLevel: 'Moderate Impact',
              impactClass: 'badge-gold',
              reason: `Installed fixtures draw ${power}W per unit, exceeding modern solid-state LED standards (9W-12W).`,
              suggestedAction: `Retrofit fixtures with 9W warm architectural LED bulbs yielding equivalent lumens.`,
              savedKwh
            });
            if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
          }
        }
      }

      // RULE 6: Entertainment & Computing Phantom Standby Load
      // Uses normalized standbyWatts: explicit 0 or "0" never triggers; malformed or failed specified standby never falls back to 8%.
      const triggersStandbyTip = standbyInfo.isValid && !standbyInfo.isExplicitZero && hours >= 4 && (
        (standbyInfo.isSpecified && standbyInfo.watts > 0) ||
        (!standbyInfo.isSpecified && (app.category === 'Entertainment' || app.category === 'Computing'))
      );
      if (triggersStandbyTip) {
        let rawSavedKwh = 0;
        let usedHeuristicFallback = false;
        let standbyCalcFailed = false;
        if (standbyInfo.isSpecified) {
          if (app.metrics && Number.isFinite(app.metrics.standbyMonthlyKwh) && app.metrics.standbyMonthlyKwh > 0) {
            rawSavedKwh = app.metrics.standbyMonthlyKwh;
          } else if (standbyInfo.watts > 0) {
            const sbMetrics = WattWatchCalculations.calculateApplianceMetrics({ ...app, standbyWatts: standbyInfo.watts });
            if (sbMetrics && sbMetrics.isValid && Number.isFinite(sbMetrics.standbyMonthlyKwh)) {
              rawSavedKwh = sbMetrics.standbyMonthlyKwh;
            } else {
              standbyCalcFailed = true;
              calculationIssues.push(`Unable to calculate accurate standby savings metrics for "${appName}"`);
            }
          }
        } else {
          rawSavedKwh = appMonthlyKwh * 0.08;
          usedHeuristicFallback = true;
        }
        const savedKwh = standbyCalcFailed ? 0 : Math.min(appMonthlyKwh, Math.max(0, rawSavedKwh));
        if (savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_phantom_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'standby',
            applyOrder: 4,
            impactLevel: 'Optimization',
            impactClass: 'badge-blue',
            reason: `Audio-visual components and display clusters maintain continuous standby current when turned off.`,
            suggestedAction: `Connect peripheral clusters to a switched master strip to eliminate parasitic standby draw.`,
            savedKwh,
            isHeuristicEstimate: usedHeuristicFallback
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 7: Continuous Refrigeration & Thermal Calibration
      const isRefrig = appName.toLowerCase().includes('fridge') || appName.toLowerCase().includes('refrigerator');
      if (isRefrig || ((app.category === 'Cooling' || app.category === 'Kitchen') && hours >= 20 && power >= 120)) {
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * 0.08));
        if (savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_refrig_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'refrigeration',
            applyOrder: 3,
            impactLevel: 'Moderate Impact',
            impactClass: 'badge-gold',
            reason: `Operates continuously throughout the day with recurring compressor thermal cycles.`,
            suggestedAction: `Maintain 3°C to 4°C fresh compartment temperature and ensure door seals are airtight to prevent thermal leak.`,
            savedKwh,
            isHeuristicEstimate: true
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }

      // RULE 8: Heavy Kitchen Thermal Optimization
      if (app.category === 'Kitchen' && power >= 1200 && hours > 1) {
        const savedKwh = Math.min(appMonthlyKwh, Math.max(0, appMonthlyKwh * 0.10));
        if (savedKwh > 0) {
          const pushed = pushCandidate({
            id: `tip_kitchen_${app.id}`,
            applianceId: app.id,
            applianceName: appName,
            category: app.category,
            actionGroup: 'kitchen_thermal',
            applyOrder: 3,
            impactLevel: 'Thermal Efficiency',
            impactClass: 'badge-burgundy',
            reason: `High heating wattage (${power}W) generates significant continuous thermal load.`,
            suggestedAction: `Use matching flat-bottom induction cookware with lids on to maximize direct thermal transfer and cut cook duration.`,
            savedKwh,
            isHeuristicEstimate: true
          });
          if (pushed.fatalError) return this._invalidRecommendationsResult(pushed.fatalError, tariffMode);
        }
      }
    }

    if (candidateTips.length === 0 && hasFatalCalculationIssue && calculationIssues.length > 0) {
      return this._invalidRecommendationsResult(calculationIssues[0], tariffMode);
    }

    // Sort candidate tips BEFORE deduplicating so stronger same-group rules (e.g. Rule 4 Geyser vs Rule 2) always win
    candidateTips.sort((a, b) =>
      (b.individualSavedKwhMonthly - a.individualSavedKwhMonthly) ||
      (b.individualSavedCostMonthly - a.individualSavedCostMonthly)
    );

    // Deduplicate same-appliance same-actionGroup rules
    const uniqueTips = [];
    const seenKeys = new Set();
    candidateTips.forEach(t => {
      const key = `${t.applianceId}_${t.actionGroup || t.impactLevel}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        delete t.savedKwh;
        uniqueTips.push(t);
      }
    });

    // Step 1: Reconcile overlapping optimizations per appliance (multiplicative residual compounding)
    const appBaselineMap = new Map();
    enrichedList.forEach(a => appBaselineMap.set(a.id, Number(a.monthlyKwh) || 0));

    const tipsByApp = new Map();
    uniqueTips.forEach(t => {
      if (!tipsByApp.has(t.applianceId)) tipsByApp.set(t.applianceId, []);
      tipsByApp.get(t.applianceId).push(t);
    });

    let combinedSavingsKwhRaw = 0;
    tipsByApp.forEach((appTips, appId) => {
      const baseKwh = Math.max(0, appBaselineMap.get(appId) || 0);
      if (baseKwh <= 0) {
        appTips.forEach(t => {
          t.combinedContributionKwh = 0;
          t.hasApplianceOverlap = false;
        });
        return;
      }

      const ordered = [...appTips].sort((a, b) => (a.applyOrder || 9) - (b.applyOrder || 9));
      let remainingKwh = baseKwh;
      const isOverlapping = ordered.length > 1;

      ordered.forEach(t => {
        const frac = Math.min(1, Math.max(0, t.individualSavedKwhMonthly / baseKwh));
        const contrib = Math.min(remainingKwh, remainingKwh * frac);
        t.combinedContributionKwh = contrib;
        t.hasApplianceOverlap = isOverlapping;
        remainingKwh = Math.max(0, remainingKwh - contrib);
      });

      combinedSavingsKwhRaw += Math.min(baseKwh, baseKwh - remainingKwh);
    });

    const totalPotentialSavingsKwh = Math.min(totalMonthlyKwh, Math.max(0, combinedSavingsKwhRaw));

    // Step 2: Reconcile monetary contributions sequentially across the household bill curve
    // Walking from largest tip first guarantees topTip matches standalone marginal tariff test and
    // exact telescoping sum: sum(t.combinedContributionCost) === totalPotentialSavingsCost.
    const sequentialOrder = [...uniqueTips].sort((a, b) =>
      (b.combinedContributionKwh - a.combinedContributionKwh) ||
      ((a.applyOrder || 9) - (b.applyOrder || 9)) ||
      (b.individualSavedCostMonthly - a.individualSavedCostMonthly)
    );

    let runningKwh = totalMonthlyKwh;
    for (const tip of sequentialOrder) {
      const contribKwh = Math.min(runningKwh, Math.max(0, tip.combinedContributionKwh));
      const stepCostRes = this._computeMarginalSavings(runningKwh, contribKwh, settings);
      if (!stepCostRes.isValid) {
        return this._invalidRecommendationsResult(stepCostRes.error, tariffMode);
      }
      const reconciledCost = stepCostRes.savedCost;
      tip.combinedContributionKwh = contribKwh;
      tip.combinedContributionCost = reconciledCost;
      tip.combinedAnnualSavingsCost = reconciledCost * 12;

      // Update primary display fields to reconciled household shares while preserving standalone metrics separately
      tip.savedKwhMonthly = contribKwh;
      tip.savedCostMonthly = reconciledCost;
      tip.annualSavingsCost = reconciledCost * 12;
      tip.hasReconciledAdjustment = Boolean(
        tip.hasApplianceOverlap ||
        Math.abs(tip.individualSavedKwhMonthly - contribKwh) > 0.01 ||
        Math.abs(tip.individualSavedCostMonthly - reconciledCost) > 0.01
      );

      runningKwh = Math.max(0, runningKwh - contribKwh);
    }

    const totalCostRes = this._computeMarginalSavings(totalMonthlyKwh, totalPotentialSavingsKwh, settings);
    if (!totalCostRes.isValid) {
      return this._invalidRecommendationsResult(totalCostRes.error, tariffMode);
    }

    const totalPotentialSavingsCost = totalCostRes.savedCost;
    const individualSumSavingsKwh = uniqueTips.reduce((sum, item) => sum + item.individualSavedKwhMonthly, 0);
    const individualSumSavingsCost = uniqueTips.reduce((sum, item) => sum + item.individualSavedCostMonthly, 0);

    // Final deterministic display sort by reconciled monetary savings DESC, then energy conservation DESC
    uniqueTips.sort((a, b) => (b.savedCostMonthly - a.savedCostMonthly) || (b.savedKwhMonthly - a.savedKwhMonthly));

    const overlapAdjustmentKwh = Math.max(0, individualSumSavingsKwh - totalPotentialSavingsKwh);
    const overlapAdjustmentCost = Math.max(0, individualSumSavingsCost - totalPotentialSavingsCost);
    const hasOverlappingRecommendations = overlapAdjustmentKwh > 0.01 || overlapAdjustmentCost > 0.01;

    return {
      isValid: true,
      tips: uniqueTips,
      totalPotentialSavingsKwh,
      totalPotentialSavingsCost,
      individualSumSavingsKwh,
      individualSumSavingsCost,
      hasOverlappingRecommendations,
      overlapAdjustmentKwh,
      overlapAdjustmentCost,
      annualSavingsCost: totalPotentialSavingsCost * 12,
      calculationIssues,
      warnings: calculationIssues,
      hasCalculationIssues: calculationIssues.length > 0,
      ...(calculationIssues.length > 0 ? { error: calculationIssues.join('; ') } : {}),
      tariffMode,
      isEstimated: true,
      accuracyDisclaimer: 'All recommendations are calculated estimates based on configured equipment ratings and operating schedules, not guaranteed utility reductions.'
    };
  },

  /**
   * Identifies top-consuming appliances and generates actionable what-if simulation scenarios
   * with precise monthly and annual energy & rupee savings calculations matching Simulator results.
   * Rejects invalid appliance inventories or failed tariff calculations explicitly.
   * @param {Array} appliances
   * @param {number|Object} rateOrSettings
   * @returns {Object}
   */
  generateWhatIfScenarios(appliances = [], rateOrSettings) {
    const prep = this._validateAndSummarize(appliances, rateOrSettings);
    if (!prep.isValid) {
      return this._invalidWhatIfResult(prep.error);
    }

    if (prep.isEmpty) {
      return this._emptyWhatIfResult();
    }

    const { settings } = prep;
    const enriched = [...prep.appliances];
    const totalMonthlyKwh = prep.totalMonthlyKwh;
    if (totalMonthlyKwh <= 0) {
      return this._emptyWhatIfResult();
    }

    enriched.sort((a, b) => (b.monthlyKwh || 0) - (a.monthlyKwh || 0));

    const scenarios = [];
    const calculationIssues = [];
    let hasFatalCalculationIssue = false;
    const topConsumers = enriched.slice(0, 4);

    for (let rankIdx = 0; rankIdx < topConsumers.length; rankIdx++) {
      const app = topConsumers[rankIdx];
      const curKwh = Number(app.monthlyKwh) || 0;
      const curHours = Math.min(24, Math.max(0, Number(app.dailyHours) || 0));
      const power = Number(app.powerWatts) || 0;
      const days = Math.min(31, Math.max(0, Number(app.operatingDays) || 0));
      const qty = Math.max(1, Number(app.quantity) || 1);
      const appName = String(app.name || 'Appliance');

      const standbyInfo = this._normalizeStandbyWatts(app.standbyWatts);
      if (!standbyInfo.isValid) {
        calculationIssues.push(`Malformed standby wattage on "${appName}" — standby scenario skipped cleanly.`);
      }

      if (curKwh <= 0 || power <= 0 || days <= 0 || qty <= 0) continue;

      // Scenario 1: Runtime Reduction (-1 hr/day, or -0.5 hr if hours <= 2)
      if (curHours >= 1.0) {
        const rawTrim = curHours > 2.0 ? 1.0 : 0.5;
        const trimHours = Math.min(curHours, rawTrim);
        const targetHours = Math.max(0, Math.min(24, Number((curHours - trimHours).toFixed(2))));
        const trimRes = this._computeRuntimeTrimKwh(app, curKwh, trimHours);

        if (!trimRes.isValid) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(trimRes.error);
        } else if (trimRes.savedKwh > 0.5 && targetHours < curHours) {
          const costRes = this._computeMarginalSavings(totalMonthlyKwh, trimRes.savedKwh, settings);
          if (!costRes.isValid) return this._invalidWhatIfResult(costRes.error, calculationIssues);
          const pctReduction = Math.min(100, Math.max(0, (trimRes.savedKwh / curKwh) * 100));
          scenarios.push({
            id: `whatif_runtime_${app.id}`,
            scenarioType: 'runtime',
            applianceId: app.id,
            applianceName: appName,
            rank: rankIdx + 1,
            category: app.category,
            title: `Trim ${appName} by ${trimHours} hr/day`,
            badge: 'Runtime Reduction',
            badgeClass: 'badge-burgundy',
            description: `Operating for ${targetHours}h instead of ${curHours}h daily reduces consumption while maintaining regular household convenience.`,
            baselineWatts: power,
            baselineHours: curHours,
            baselineDays: days,
            baselineQty: qty,
            currentMonthlyKwh: curKwh,
            savedKwhMonthly: trimRes.savedKwh,
            percentReduction: pctReduction,
            savedCostMonthly: costRes.savedCost,
            annualSavingsCost: costRes.savedCost * 12,
            targetWatts: power,
            targetHours: targetHours,
            targetDays: days,
            targetQty: qty,
            targetDutyCyclePercent: app.dutyCyclePercent,
            targetStandbyWatts: app.standbyWatts,
            targetActiveDaysPerWeek: app.activeDaysPerWeek,
            preserveSplitHours: true,
            isEstimated: true
          });
        }
      }

      // Scenario 2: Temperature / Duty Optimization (for Cooling / AC) - strict post-change metrics
      if (app.category === 'Cooling' && power >= 750 && curHours > 0) {
        const targetWatts = Math.max(1, Math.round(power * 0.85));
        const postMetrics = WattWatchCalculations.calculateApplianceMetrics({
          ...app,
          powerWatts: targetWatts
        });
        if (!postMetrics || !postMetrics.isValid || !Number.isFinite(postMetrics.monthlyKwh)) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(`Unable to calculate accurate Cooling Eco post-change metrics for "${appName}"`);
        } else {
          const savedKwh = Math.min(curKwh, Math.max(0, curKwh - postMetrics.monthlyKwh));
          if (savedKwh > 0.5) {
            const costRes = this._computeMarginalSavings(totalMonthlyKwh, savedKwh, settings);
            if (!costRes.isValid) return this._invalidWhatIfResult(costRes.error, calculationIssues);
            const pctReduction = Math.min(100, Math.max(0, (savedKwh / curKwh) * 100));
            scenarios.push({
              id: `whatif_eco_${app.id}`,
              scenarioType: 'eco_cooling',
              applianceId: app.id,
              applianceName: appName,
              rank: rankIdx + 1,
              category: app.category,
              title: `Set ${appName} to 24°C Eco Thermostat`,
              badge: 'Thermal Optimization',
              badgeClass: 'badge-gold',
              description: `BEE benchmarks show each degree above 20°C saves ~6% compressor electricity. Setting 24°C cuts thermal load by ~${pctReduction.toFixed(0)}%.`,
              baselineWatts: power,
              baselineHours: curHours,
              baselineDays: days,
              baselineQty: qty,
              currentMonthlyKwh: curKwh,
              savedKwhMonthly: savedKwh,
              percentReduction: pctReduction,
              savedCostMonthly: costRes.savedCost,
              annualSavingsCost: costRes.savedCost * 12,
              targetWatts: targetWatts,
              targetHours: curHours,
              targetDays: days,
              targetQty: qty,
              targetDutyCyclePercent: app.dutyCyclePercent,
              targetStandbyWatts: app.standbyWatts,
              targetActiveDaysPerWeek: app.activeDaysPerWeek,
              preserveSplitHours: true,
              isEstimated: true,
              isHeuristicEstimate: true
            });
          }
        }
      }

      // Scenario 3: Phantom Standby Elimination
      // Explicit 0 or "0" never triggers; malformed standby values safely skipped without 12W fallback.
      const triggersStandbyScenario = standbyInfo.isValid && !standbyInfo.isExplicitZero && curKwh > 10 && (
        (standbyInfo.isSpecified && standbyInfo.watts > 0) ||
        (!standbyInfo.isSpecified && (app.category === 'Entertainment' || app.category === 'Computing'))
      );
      if (triggersStandbyScenario) {
        const standbyW = standbyInfo.isSpecified ? standbyInfo.watts : 12;
        const standbyProbe = WattWatchCalculations.calculateApplianceMetrics({
          ...app,
          standbyWatts: standbyW
        });
        if (!standbyProbe || !standbyProbe.isValid || !Number.isFinite(standbyProbe.standbyMonthlyKwh)) {
          calculationIssues.push(`Unable to calculate accurate standby metrics for "${appName}"`);
        } else {
          const savedKwh = Math.min(curKwh, Math.max(0, standbyProbe.standbyMonthlyKwh));
          if (savedKwh > 0.5) {
            const costRes = this._computeMarginalSavings(totalMonthlyKwh, savedKwh, settings);
            if (!costRes.isValid) return this._invalidWhatIfResult(costRes.error, calculationIssues);
            const pctReduction = Math.min(100, Math.max(0, (savedKwh / curKwh) * 100));
            scenarios.push({
              id: `whatif_standby_${app.id}`,
              scenarioType: 'standby',
              applianceId: app.id,
              applianceName: appName,
              rank: rankIdx + 1,
              category: app.category,
              title: `Eliminate Standby Phantom Draw on ${appName}`,
              badge: 'Zero Phantom Load',
              badgeClass: 'badge-blue',
              description: `Powering down from the wall socket or using a smart strip cuts continuous ~${standbyW}W parasitic standby draw during idle hours.`,
              baselineWatts: power,
              baselineHours: curHours,
              baselineDays: days,
              baselineQty: qty,
              baseStandbyWatts: standbyInfo.isSpecified ? undefined : standbyW,
              currentMonthlyKwh: curKwh,
              savedKwhMonthly: savedKwh,
              percentReduction: pctReduction,
              savedCostMonthly: costRes.savedCost,
              annualSavingsCost: costRes.savedCost * 12,
              targetWatts: power,
              targetHours: curHours,
              targetDays: days,
              targetQty: qty,
              targetDutyCyclePercent: app.dutyCyclePercent,
              targetStandbyWatts: 0,
              targetActiveDaysPerWeek: app.activeDaysPerWeek,
              preserveSplitHours: true,
              isEstimated: true,
              isHeuristicEstimate: !standbyInfo.isSpecified
            });
          }
        }
      }

      // Scenario 4: High Wattage Lighting Modernization - strict post-change metrics & energy-based percentReduction
      if (app.category === 'Lighting' && power >= 25 && curHours > 0) {
        const targetWatts = 9;
        const postMetrics = WattWatchCalculations.calculateApplianceMetrics({
          ...app,
          powerWatts: targetWatts
        });
        if (!postMetrics || !postMetrics.isValid || !Number.isFinite(postMetrics.monthlyKwh)) {
          hasFatalCalculationIssue = true;
          calculationIssues.push(`Unable to calculate accurate LED retrofit post-change metrics for "${appName}"`);
        } else {
          const savedKwh = Math.min(curKwh, Math.max(0, curKwh - postMetrics.monthlyKwh));
          if (savedKwh > 0.1) {
            const costRes = this._computeMarginalSavings(totalMonthlyKwh, savedKwh, settings);
            if (!costRes.isValid) return this._invalidWhatIfResult(costRes.error, calculationIssues);
            const wattageReductionPercent = power > 0 ? Math.min(100, Math.max(0, ((power - targetWatts) / power) * 100)) : 0;
            const pctReduction = curKwh > 0 ? Math.min(100, Math.max(0, (savedKwh / curKwh) * 100)) : 0;
            scenarios.push({
              id: `whatif_led_${app.id}`,
              scenarioType: 'led',
              applianceId: app.id,
              applianceName: appName,
              rank: rankIdx + 1,
              category: app.category,
              title: `Retrofit ${appName} with 9W High-Efficiency LED`,
              badge: 'Hardware Modernization',
              badgeClass: 'badge-cooling',
              description: `Replace legacy fixtures with modern 9W architectural LEDs (~${wattageReductionPercent.toFixed(0)}% lower active wattage, ${pctReduction.toFixed(0)}% total monthly energy reduction).`,
              baselineWatts: power,
              baselineHours: curHours,
              baselineDays: days,
              baselineQty: qty,
              currentMonthlyKwh: curKwh,
              savedKwhMonthly: savedKwh,
              percentReduction: pctReduction,
              wattageReductionPercent,
              savedCostMonthly: costRes.savedCost,
              annualSavingsCost: costRes.savedCost * 12,
              targetWatts: targetWatts,
              targetHours: curHours,
              targetDays: days,
              targetQty: qty,
              targetDutyCyclePercent: app.dutyCyclePercent,
              targetStandbyWatts: app.standbyWatts,
              targetActiveDaysPerWeek: app.activeDaysPerWeek,
              preserveSplitHours: true,
              isEstimated: true
            });
          }
        }
      }
    }

    if (scenarios.length === 0 && hasFatalCalculationIssue && calculationIssues.length > 0) {
      return this._invalidWhatIfResult(calculationIssues[0], calculationIssues);
    }

    scenarios.sort((a, b) => (b.savedCostMonthly - a.savedCostMonthly) || (b.savedKwhMonthly - a.savedKwhMonthly));

    return {
      isValid: true,
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
      calculationIssues,
      warnings: calculationIssues,
      hasCalculationIssues: calculationIssues.length > 0,
      ...(calculationIssues.length > 0 ? { error: calculationIssues.join('; ') } : {}),
      isEstimated: true,
      accuracyDisclaimer: 'Calculated estimates based on active household tariff structure.'
    };
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchRecommendations = WattWatchRecommendations;
}
