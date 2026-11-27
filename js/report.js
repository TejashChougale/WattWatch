/**
 * WATTWATCH - PDF Monthly Report Generator Module
 * Generates an executive, print-perfect energy intelligence report
 * complete with logo, billing period, appliance matrix, budget status, and disclaimers.
 */

const WattWatchReport = {
  _eventsBound: false,
  previousActiveElement: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Report trigger buttons
    const btnNavReport = document.getElementById('btnOpenReportModal');
    if (btnNavReport) {
      btnNavReport.addEventListener('click', () => this.openReportModal());
    }

    const btnPeriodChange = document.getElementById('reportPeriodSelect');
    if (btnPeriodChange) {
      btnPeriodChange.addEventListener('change', () => this.updateReportPreview());
    }

    const btnPrint = document.getElementById('btnExecutePrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => this.printReport());
    }
  },

  _parseStrictNonNegNum(val) {
    if (val === null || val === undefined || typeof val === 'boolean' || typeof val === 'object') return null;
    if (typeof val === 'number') {
      return (!Number.isNaN(val) && Number.isFinite(val) && val >= 0) ? val : null;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) && num >= 0 ? num : null;
    }
    return null;
  },

  _parseStrictNonNegInt(val, min = 0) {
    const num = this._parseStrictNonNegNum(val);
    if (num === null || !Number.isInteger(num) || num < min) return null;
    return num;
  },

  _resolveValidatedCurrency(raw) {
    if (typeof WattWatchStorage === 'undefined' || typeof WattWatchStorage.validateCurrency !== 'function') {
      return null;
    }
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const val = WattWatchStorage.validateCurrency(raw);
    return (val && val.valid && typeof val.sanitized === 'string' && val.sanitized.trim())
      ? val.sanitized
      : null;
  },

  /**
   * Resolves historical snapshot currency strictly from snapshot metadata:
   * checks valid snap.tariffSettings.currency first, then valid top-level snap.currency.
   * An invalid nested value does not block a valid top-level currency.
   * @private
   */
  _resolveSnapshotCurrency(snap) {
    if (!snap || typeof snap !== 'object') return null;
    const ts = (snap.tariffSettings && typeof snap.tariffSettings === 'object' && !Array.isArray(snap.tariffSettings))
      ? snap.tariffSettings
      : null;
    if (ts) {
      const nestedCurr = this._resolveValidatedCurrency(ts.currency);
      if (nestedCurr) return nestedCurr;
    }
    return this._resolveValidatedCurrency(snap.currency);
  },

  /**
   * Formats a report monetary amount cleanly without leaking current user currency onto
   * legacy snapshots lacking recorded currency metadata.
   * @private
   */
  _formatReportMoney(val, reportData) {
    const num = this._parseStrictNonNegNum(val);
    if (num === null) return '--';
    if (reportData && reportData.isLegacyCurrency) {
      return WattWatchCalculations.formatNumber(num, 2);
    }
    const validCurr = this._resolveValidatedCurrency(reportData && reportData.currency);
    if (!validCurr) {
      return WattWatchCalculations.formatNumber(num, 2);
    }
    return WattWatchCalculations.formatCurrency(num, validCurr);
  },

  /**
   * Opens the Report Configuration Modal
   */
  openReportModal() {
    const select = document.getElementById('reportPeriodSelect');
    if (!select) return;

    const history = WattWatchStorage.getHistory();
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()} (Current Live Estimate)`;

    select.innerHTML = `<option value="current">${currentLabel}</option>`;

    history.forEach(rec => {
      const opt = document.createElement('option');
      opt.value = rec.id;
      const snapCurr = this._resolveSnapshotCurrency(rec);
      const costNum = this._parseStrictNonNegNum(rec?.totalCost);
      const costText = costNum === null
        ? '--'
        : (snapCurr
            ? WattWatchCalculations.formatCurrency(costNum, snapCurr)
            : `${WattWatchCalculations.formatNumber(costNum, 2)} [Legacy · Currency unrecorded]`);
      opt.textContent = `${rec.periodLabel || rec.period} (Historical Snapshot - ${costText})`;
      select.appendChild(opt);
    });

    this.updateReportPreview();

    const modal = document.getElementById('reportModal');
    if (modal) {
      this.previousActiveElement = document.activeElement;
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.open(modal, this.previousActiveElement);
      } else {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      }
    }
  },

  closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
      if (typeof WattWatchApp !== 'undefined' && WattWatchApp.modalManager) {
        WattWatchApp.modalManager.close(modal);
      } else {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          try {
            this.previousActiveElement.focus();
          } catch (e) {
            // ignore
          }
        }
      }
    }
  },

  /**
   * Builds the preview content inside the modal container
   */
  updateReportPreview() {
    const select = document.getElementById('reportPeriodSelect');
    const container = document.getElementById('reportPreviewArea');
    if (!select || !container) return;

    const selectedVal = select.value;
    const settings = WattWatchStorage.getSettings();
    const btnPrint = document.getElementById('btnExecutePrintReport');
    let reportData = null;
    let summary = null;

    if (selectedVal === 'current') {
      const appliances = WattWatchStorage.getAppliances();
      summary = WattWatchCalculations.calculateHouseholdSummary(appliances, settings);
      const tariff = summary.advancedTariff || WattWatchCalculations.calculateAdvancedTariff(summary.totalMonthlyKwh, settings);

      if (!summary.isValid || !tariff.isValid) {
        if (btnPrint) btnPrint.disabled = true;
        container.innerHTML = `
          <div style="margin: 2rem; padding: 1.5rem; border: 1px solid #A92639; border-radius: 8px; background: rgba(169, 38, 57, 0.08); color: #172B55;">
            <h3 style="color: #A92639; margin-top: 0; font-family: var(--font-heading);">Report Generation Unavailable</h3>
            <p style="margin-bottom: 0; font-size: 0.95rem;">Current household inventory contains invalid numeric entries or invalid tariff configuration. Please correct invalid appliance parameters or tariff settings to generate an official energy audit report.</p>
          </div>
        `;
        return;
      }
      if (btnPrint) btnPrint.disabled = false;

      const now = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      const curCurr = this._resolveValidatedCurrency(settings?.currency);

      reportData = {
        isHistorical: false,
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        periodLabel,
        totalKwh: summary.totalMonthlyKwh,
        totalCost: summary.totalMonthlyCost,
        rate: summary.ratePerKwh,
        effectiveRate: summary.effectiveRatePerKwh,
        tariffModel: settings.tariffModel || 'flat',
        tariffDetails: tariff,
        tariffSettings: settings,
        currency: curCurr,
        isLegacyCurrency: false,
        isRecalculationAvailable: true,
        recalculationNote: 'Live Estimate',
        appliances: summary.appliances,
        appliancesCount: summary.totalAppliancesCount,
        totalUnits: summary.totalUnits,
        generatedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      };
    } else {
      const history = WattWatchStorage.getHistory();
      const snap = history.find(h => h.id === selectedVal);
      if (!snap) return;

      const snapVal = WattWatchStorage.validateSnapshot(snap);
      const validSnapKwh = this._parseStrictNonNegNum(snap.totalKwh);
      const validSnapCost = this._parseStrictNonNegNum(snap.totalCost);
      if (!snapVal.valid || validSnapKwh === null || validSnapCost === null) {
        if (btnPrint) btnPrint.disabled = true;
        container.innerHTML = `
          <div style="margin: 2rem; padding: 1.5rem; border: 1px solid #A92639; border-radius: 8px; background: rgba(169, 38, 57, 0.08); color: #172B55;">
            <h3 style="color: #A92639; margin-top: 0; font-family: var(--font-heading);">Historical Snapshot Corrupted</h3>
            <p style="margin-bottom: 0; font-size: 0.95rem;">Selected historical record failed integrity verification and cannot be formatted into a report.</p>
          </div>
        `;
        return;
      }
      if (btnPrint) btnPrint.disabled = false;

      const snapSettings = (snap.tariffSettings && typeof snap.tariffSettings === 'object' && !Array.isArray(snap.tariffSettings))
        ? { ...snap.tariffSettings }
        : null;
      const snapBreakdown = (snap.tariffBreakdown && typeof snap.tariffBreakdown === 'object' && !Array.isArray(snap.tariffBreakdown))
        ? snap.tariffBreakdown
        : null;

      const firstValidNum = (...vals) => {
        for (const v of vals) {
          const n = this._parseStrictNonNegNum(v);
          if (n !== null) return n;
        }
        return null;
      };
      const snapEffRate = firstValidNum(snap.effectiveRate, snapBreakdown?.effectiveRatePerKwh, snap.electricityRate, snap.flatRate);
      const hasSnapModel = snap.tariffModel !== undefined;
      const isSnapModelValid = snap.tariffModel === 'flat' || snap.tariffModel === 'slab';
      const hasExplicitInvalidSnapModel = hasSnapModel && !isSnapModelValid;
      const hasBreakdownModel = Boolean(snapBreakdown && snapBreakdown.model !== undefined);
      const isBreakdownModelValid = Boolean(snapBreakdown && (snapBreakdown.model === 'flat' || snapBreakdown.model === 'slab'));
      const hasExplicitInvalidBreakdownModel = hasBreakdownModel && !isBreakdownModelValid;

      let resolvedModel = 'flat';
      if (isSnapModelValid) {
        resolvedModel = snap.tariffModel;
      } else if (hasExplicitInvalidSnapModel) {
        resolvedModel = 'invalid';
      } else if (snapSettings) {
        resolvedModel = (snapSettings.tariffModel === 'flat' || snapSettings.tariffModel === 'slab')
          ? snapSettings.tariffModel
          : 'invalid';
      } else if (hasBreakdownModel) {
        resolvedModel = isBreakdownModelValid ? snapBreakdown.model : 'invalid';
      } else {
        // Absent tariffModel on a legacy snapshot defaults to legacy flat inspection only
        resolvedModel = 'flat';
      }

      // Strictly resolve historical currency ONLY from snapshot metadata (valid tariffSettings.currency, then valid snap.currency)
      const snapCurrency = this._resolveSnapshotCurrency(snap);
      const isLegacyCurrency = snapCurrency === null;

      // Strictly validate EVERY historical tariff field before permitting recalculation (never coerce missing/malformed modifiers to 0)
      let snapTariffSettings = null;
      let isRecalculationAvailable = false;
      let recalculationReason = '';

      const validateStoredModifiers = (fixedRaw, taxRaw, freeRaw, creditRaw, aliasRaw, hasCanonicalCredit) => {
        const fixed = this._parseStrictNonNegNum(fixedRaw);
        const tax = this._parseStrictNonNegNum(taxRaw);
        const free = this._parseStrictNonNegNum(freeRaw);
        if (fixed === null) return { valid: false, reason: 'Historical tariff configuration is missing or has an invalid fixed charge modifier.' };
        if (tax === null || tax > 100) return { valid: false, reason: 'Historical tariff configuration is missing or has an invalid tax percentage modifier.' };
        if (free === null) return { valid: false, reason: 'Historical tariff configuration is missing or has an invalid free units modifier.' };

        let credit = null;
        if (hasCanonicalCredit) {
          credit = this._parseStrictNonNegNum(creditRaw);
          if (credit === null) return { valid: false, reason: 'Historical tariff configuration contains a malformed bill credit modifier.' };
          if (aliasRaw !== undefined && this._parseStrictNonNegNum(aliasRaw) === null) {
            return { valid: false, reason: 'Historical tariff configuration contains a malformed legacy subsidy modifier.' };
          }
        } else if (aliasRaw !== undefined) {
          credit = this._parseStrictNonNegNum(aliasRaw);
          if (credit === null) return { valid: false, reason: 'Historical tariff configuration contains a malformed subsidy modifier.' };
        } else {
          return { valid: false, reason: 'Historical tariff configuration is missing the bill credit/subsidy modifier.' };
        }
        return { valid: true, fixedCharges: fixed, additionalTaxPercent: tax, freeUnits: free, billCreditInr: credit };
      };

      if (hasExplicitInvalidSnapModel) {
        recalculationReason = 'Historical snapshot specifies an unsupported or invalid tariff model and cannot be recalculated reliably.';
      } else if (snapSettings) {
        const tsModel = snapSettings.tariffModel;
        if (tsModel !== 'flat' && tsModel !== 'slab') {
          recalculationReason = 'Saved snapshot tariff settings do not specify a valid tariff model.';
        } else if ((snap.tariffModel === 'flat' || snap.tariffModel === 'slab') && snap.tariffModel !== tsModel) {
          recalculationReason = 'Saved snapshot tariff model contradicts stored tariffSettings.';
        } else if (hasExplicitInvalidBreakdownModel) {
          recalculationReason = 'Saved snapshot tariff breakdown specifies an unsupported or invalid tariff model.';
        } else {
          const modVal = validateStoredModifiers(
            snapSettings.fixedCharges,
            snapSettings.additionalTaxPercent,
            snapSettings.freeUnits,
            snapSettings.billCreditInr,
            snapSettings.subsidy,
            snapSettings.billCreditInr !== undefined
          );
          if (!modVal.valid) {
            recalculationReason = modVal.reason;
          } else if (tsModel === 'slab') {
            const slabCheck = (Array.isArray(snapSettings.slabConfig))
              ? WattWatchCalculations.validateSlabConfig(snapSettings.slabConfig, { requireOpenEnded: true })
              : { valid: false };
            const rateFieldOk = (snapSettings.electricityRate === undefined) || (this._parseStrictNonNegNum(snapSettings.electricityRate) !== null);
            if (!slabCheck.valid) {
              recalculationReason = 'Saved snapshot tariff settings are missing a complete progressive slab configuration.';
            } else if (!rateFieldOk) {
              recalculationReason = 'Saved snapshot tariff settings contain an invalid fallback flat rate field.';
            } else {
              const candidate = {
                tariffModel: 'slab',
                slabConfig: slabCheck.sanitized,
                fixedCharges: modVal.fixedCharges,
                additionalTaxPercent: modVal.additionalTaxPercent,
                freeUnits: modVal.freeUnits,
                billCreditInr: modVal.billCreditInr,
                ...(snapSettings.electricityRate !== undefined ? { electricityRate: this._parseStrictNonNegNum(snapSettings.electricityRate) } : {}),
                ...(snapCurrency ? { currency: snapCurrency } : {})
              };
              const probe = WattWatchCalculations.calculateAdvancedTariff(validSnapKwh, candidate);
              if (probe && probe.isValid) {
                snapTariffSettings = candidate;
                isRecalculationAvailable = true;
              } else {
                recalculationReason = probe?.error || 'Stored slab tariff configuration failed validation.';
              }
            }
          } else {
            const flatRateNum = this._parseStrictNonNegNum(snapSettings.electricityRate);
            if (flatRateNum === null) {
              recalculationReason = 'Saved snapshot tariff settings do not include a valid base flat tariff rate.';
            } else {
              const candidate = {
                tariffModel: 'flat',
                electricityRate: flatRateNum,
                fixedCharges: modVal.fixedCharges,
                additionalTaxPercent: modVal.additionalTaxPercent,
                freeUnits: modVal.freeUnits,
                billCreditInr: modVal.billCreditInr,
                ...(snapCurrency ? { currency: snapCurrency } : {})
              };
              const probe = WattWatchCalculations.calculateAdvancedTariff(validSnapKwh, candidate);
              if (probe && probe.isValid) {
                snapTariffSettings = candidate;
                isRecalculationAvailable = true;
              } else {
                recalculationReason = probe?.error || 'Stored flat tariff settings failed validation.';
              }
            }
          }
        }
      } else if (hasExplicitInvalidBreakdownModel) {
        recalculationReason = 'Historical snapshot tariff breakdown specifies an unsupported or invalid tariff model and cannot be recalculated reliably.';
      } else if (resolvedModel === 'slab') {
        recalculationReason = 'Legacy slab snapshot does not contain the original slab tiers or billing modifiers; slab tariffs cannot be reliably recalculated from effective rates.';
      } else {
        // Legacy flat snapshot without tariffSettings: only reconstruct if explicit flatRate AND ALL breakdown modifiers are strictly valid
        const flatBaseNum = this._parseStrictNonNegNum(snap.flatRate);
        if (flatBaseNum !== null && snapBreakdown) {
          const modVal = validateStoredModifiers(
            snapBreakdown.fixedCharge,
            snapBreakdown.taxPercent,
            snapBreakdown.freeUnits,
            snapBreakdown.billCreditInr,
            snapBreakdown.subsidy,
            snapBreakdown.billCreditInr !== undefined
          );
          if (modVal.valid) {
            const candidate = {
              tariffModel: 'flat',
              electricityRate: flatBaseNum,
              fixedCharges: modVal.fixedCharges,
              additionalTaxPercent: modVal.additionalTaxPercent,
              freeUnits: modVal.freeUnits,
              billCreditInr: modVal.billCreditInr,
              ...(snapCurrency ? { currency: snapCurrency } : {})
            };
            const probe = WattWatchCalculations.calculateAdvancedTariff(validSnapKwh, candidate);
            if (probe && probe.isValid) {
              snapTariffSettings = candidate;
              isRecalculationAvailable = true;
            } else {
              recalculationReason = probe?.error || 'Legacy flat tariff breakdown failed validation.';
            }
          } else {
            recalculationReason = modVal.reason;
          }
        } else {
          recalculationReason = 'Legacy snapshot lacks complete tariff configuration and modifier records needed for reliable recalculation.';
        }
      }

      const snapAppliancesList = Array.isArray(snap.appliancesSnapshot) ? snap.appliancesSnapshot : [];
      if (isRecalculationAvailable && snapTariffSettings) {
        summary = WattWatchCalculations.calculateHouseholdSummary(snapAppliancesList, snapTariffSettings);
        if (!summary || !summary.isValid) {
          isRecalculationAvailable = false;
          recalculationReason = summary?.error || 'Historical appliance snapshot could not be recalculated cleanly.';
        }
      }

      if (!isRecalculationAvailable) {
        // Build category energy/stored-cost aggregation strictly from stored snapshot records,
        // tracking missing/invalid energy, cost, and quantity per category without presenting partials as complete.
        const storedCatBreakdown = {};
        const makeCatEntry = (category) => ({
          category,
          itemCount: 0,
          kwh: 0,
          validKwhCount: 0,
          hasInvalidKwh: false,
          cost: NaN,
          hasStoredCost: false,
          validCostCount: 0,
          hasInvalidCost: false,
          count: 0,
          validCountItems: 0,
          hasInvalidCount: false,
          percentage: 0,
          isPercentagePartial: false
        });
        const defaultCats = ['Cooling', 'Lighting', 'Kitchen', 'Entertainment', 'Computing', 'Other'];
        defaultCats.forEach(c => {
          storedCatBreakdown[c] = makeCatEntry(c);
        });
        snapAppliancesList.forEach(app => {
          if (!app || typeof app !== 'object' || Array.isArray(app)) {
            const fallback = storedCatBreakdown.Other || (storedCatBreakdown.Other = makeCatEntry('Other'));
            fallback.itemCount += 1;
            fallback.hasInvalidKwh = true;
            fallback.hasInvalidCost = true;
            fallback.hasInvalidCount = true;
            return;
          }
          const cat = (typeof app.category === 'string' && app.category.trim()) ? app.category.trim() : 'Other';
          if (!storedCatBreakdown[cat]) {
            storedCatBreakdown[cat] = makeCatEntry(cat);
          }
          const entry = storedCatBreakdown[cat];
          entry.itemCount += 1;

          const appKwh = this._parseStrictNonNegNum(app.monthlyKwh);
          if (appKwh !== null) {
            entry.kwh += appKwh;
            entry.validKwhCount += 1;
          } else {
            entry.hasInvalidKwh = true;
          }

          const appCost = this._parseStrictNonNegNum(app.monthlyCost);
          if (appCost !== null) {
            entry.cost = (entry.hasStoredCost ? entry.cost : 0) + appCost;
            entry.hasStoredCost = true;
            entry.validCostCount += 1;
          } else {
            entry.hasInvalidCost = true;
          }

          const qty = this._parseStrictNonNegInt(app.quantity, 0);
          if (qty !== null) {
            entry.count += qty;
            entry.validCountItems += 1;
          } else {
            entry.hasInvalidCount = true;
          }
        });

        const allCats = Object.values(storedCatBreakdown);
        const anyInvalidKwh = allCats.some(c => c.hasInvalidKwh);
        const hasAuthoritativeTotalKwh = validSnapKwh > 0;
        const sumValidCatKwh = allCats.reduce((acc, c) => acc + (c.validKwhCount > 0 ? c.kwh : 0), 0);
        const denomKwh = hasAuthoritativeTotalKwh ? validSnapKwh : sumValidCatKwh;

        allCats.forEach(c => {
          if (c.hasInvalidKwh && c.validKwhCount === 0) {
            c.percentage = NaN;
            c.isPercentagePartial = true;
          } else if (!hasAuthoritativeTotalKwh && anyInvalidKwh) {
            c.percentage = NaN;
            c.isPercentagePartial = true;
          } else if (c.hasInvalidKwh) {
            c.percentage = denomKwh > 0 ? (c.kwh / denomKwh) * 100 : 0;
            c.isPercentagePartial = true;
          } else {
            c.percentage = denomKwh > 0 ? (c.kwh / denomKwh) * 100 : 0;
          }
        });

        summary = {
          isValid: true,
          isStoredFallbackOnly: true,
          categoryBreakdown: storedCatBreakdown
        };
      }

      const displayRate = firstValidNum(snap.flatRate, snapEffRate);
      const validSnapAppCount = snap.appliancesCount !== undefined
        ? this._parseStrictNonNegInt(snap.appliancesCount, 0)
        : snapAppliancesList.length;

      let computedTotalUnits = null;
      if (snap.totalUnits !== undefined) {
        computedTotalUnits = this._parseStrictNonNegInt(snap.totalUnits, 0);
      } else {
        let unitsSum = 0;
        let allQtyValid = true;
        for (const a of snapAppliancesList) {
          const q = this._parseStrictNonNegInt(a?.quantity, 0);
          if (q === null) {
            allQtyValid = false;
            break;
          }
          unitsSum += q;
        }
        computedTotalUnits = allQtyValid ? unitsSum : null;
      }

      reportData = {
        isHistorical: true,
        period: snap.period,
        periodLabel: snap.periodLabel || snap.period,
        totalKwh: validSnapKwh,
        totalCost: validSnapCost,
        rate: displayRate !== null ? displayRate : NaN,
        effectiveRate: snapEffRate !== null ? snapEffRate : NaN,
        tariffModel: resolvedModel,
        tariffDetails: snapBreakdown,
        tariffSettings: snapTariffSettings,
        currency: snapCurrency,
        isLegacyCurrency,
        isRecalculationAvailable,
        recalculationReason,
        appliances: snapAppliancesList,
        appliancesCount: validSnapAppCount,
        totalUnits: computedTotalUnits,
        generatedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      };
    }

    const fmtMoney = (val) => this._formatReportMoney(val, reportData);
    const reportCurrency = reportData.currency;
    const safeCurrSym = reportData.isLegacyCurrency
      ? ''
      : (this._resolveValidatedCurrency(reportCurrency) || '');
    const formatRateUnit = (r) => {
      const rateNum = this._parseStrictNonNegNum(r);
      if (rateNum === null) return 'Unavailable';
      return (reportData.isLegacyCurrency || !safeCurrSym)
        ? `${rateNum.toFixed(2)} / unit`
        : `${safeCurrSym}${rateNum.toFixed(2)} / kWh`;
    };

    // Budget & Carbon checks
    const activeCurrValidated = this._resolveValidatedCurrency(settings?.currency);

    let budgetStatus = null;
    if (reportData.isHistorical) {
      if (reportData.isLegacyCurrency || !reportCurrency) {
        budgetStatus = {
          hasBudget: false,
          isHistoricalBlocked: true,
          blockedReason: 'Unavailable for legacy snapshot without recorded currency metadata.'
        };
      } else if (!activeCurrValidated || reportCurrency !== activeCurrValidated) {
        budgetStatus = {
          hasBudget: false,
          isHistoricalBlocked: true,
          blockedReason: `Unavailable: snapshot currency (${WattWatchAppliances.escapeHtml(reportCurrency)}) differs from your current account currency (${WattWatchAppliances.escapeHtml(activeCurrValidated || 'unconfigured')}).`
        };
      } else {
        budgetStatus = WattWatchCalculations.calculateBudgetStatus(reportData.totalCost, settings.budgetInr);
      }
    } else {
      budgetStatus = WattWatchCalculations.calculateBudgetStatus(reportData.totalCost, settings.budgetInr);
    }

    const carbonStatus = WattWatchCalculations.calculateCarbonFootprint(reportData.totalKwh, settings.carbonEmissionFactor);

    // Recommendations preview (ONLY execute if tariff settings are complete & reliable)
    const rawAppliances = reportData.appliances;
    const recs = reportData.isRecalculationAvailable
      ? WattWatchRecommendations.generateRecommendations(rawAppliances, reportData.tariffSettings)
      : {
          isValid: false,
          isHistoricalRecalcUnavailable: true,
          error: reportData.recalculationReason || 'Historical tariff configuration could not be reconstructed reliably.',
          tips: []
        };

    let rowsHtml = '';
    reportData.appliances.forEach((app, idx) => {
      const safeCat = WattWatchAppliances.escapeHtml(app?.category || 'Other');
      const validWatts = this._parseStrictNonNegNum(app?.powerWatts);
      const validQty = this._parseStrictNonNegInt(app?.quantity, 0);
      const validHoursRaw = this._parseStrictNonNegNum(app?.dailyHours);
      const validHours = (validHoursRaw !== null && validHoursRaw <= 24) ? validHoursRaw : null;

      const rawCost = reportData.isHistorical
        ? app?.monthlyCost
        : (summary?.appliances?.[idx]?.monthlyCost ?? app?.monthlyCost);
      const rawKwh = reportData.isHistorical
        ? app?.monthlyKwh
        : (summary?.appliances?.[idx]?.monthlyKwh ?? app?.monthlyKwh);

      const validCost = this._parseStrictNonNegNum(rawCost);
      const validKwh = this._parseStrictNonNegNum(rawKwh);

      rowsHtml += `
        <tr>
          <td>#${idx + 1}</td>
          <td><strong>${WattWatchAppliances.escapeHtml(app?.name || 'Unknown Appliance')}</strong></td>
          <td>${safeCat}</td>
          <td>${validWatts !== null ? `${validWatts}W` : '--'}</td>
          <td>${validQty !== null ? validQty : '--'}</td>
          <td>${validHours !== null ? `${validHours} hrs/day` : '--'}</td>
          <td>${validKwh !== null ? WattWatchCalculations.formatKwh(validKwh) : '-- kWh'}</td>
          <td><strong>${WattWatchAppliances.escapeHtml(fmtMoney(validCost))}</strong></td>
        </tr>
      `;
    });

    let tipsHtml = '';
    if (recs.isHistoricalRecalcUnavailable) {
      tipsHtml = `
        <div style="border-left: 3px solid #C2821A; padding: 0.65rem 0.9rem; background: rgba(194, 130, 26, 0.09); margin-bottom: 0.5rem; font-size: 0.825rem; color: #172B55;">
          <strong>Historical Recommendations Unavailable:</strong> ${WattWatchAppliances.escapeHtml(recs.error)} Stored historical consumption and bill totals above remain accurately preserved.
        </div>
      `;
    } else if (recs.isValid === false) {
      tipsHtml = `
        <div style="border-left: 3px solid #A92639; padding: 0.6rem 0.85rem; background: rgba(169, 38, 57, 0.08); margin-bottom: 0.5rem; font-size: 0.825rem; color: #172B55;">
          <strong>Recommendations Unavailable:</strong> ${WattWatchAppliances.escapeHtml(recs.error || 'Tariff or appliance data failed validation.')}
        </div>
      `;
    } else {
      recs.tips.slice(0, 3).forEach(tip => {
        tipsHtml += `
          <div style="border-left: 3px solid var(--antique-gold); padding: 0.5rem 0.85rem; background: rgba(185, 154, 98, 0.08); margin-bottom: 0.5rem; font-size: 0.825rem;">
            <strong>${WattWatchAppliances.escapeHtml(tip.applianceName)}:</strong> ${WattWatchAppliances.escapeHtml(tip.suggestedAction)}
            <span style="color: var(--deep-burgundy); font-weight: 600;">(${tip.hasReconciledAdjustment ? 'Combined household share' : 'Potential savings'}: ${WattWatchAppliances.escapeHtml(fmtMoney(tip.savedCostMonthly))}/mo)</span>
          </div>
        `;
      });
    }

    // Tariff breakdown schedule (uses stored snapshot breakdown in historical mode without overwriting)
    let tariffScheduleHtml = '';
    if (reportData.tariffDetails && typeof reportData.tariffDetails === 'object') {
      const td = reportData.tariffDetails;
      let slabRows = '';
      if (Array.isArray(td.slabBreakdown) && td.slabBreakdown.length > 0) {
        td.slabBreakdown.forEach(s => {
          const validTier = this._parseStrictNonNegInt(s?.tier, 0);
          const validUnits = this._parseStrictNonNegNum(s?.units);
          slabRows += `
            <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08);">
              <td style="padding: 6px 8px;">Tier ${validTier !== null ? validTier : '--'}: ${WattWatchAppliances.escapeHtml(s?.label || 'Tier')}</td>
              <td style="padding: 6px 8px; text-align: right;">${validUnits !== null ? WattWatchCalculations.formatKwh(validUnits) : '-- kWh'}</td>
              <td style="padding: 6px 8px; text-align: right;">${WattWatchAppliances.escapeHtml(formatRateUnit(s?.rate))}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${WattWatchAppliances.escapeHtml(fmtMoney(s?.cost))}</td>
            </tr>
          `;
        });
      }

      const validFreeApplied = this._parseStrictNonNegNum(td.freeUnitsApplied);
      const validTaxPct = this._parseStrictNonNegNum(td.taxPercent);
      const validSubApplied = this._parseStrictNonNegNum(td.subsidyApplied);
      const hasAnyChargeField = (
        this._parseStrictNonNegNum(td.energyCharges) !== null ||
        this._parseStrictNonNegNum(td.fixedCharge) !== null ||
        this._parseStrictNonNegNum(td.taxCharges) !== null ||
        slabRows.length > 0
      );

      if (hasAnyChargeField) {
        const isSlab = reportData.tariffModel === 'slab';
        const tariffModelScheduleLabel = isSlab
          ? 'Progressive Slab Schedule'
          : (reportData.tariffModel === 'flat' ? 'Standard Flat Rate' : 'Unsupported Tariff Model');
        tariffScheduleHtml = `
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
              Tariff Structure &amp; Billing Calculation (${tariffModelScheduleLabel}${reportData.isHistorical ? ' · Stored Snapshot Breakdown' : ''})
            </h3>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); border-radius: 6px;">
              <thead>
                <tr style="background: #E5EAF2; border-bottom: 2px solid #172B55;">
                  <th style="padding: 6px 8px;">Billing Tier / Cost Component</th>
                  <th style="padding: 6px 8px; text-align: right;">Consumption Allocated</th>
                  <th style="padding: 6px 8px; text-align: right;">Applicable Rate</th>
                  <th style="padding: 6px 8px; text-align: right;">Charge Amount</th>
                </tr>
              </thead>
              <tbody>
                ${slabRows}
              ${(validFreeApplied !== null && validFreeApplied > 0) ? `
                <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08);">
                  <td colspan="3" style="padding: 6px 8px;">Lifeline Free Allowance (${validFreeApplied.toFixed(1)} kWh)</td>
                  <td style="padding: 6px 8px; text-align: right;">${WattWatchAppliances.escapeHtml(fmtMoney(0))}</td>
                </tr>` : ''}
                <tr style="border-top: 1px solid #172B55; font-weight: 600;">
                  <td colspan="3" style="padding: 6px 8px;">Energy Charges Subtotal</td>
                  <td style="padding: 6px 8px; text-align: right;">${WattWatchAppliances.escapeHtml(fmtMoney(td.energyCharges))}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08);">
                  <td colspan="3" style="padding: 6px 8px;">Fixed Utility / Meter Charges</td>
                  <td style="padding: 6px 8px; text-align: right;">${WattWatchAppliances.escapeHtml(fmtMoney(td.fixedCharge))}</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08);">
                  <td colspan="3" style="padding: 6px 8px;">Electricity Duty &amp; Taxes (${validTaxPct !== null && validTaxPct <= 100 ? `${validTaxPct}%` : '--'})</td>
                  <td style="padding: 6px 8px; text-align: right;">${WattWatchAppliances.escapeHtml(fmtMoney(td.taxCharges))}</td>
                </tr>
              ${(validSubApplied !== null && validSubApplied > 0) ? `
                <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08); color: #1E6649;">
                  <td colspan="3" style="padding: 6px 8px;">Government Subsidy / Bill Credit Applied</td>
                  <td style="padding: 6px 8px; text-align: right;">-${WattWatchAppliances.escapeHtml(fmtMoney(validSubApplied))}</td>
                </tr>` : ''}
              </tbody>
              <tfoot>
                <tr style="background: #E5EAF2; border-top: 2px solid #172B55; font-weight: 700;">
                  <td colspan="3" style="padding: 8px; color: #172B55;">${reportData.isHistorical ? 'Stored Historical Electricity Bill Total' : 'Total Estimated Electricity Bill'}</td>
                  <td style="padding: 8px; text-align: right; color: #6E293F; font-size: 0.95rem;">${WattWatchAppliances.escapeHtml(fmtMoney(reportData.totalCost))}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        `;
      } else if (reportData.isHistorical) {
        tariffScheduleHtml = `
          <div style="margin-bottom: 1.5rem; padding: 0.9rem 1rem; border: 1px solid rgba(185, 154, 98, 0.45); background: #FAF7F0; border-radius: 6px; font-size: 0.825rem; color: #172B55;">
            <strong>Stored Historical Billing Total:</strong> ${WattWatchAppliances.escapeHtml(fmtMoney(reportData.totalCost))} across ${WattWatchCalculations.formatKwh(reportData.totalKwh)}. Itemized tariff breakdown &amp; recalculation details are unavailable for this legacy snapshot.
          </div>
        `;
      }
    } else if (reportData.isHistorical) {
      tariffScheduleHtml = `
        <div style="margin-bottom: 1.5rem; padding: 0.9rem 1rem; border: 1px solid rgba(185, 154, 98, 0.45); background: #FAF7F0; border-radius: 6px; font-size: 0.825rem; color: #172B55;">
          <strong>Stored Historical Billing Total:</strong> ${WattWatchAppliances.escapeHtml(fmtMoney(reportData.totalCost))} across ${WattWatchCalculations.formatKwh(reportData.totalKwh)}. Itemized tariff breakdown &amp; recalculation details are unavailable for this legacy snapshot.
        </div>
      `;
    }

    // Category distribution summary
    let categoryRows = '';
    let hasPartialCategoryFallback = false;
    const catSummary = summary?.categoryBreakdown || {};
    const defaultCats = ['Cooling', 'Lighting', 'Kitchen', 'Entertainment', 'Computing', 'Other'];
    const orderedCats = [
      ...defaultCats,
      ...Object.keys(catSummary).filter(k => !defaultCats.includes(k))
    ];
    orderedCats.forEach(cat => {
      const c = catSummary[cat];
      const hasAnyDataOrItems = c && (
        c.count > 0 ||
        c.kwh > 0 ||
        (summary?.isStoredFallbackOnly && c.itemCount > 0)
      );
      if (hasAnyDataOrItems) {
        const isFallback = Boolean(summary?.isStoredFallbackOnly);
        const catCount = this._parseStrictNonNegInt(c.count, 0);
        const catKwh = this._parseStrictNonNegNum(c.kwh);
        const catPct = this._parseStrictNonNegNum(c.percentage);

        let countCell = catCount !== null ? String(catCount) : '--';
        if (isFallback && c.hasInvalidCount) {
          hasPartialCategoryFallback = true;
          countCell = (c.validCountItems > 0 && catCount !== null)
            ? `${catCount} <span style="color: #687386; font-size: 0.72rem;">(Partial)</span>`
            : '<span style="color: #687386;">Unavailable</span>';
        }

        let kwhCell = catKwh !== null ? WattWatchCalculations.formatKwh(catKwh) : '-- kWh';
        if (isFallback && c.hasInvalidKwh) {
          hasPartialCategoryFallback = true;
          kwhCell = (c.validKwhCount > 0 && catKwh !== null)
            ? `${WattWatchCalculations.formatKwh(catKwh)} <span style="color: #687386; font-size: 0.72rem;">(Partial)</span>`
            : '<span style="color: #687386;">Unavailable</span>';
        }

        let pctCell = catPct !== null ? `${catPct.toFixed(1)}%` : '<span style="color: #687386;">Unavailable</span>';
        if (isFallback && c.isPercentagePartial) {
          hasPartialCategoryFallback = true;
          pctCell = (catPct !== null && Number.isFinite(c.percentage))
            ? `${catPct.toFixed(1)}% <span style="color: #687386; font-size: 0.72rem;">(Partial)</span>`
            : '<span style="color: #687386;">Unavailable</span>';
        }

        let catCostCell = '';
        if (!reportData.isRecalculationAvailable) {
          if (!c.hasStoredCost) {
            hasPartialCategoryFallback = true;
            catCostCell = '<span style="color: #687386;">Unavailable</span>';
          } else if (isFallback && c.hasInvalidCost) {
            hasPartialCategoryFallback = true;
            catCostCell = `${WattWatchAppliances.escapeHtml(fmtMoney(c.cost))} <span style="color: #687386; font-size: 0.72rem;">(Partial)</span>`;
          } else {
            catCostCell = WattWatchAppliances.escapeHtml(fmtMoney(c.cost));
          }
        } else {
          catCostCell = WattWatchAppliances.escapeHtml(fmtMoney(c.cost));
        }

        categoryRows += `
          <tr style="border-bottom: 1px solid rgba(23, 43, 85, 0.08);">
            <td style="padding: 6px 8px;"><strong>${WattWatchAppliances.escapeHtml(cat)}</strong></td>
            <td style="padding: 6px 8px; text-align: center;">${countCell}</td>
            <td style="padding: 6px 8px; text-align: right;">${kwhCell}</td>
            <td style="padding: 6px 8px; text-align: right;">${pctCell}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${catCostCell}</td>
          </tr>
        `;
      }
    });

    const categorySummaryHtml = categoryRows ? `
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
          Category Energy Distribution Matrix
        </h3>
        <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); border-radius: 6px;">
          <thead>
            <tr style="background: #E5EAF2; border-bottom: 2px solid #172B55;">
              <th style="padding: 6px 8px;">Appliance Category</th>
              <th style="padding: 6px 8px; text-align: center;">Tracked Units</th>
              <th style="padding: 6px 8px; text-align: right;">Monthly Energy</th>
              <th style="padding: 6px 8px; text-align: right;">Proportion of Total</th>
              <th style="padding: 6px 8px; text-align: right;">${reportData.isRecalculationAvailable ? 'Estimated Cost' : 'Stored Cost'}</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows}
          </tbody>
        </table>
        </div>
        ${hasPartialCategoryFallback ? '<div style="margin-top: 0.4rem; font-size: 0.75rem; color: #687386;">Some category totals exclude appliances with missing or invalid stored values and are marked Partial or Unavailable.</div>' : ''}
      </div>
    ` : '';

    const historicalNoticesHtml = reportData.isHistorical ? `
      ${!reportData.isRecalculationAvailable ? `
        <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; border-left: 4px solid #C2821A; background: rgba(194, 130, 26, 0.1); border-radius: 4px; font-size: 0.82rem; color: #172B55;">
          <strong>Historical Recalculation Unavailable:</strong> ${WattWatchAppliances.escapeHtml(reportData.recalculationReason)} Preserved stored snapshot totals are shown below without synthetic flat-tariff recalculation.
        </div>
      ` : ''}
      ${reportData.isLegacyCurrency ? `
        <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; border-left: 4px solid #687386; background: rgba(104, 115, 134, 0.1); border-radius: 4px; font-size: 0.82rem; color: #172B55;">
          <strong>Currency Information Unavailable (Legacy Snapshot):</strong> This historical record does not specify a billing currency. Numeric totals are displayed as unlabelled stored amounts and do not apply your current account currency setting.
        </div>
      ` : ''}
    ` : '';

    const effRateNum = this._parseStrictNonNegNum(reportData.effectiveRate);
    const baseRateNum = this._parseStrictNonNegNum(reportData.rate);
    const escapedCurrPrefix = safeCurrSym ? WattWatchAppliances.escapeHtml(safeCurrSym) : '';
    const tariffModelTitle = reportData.tariffModel === 'slab'
      ? (effRateNum !== null
          ? `Slab (Eff. ${reportData.isLegacyCurrency ? effRateNum.toFixed(2) + '/u' : escapedCurrPrefix + effRateNum.toFixed(2) + '/u'})`
          : 'Slab Tariff')
      : (reportData.tariffModel === 'flat'
          ? (baseRateNum !== null
              ? `Flat ${reportData.isLegacyCurrency ? baseRateNum.toFixed(2) + '/u' : escapedCurrPrefix + baseRateNum.toFixed(2) + '/u'}`
              : 'Flat Tariff')
          : 'Unsupported Tariff Model');

    const countDisp = (reportData.appliancesCount !== null && reportData.appliancesCount !== undefined) ? String(reportData.appliancesCount) : '--';
    const unitsDisp = (reportData.totalUnits !== null && reportData.totalUnits !== undefined) ? String(reportData.totalUnits) : '--';
    const headerCurrLabel = reportData.isLegacyCurrency
      ? 'Currency: Unrecorded (Legacy)'
      : (safeCurrSym ? `Currency: ${WattWatchAppliances.escapeHtml(safeCurrSym)}` : 'Currency: Unconfigured');

    container.innerHTML = `
      <!-- Printable Executive Document Wrapper -->
      <div class="report-document-body" id="printableReportContent">
        <!-- Header Strip -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #172B55; padding-bottom: 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="assets/logo.svg" alt="WattWatch Logo" style="width: 48px; height: 48px;">
            <div>
              <h1 style="font-family: var(--font-heading); font-size: 1.6rem; color: #172B55; margin: 0; line-height: 1.1;">WATTWATCH</h1>
              <div style="font-size: 0.75rem; letter-spacing: 0.15em; color: #B99A62; font-weight: 700; text-transform: uppercase;">Energy Intelligence Platform</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-heading); font-size: 1.35rem; color: #6E293F; font-weight: 700;">MONTHLY ENERGY AUDIT</div>
            <div style="font-size: 0.85rem; color: #687386;">Billing Period: <strong>${WattWatchAppliances.escapeHtml(reportData.periodLabel || reportData.period)}</strong></div>
            <div style="font-size: 0.75rem; color: #687386;">Generated on: ${WattWatchAppliances.escapeHtml(reportData.generatedAt)} · ${headerCurrLabel}</div>
          </div>
        </div>

        ${historicalNoticesHtml}

        <!-- KPI Metric Cards Grid -->
        <div class="report-kpi-grid" style="margin-bottom: 1.5rem;">
          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Total Consumption</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #172B55;">${WattWatchCalculations.formatKwh(reportData.totalKwh)}</div>
            <div style="font-size: 0.68rem; color: #687386;">${reportData.isHistorical ? 'Stored Snapshot Total' : 'Calculated Live Estimate'}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">${reportData.isHistorical ? 'Recorded Bill Total' : 'Estimated Bill'}</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #6E293F;">${WattWatchAppliances.escapeHtml(fmtMoney(reportData.totalCost))}</div>
            <div style="font-size: 0.68rem; color: #687386;">${reportData.isLegacyCurrency ? 'Stored Amount (Currency Unrecorded)' : (reportData.isHistorical ? 'Stored Snapshot Bill' : (safeCurrSym ? 'Calculated Monthly Total' : 'Calculated Monthly Total (Currency Unconfigured)'))}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Tariff Model</div>
            <div style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 600; color: #172B55;">
              ${tariffModelTitle}
            </div>
            <div style="font-size: 0.7rem; color: #687386;">${reportData.isHistorical ? (reportData.isRecalculationAvailable ? 'Recalculation Available (Saved Tariff)' : ((reportData.tariffModel !== 'flat' && reportData.tariffModel !== 'slab') ? 'Recalculation Blocked (Invalid Tariff Model)' : 'Recalculation Unavailable (Legacy Tariff)')) : (reportData.tariffModel === 'slab' ? 'Effective Tariff Rate' : 'Base Tariff')}</div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.35); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.7rem; text-transform: uppercase; color: #687386; font-weight: 600;">Appliances Tracked</div>
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: #172B55;">${countDisp} Items</div>
            <div style="font-size: 0.7rem; color: #687386;">${unitsDisp} Total Units</div>
          </div>
        </div>

        <!-- Budget & Carbon Status Row -->
        <div class="report-status-grid" style="margin-bottom: 1.5rem;">
          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.25); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #172B55; text-transform: uppercase; margin-bottom: 0.25rem;">Budget Utilization</div>
            <div style="font-size: 0.85rem; color: #172B55;">
              ${budgetStatus.isHistoricalBlocked
                ? WattWatchAppliances.escapeHtml(budgetStatus.blockedReason)
                : (budgetStatus.status === 'invalid'
                    ? 'Unavailable: configured monthly budget setting is invalid.'
                    : (budgetStatus.hasBudget
                        ? `${reportData.isHistorical ? 'Current Account Budget Setting' : 'Budget'}: <strong>${WattWatchAppliances.escapeHtml(fmtMoney(budgetStatus.budget))}</strong> · Used: <strong>${budgetStatus.utilizationPercent.toFixed(1)}%</strong> (${WattWatchAppliances.escapeHtml(budgetStatus.statusLabel)})${reportData.isHistorical ? ' <span style="font-size: 0.75rem; color: #687386;">(compared against current setting, not a historical budget)</span>' : ''}`
                        : 'No monthly electricity budget currently set.'))}
            </div>
          </div>

          <div style="background: #FAF7F0; border: 1px solid rgba(185, 154, 98, 0.25); padding: 0.85rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #172B55; text-transform: uppercase; margin-bottom: 0.25rem;">Carbon Footprint</div>
            <div style="font-size: 0.85rem; color: #172B55;">
              ${(carbonStatus.isAvailable && Number.isFinite(carbonStatus.monthlyKgCO2) && Number.isFinite(carbonStatus.annualMetricTons))
                ? `Estimated Monthly Emissions: <strong>${carbonStatus.monthlyKgCO2.toFixed(1)} kg CO₂e</strong> (${carbonStatus.annualMetricTons.toFixed(2)} tons/yr)`
                : 'Carbon emission factor unconfigured.'}
            </div>
          </div>
        </div>

        <!-- Tariff Structure & Billing Breakdown Table -->
        ${tariffScheduleHtml}

        <!-- Category Energy Distribution Summary -->
        ${categorySummaryHtml}

        <!-- Appliance Itemization Table -->
        <div style="margin-bottom: 1.5rem;">
          <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
            Appliance Consumption Breakdown
          </h3>
          <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="background: #E5EAF2; border-bottom: 2px solid #172B55;">
                <th style="padding: 6px 8px;">#</th>
                <th style="padding: 6px 8px;">Appliance Name</th>
                <th style="padding: 6px 8px;">Category</th>
                <th style="padding: 6px 8px;">Rating</th>
                <th style="padding: 6px 8px;">Qty</th>
                <th style="padding: 6px 8px;">Usage</th>
                <th style="padding: 6px 8px;">Monthly Energy</th>
                <th style="padding: 6px 8px;">${reportData.isHistorical ? 'Recorded Cost' : 'Estimated Cost'}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="padding: 12px; text-align: center;">No appliances recorded.</td></tr>'}
            </tbody>
            <tfoot>
              <tr style="background: #E5EAF2; border-top: 2px solid #172B55; font-weight: 700;">
                <td colspan="4" style="padding: 8px;">Total Tracked Appliances (${countDisp} Items)</td>
                <td style="padding: 8px; text-align: center;">${unitsDisp} Units</td>
                <td style="padding: 8px;">--</td>
                <td style="padding: 8px; font-weight: 700;">${WattWatchCalculations.formatKwh(reportData.totalKwh)}</td>
                <td style="padding: 8px; color: #6E293F; font-weight: 700;">${WattWatchAppliances.escapeHtml(fmtMoney(reportData.totalCost))}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        <!-- Energy Saving Recommendations Section -->
        ${(recs.isHistoricalRecalcUnavailable || recs.isValid === false || recs.tips.length > 0) ? `
          <div style="margin-bottom: 1.5rem;">
            <h3 style="font-family: var(--font-heading); font-size: 1.15rem; color: #172B55; margin-bottom: 0.5rem;">
              Key Energy Conservation Recommendations
            </h3>
            ${tipsHtml}
          </div>
        ` : ''}

        <!-- Official Report Disclaimer -->
        <div style="border-top: 1px solid #B99A62; padding-top: 0.75rem; margin-top: 1.5rem; font-size: 0.72rem; color: #687386; line-height: 1.4;">
          <strong>Official Disclaimer:</strong> This document is an estimated analytical summary generated by the WattWatch platform based upon nominal equipment ratings, user-reported operating durations, and configured tariff coefficients. It does not constitute a legally binding utility bill, tax invoice, or authoritative meter audit from any state DISCOM or electricity supply undertaking.
        </div>
      </div>
    `;
  },

  /**
   * Invokes native browser print dialog configured to output high-fidelity PDF
   */
  printReport() {
    window.print();
  }
};

if (typeof window !== 'undefined') {
  window.WattWatchReport = WattWatchReport;
}
