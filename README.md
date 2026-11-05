# WattWatch 2.0 ⚡

### Advanced Electricity Management & Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-B99A62.svg)](https://opensource.org/licenses/MIT)
[![Pure Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-172B55.svg)](#technology-stack)
[![Chart.js v4](https://img.shields.io/badge/Visuals-Chart.js%20v4-6E293F.svg)](https://www.chartjs.org/)
[![Status](https://img.shields.io/badge/Version-2.0%20Advanced-2E946E.svg)](#overview)

> **WattWatch 2.0** is an enterprise-grade client-side energy intelligence platform crafted in an editorial **Royal Luxury Energy Technology** aesthetic. Building upon the core inventory and calculation capabilities of WattWatch 1.0, version 2.0 introduces frozen monthly billing snapshots, an active electricity budget tracker, month-to-month comparative deltas, an interactive appliance replacement simulator, an advanced progressive slab tariff engine, a carbon footprint estimator, and native client-side PDF monthly energy audit reports.

---

## 🏛️ Visual Identity & Design System

WattWatch 2.0 preserves the refined visual identity inspired by high-end financial dashboards, luxury horology, and architectural journals.

### Official Color Tokens

| Token | Name | Hex Code | Purpose & Application |
| :--- | :--- | :--- | :--- |
| **Royal Blue** | `--royal-blue` | `#172B55` | Primary navigation, card headers, primary CTA buttons |
| **Warm Beige** | `--warm-beige` | `#F0E5D0` | Primary ambient page background (Light Theme - Default) |
| **Deep Burgundy** | `--deep-burgundy` | `#6E293F` | Financial statistics, cost metrics, peak load indicators |
| **Antique Gold** | `--antique-gold` | `#B99A62` | Architectural borders, luxury badges, active state indicators |
| **Cream White** | `--cream-white` | `#FAF7F0` | Elevated card surfaces, form input containers |
| **Muted Slate** | `--muted-slate` | `#687386` | Secondary typography, metadata, chart axis labels |
| **Soft Blue** | `--soft-blue` | `#E5EAF2` | Secondary highlight surfaces, badge backgrounds |
| **Light Burgundy**| `--light-burgundy`| `#F2E5E8` | Warning badges, high-impact highlight surfaces |

*Includes an optional, finely tuned **Royal Dark Mode** (`#0D1628` midnight blue with antique gold highlights).*

---

## 🚀 Key Modules & Capabilities in WattWatch 2.0

### 1. Monthly Electricity Bill History & Snapshots
* **Frozen Immutable Snapshots**: Captures complete household state for any billing cycle (e.g., `2026-11` / November 2026), freezing units, costs, applied tariffs, and appliance breakdowns.
* **Independent Historical Records**: Appliance edits or rate changes made in the present never mutate past snapshots.
* **Duplicate Period Protection**: Detects existing snapshots for the selected cycle and prompts an intentional confirmation before updating.
* **Historical Highlights**: Automatically detects and highlights the peak (highest) and lowest recorded monthly bills.
* **Detailed Snapshot Inspector**: Deep-inspection modal displaying the frozen appliance inventory captured at the time of the snapshot.
* **Chronological Trend Graph**: Dynamic multi-month line visualization showing the progression of units consumed and charges billed.

### 2. Electricity Budget Tracker
* **Configurable Allowance**: Users set a monthly budget in INR (₹) within Settings or directly from the dashboard.
* **Real-Time Utilization Progress Bar**: Dynamic visual progress indicator with color transitions matching safety tiers:
  * **Safe** ($< 75\%$): Royal Blue / Antique Gold.
  * **Caution** ($75\% - 89.9\%$): Antique Gold / Amber.
  * **Critical** ($90\% - 99.9\%$): Deep Burgundy.
  * **Exceeded** ($\ge 100\%$): High-contrast warning red.
* **Non-Intrusive Notifications**: Automatic toast alerts when spending crosses the 75%, 90%, and 100% threshold boundaries.
* **Real-Time Remaining Balance**: Clearly displays remaining funds or exact overage amounts.

### 3. Month-to-Month Comparative Analytics
* **Bi-Period Delta Engine**: Select and compare any two historical billing snapshots (Baseline Period A vs. Target Period B).
* **Quantified Metric Variances**:
  * Energy variance: $\Delta \text{kWh}$ and $\% \Delta \text{kWh}$.
  * Financial variance: $\Delta ₹$ and $\% \Delta ₹$.
* **Zero-Division Protection**: Robust mathematical fallbacks prevent runtime exceptions when comparing periods with zero baseline consumption.
* **Grouped Comparison Chart**: Dual-bar comparison visual comparing energy units and financial charges side-by-side.

### 4. Appliance Replacement Simulator & ROI Payback
* **Interactive Model Comparison**: Select any existing appliance and compare it against a prospective energy-efficient alternative.
* **Live Differential Math**: Computes exact monthly energy conservation (kWh), monthly financial savings (₹), annual savings, and percentage reduction.
* **ROI Payback Period Estimator**: Enter prospective purchase cost in INR to instantly calculate the break-even timeframe in months.
* **Clear Simulation Disclaimers**: Clarifies results are mathematical approximations based on nominal ratings.

### 5. Advanced Electricity Tariff Engine & Sandbox
* **Dual Tariff Architecture**:
  * **Flat Tariff**: Standard uniform rate per unit (default ₹8.00 / kWh preserved).
  * **Progressive Multi-Slab Tariff**: Configurable tiered limits and slab rates (e.g., 0–100 kWh @ ₹4.50, 101–300 kWh @ ₹7.50, >300 kWh @ ₹10.00).
* **Fixed Charges & Taxes**: Incorporates monthly meter rent/sanctioned load charges and percentage-based electricity duty/surcharges.
* **Interactive Sandbox**: Test hypothetical monthly consumption figures in real time with a slab-by-slab breakdown.
* **One-Click Promotion**: Easily promote custom sandbox tariffs directly into permanent application settings.

### 6. Carbon Footprint Estimator
* **Quantified Environmental Impact**: Translates electrical consumption into estimated greenhouse gas emissions ($\text{kg CO}_2\text{e}$ and Metric Tons).
* **Configurable Grid Factor**: User-customizable carbon intensity factor ($\text{kg CO}_2/\text{kWh}$, default $0.82$, an estimation assumption whose source has not yet been independently verified). Clear indicator when unconfigured or disabled.
* **Urban Tree Offsetting Metric**: Calculates the estimated number of mature trees required to sequester annual household electrical emissions (using an estimation assumption of $21.77\text{ kg CO}_2/\text{year}$ per tree, whose source has not yet been independently verified).
* **Category Emission Allocation Chart**: Visual bar breakdown illustrating which appliance domains generate the greatest environmental impact.

### 7. Client-Side PDF Monthly Audit Report Generator
* **Executive Document Formatting**: Formats a print-ready executive report with WattWatch logo, metadata, KPI strip, appliance breakdown table, budget status, and recommendations.
* **Period Flexibility**: Select either the current live estimate or any frozen historical snapshot.
* **Zero Heavy Dependencies**: Uses high-fidelity `@media print` rules for browser-native "Save as PDF" generation, outputting clean vector PDFs with zero bloat.
* **Legal Disclaimers**: Prominently notes that generated documents are analytical approximations and not official DISCOM utility invoices.

### 8. Data Storage, Portability & Backward Compatibility
* **Schema Version 2.0**: Seamlessly persists historical snapshots (`wattwatch_history_v1`), budget targets, multi-slab configurations, fixed charges, and emission coefficients.
* **100% Backward Compatibility**: Full support for importing WattWatch 1.0 backup files without data loss or schema conflicts.
* **Client-Side Privacy**: Data stays in local browser storage; zero external server sync or unauthorized telemetry.

---

## 🧮 Mathematical Formulas & Models

### 1. Energy Consumption Formulas
$$E_{\text{daily}} = \frac{P \times Q \times H_{\text{daily}}}{1000} \quad [\text{kWh}]$$

$$E_{\text{monthly}} = \frac{P \times Q \times H_{\text{daily}} \times D_{\text{operating}}}{1000} \quad [\text{kWh}]$$

### 2. Multi-Slab Tariff Formulation
For $N$ progressive consumption tiers with upper bounds $U_i$ and rates $R_i$:
$$C_{\text{energy}} = \sum_{i=1}^{N} \text{Units}_i \times R_i$$

$$C_{\text{total}} = (C_{\text{energy}} + C_{\text{fixed}}) \times \left(1 + \frac{\text{Tax}\%}{100}\right) \quad [₹]$$

### 3. Month-to-Month Comparative Deltas
$$\Delta E = E_B - E_A \quad [\text{kWh}], \qquad \Delta C = C_B - C_A \quad [₹]$$

$$\% \Delta E = \begin{cases} \left(\frac{E_B - E_A}{E_A}\right) \times 100\% & E_A > 0 \\ 100\% & E_A = 0 \text{ and } E_B > 0 \\ 0\% & E_A = 0 \text{ and } E_B = 0 \end{cases}$$

### 4. Carbon Emissions Formulation
$$\text{Emissions}_{\text{monthly}} = E_{\text{monthly}} \times F_{\text{grid}} \quad [\text{kg CO}_2\text{e}]$$

$$\text{Trees Equivalent} = \left\lceil \frac{\text{Emissions}_{\text{annual}}}{21.77} \right\rceil$$

---

## 📂 Project Structure

```
WattWatch-Web/
├── index.html                   # Master single-page application document
├── README.md                    # Comprehensive documentation and portfolio guide
├── LICENSE                      # MIT Open Source License
│
├── css/
│   ├── style.css                # Royal luxury design tokens, variables, typography, buttons, toasts
│   ├── dashboard.css            # Component styles: sidebar, budget card, history, simulator, print
│   └── responsive.css           # Breakpoints (desktop, tablet, mobile) and drawer transitions
│
├── js/
│   ├── app.js                   # Application controller, view routing, modals, toasts, event bindings
│   ├── calculations.js          # Core physical formulas for energy, tariffs, budget, and carbon
│   ├── appliances.js            # Appliance CRUD, input validation, live preview, presets, filters
│   ├── history.js               # Historical snapshot management & month-to-month comparison
│   ├── simulator.js             # Replacement simulator and advanced tariff calculator sandbox
│   ├── report.js                # Monthly executive audit report & client-side PDF generator
│   ├── charts.js                # Chart.js instances, color schemas, responsive resizing, empty states
│   ├── storage.js               # LocalStorage management, schema validator, JSON import/export
│   ├── recommendations.js       # Rule-based diagnostic algorithms for quantified energy conservation
│   └── chart.umd.min.js         # Production Chart.js v4 bundle for 100% offline local execution
│
└── assets/
    └── logo.svg                 # Custom SVG luxury geometric shield and energy lightning crest
```

---

## 📋 Current Verification Status

To ensure complete engineering transparency, the verification status of WattWatch 2.0 is categorized below into automated development checks reported during implementation, features manually verified by the project owner, and capabilities awaiting manual testing following examinations.

> [!NOTE]
> The development report reported 20 passing automated checks during implementation; however, independent verification of the complete test suite is pending.

### 🤖 Automated Checks (Development Process)
* **Mathematical & Physical Formulas**: Automated checks verified calculations for daily and monthly energy consumption ($E_{\text{daily}}, E_{\text{monthly}}$), progressive multi-slab tier allocation, fixed meter charges, and percentage surcharge taxes.
* **Bi-Period Delta Arithmetic**: Automated checks verified differential calculations ($\Delta E, \Delta C, \% \Delta E, \% \Delta C$) including zero-division protections for zero-baseline billing cycles.
* **Environmental Impact Calculations**: Automated checks verified carbon emission and tree offset calculations using the default estimation assumptions ($0.82\text{ kg CO}_2/\text{kWh}$ and $21.77\text{ kg CO}_2/\text{tree/year}$); these figures are estimation assumptions whose external sources have not yet been independently verified.
* **Schema Serialization & Migration**: Automated checks validated LocalStorage persistence routines, JSON backup export, and backward-compatible ingestion of legacy WattWatch 1.0 payloads into v2.0 schema structures.
* **Syntax Integrity & Code Hygiene**: Automated code audits confirmed zero trailing whitespace (`git diff --check`) and clean console execution without unhandled exceptions.

### 👤 Manually Verified by Project Owner
* **Overview Dashboard Calculation**: Confirmed that the overview dashboard displayed an estimated bill of ₹228 from 22.8 kWh at ₹10/unit.
* **Appliance Calculations**: Confirmed specific appliance calculations for the initial items:
  * Fan: 18 kWh / ₹180
  * Bulb: 4.8 kWh / ₹48
* **Analytics Screen**: Confirmed that the Analytics screen opened and displayed its energy and carbon estimates.
* **Bill History View**: Confirmed that the Bill History section opened and displayed its expected empty state.

*(Note: Manual testing of appliance CRUD operations, table sorting, theme switching, electricity rate adjustments, and other unverified features has not yet been performed and remains to be tested.)*

### ⏳ Awaiting Manual Testing (Post-Examinations)
* **Appliance Management & Operations**: Testing end-to-end appliance creation, editing, deletion, category filtering, live searching, and table sorting.
* **Electricity Rate & Configuration Adjustments**: Modifying electricity rates, currency symbols, and billing cycle days in Settings, then confirming application-wide recalculation.
* **Theme Switching**: Toggling between Light (Warm Beige) and Royal Dark themes across all views and verifying chart color palette adaptation.
* **Multi-Cycle Billing Snapshots**: Creating, inspecting frozen inventories, and deleting historical snapshots across multiple real billing periods.
* **Budget Warning Threshold Notifications**: Testing real-world sequential toast alerts as simulated usage crosses 75% (Caution), 90% (Critical), and 100% (Exceeded) limits.
* **Progressive Slab Tariff Sandbox**: Testing custom multi-slab limits, fixed charges, and tax surcharges against real regional utility tariff cards (e.g., BESCOM, MSEDCL, TNEB).
* **Appliance Replacement Simulator**: Scenario testing of the ROI payback break-even calculations across varying appliance wattages and daily usage hours.
* **Client-Side PDF Monthly Audit Report**: Verifying `@media print` formatting and PDF export across different browsers (Chrome, Edge, Firefox, Safari) and operating systems.
* **Data Portability**: Testing full JSON export, file downloads, and importing existing backups.
* **Mobile Responsiveness & Touch Ergonomics**: Verifying mobile navigation drawer toggles and responsive single-column layouts on physical mobile devices.

---

## 🧪 Quality Control & Test Specification Matrix

The matrix below lists the 20 test specifications defined for WattWatch 2.0 and the outcomes reported by the automated development process. As noted in the [Current Verification Status](#-current-verification-status) section above, independent verification of the complete test suite is pending.

| Test ID | Verification Scope | Dev Report Status | Notes |
| :---: | :--- | :---: | :--- |
| **TC-01** | Creating monthly bill snapshots | Reported Passing | Freezes deep-cloned appliance inventory, units, and applied tariff coefficients. |
| **TC-02** | Preventing accidental duplicate snapshots | Reported Passing | Detects existing period record and requires explicit overwrite confirmation. |
| **TC-03** | Editing and deleting historical records | Reported Passing | Snapshot details modal inspects frozen inventory; deletion requires confirmation. |
| **TC-04** | Budget calculations | Reported Passing | Accurately models utilization percentage, remaining balance, and overage. |
| **TC-05** | Budget warning thresholds | Reported Passing | Correctly triggers caution ($75\%$), critical ($90\%$), and exceeded ($\ge 100\%$) states. |
| **TC-06** | Month-to-month comparisons | Reported Passing | Calculates energy and cost deltas; safe against zero-division errors. |
| **TC-07** | Appliance replacement calculations | Reported Passing | Accurately computes monthly and annual savings and payback break-even months. |
| **TC-08** | Flat tariff calculations | Reported Passing | Verified against flat rate arithmetic with 2-decimal precision. |
| **TC-09** | Slab tariff calculations | Reported Passing | Verified against sample tiered multi-slab values with fixed charges and duty. |
| **TC-10** | Carbon factor configuration | Reported Passing | Accurately calculates monthly and annual emissions; displays disabled state when cleared. |
| **TC-11** | PDF report generation | Reported Passing | Formats executive document; invokes native print preview without server dependencies. |
| **TC-12** | JSON export and import with new data | Reported Passing | Exports full v2.0 schema including history; validates structure on import. |
| **TC-13** | Existing data migration | Reported Passing | Backward-compatible import parses v1.0 JSON payloads without errors. |
| **TC-14** | LocalStorage persistence | Reported Passing | All appliances, historical snapshots, settings, and theme persist across reloads. |
| **TC-15** | Desktop responsiveness | Reported Passing | Full sidebar layout, multi-column metric grids, and side-by-side simulator panes. |
| **TC-16** | Mobile responsiveness | Reported Passing | Collapsible navigation drawer, touch targets $\ge 44\text{px}$, single-column stacking. |
| **TC-17** | Light and dark themes | Reported Passing | Royal Beige Light Mode (default) and Royal Dark Mode switch cleanly with chart palette adaptation. |
| **TC-18** | Existing appliance CRUD operations | Reported Passing | Full add, edit, delete, search, category filter, and sorting operations preserved. |
| **TC-19** | Existing dashboard calculations | Reported Passing | All 4 summary KPI cards and primary load spotlight react automatically to state changes. |
| **TC-20** | Browser console integrity | Reported Passing | Zero JavaScript syntax errors, missing DOM references, or unhandled exceptions. |

---

## 🚀 How to Run the Application

WattWatch 2.0 requires no build steps, compilers, or server processes:

1. Open [`index.html`](index.html) directly in any modern browser (Chrome, Edge, Firefox, Safari).
2. The application will initialize, restore your local data (or load the curated sample household for first-time evaluation), and render all interactive charts and management tools.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

*WattWatch 2.0 — Precision Energy Intelligence.*
