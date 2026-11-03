# WattWatch ⚡

### Premium Electricity Consumption & Energy Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-B99A62.svg)](https://opensource.org/licenses/MIT)
[![Pure Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-172B55.svg)](#technology-stack)
[![Chart.js v4](https://img.shields.io/badge/Visuals-Chart.js%20v4-6E293F.svg)](https://www.chartjs.org/)
[![Status](https://img.shields.io/badge/Production-Ready-2E946E.svg)](#overview)

> **WattWatch** is an enterprise-grade, client-side energy intelligence web application crafted with a distinctive **Royal Luxury Energy Technology** aesthetic. It enables homeowners, property managers, and energy consultants to accurately track appliance power draw, model estimated monthly utility bills, discover consumption bottlenecks, and receive rule-based energy conservation strategies—operating completely client-side without external server requirements or paid APIs.

---

## 🏛️ Visual Identity & Design System

WattWatch diverges deliberately from generic neon-green or dark hacker dashboards, adopting an editorial design system inspired by high-end financial platforms, architectural journals, and luxury horology.

### Official Color Palette

| Token | Name | Hex Code | Purpose & Application |
| :--- | :--- | :--- | :--- |
| **Royal Blue** | `--royal-blue` | `#172B55` | Primary navigation, card headers, primary CTA buttons |
| **Warm Beige** | `--warm-beige` | `#F0E5D0` | Primary ambient page background (Light Theme) |
| **Deep Burgundy** | `--deep-burgundy` | `#6E293F` | Financial statistics, cost metrics, peak load indicators |
| **Antique Gold** | `--antique-gold` | `#B99A62` | Architectural borders, luxury badges, active state indicators |
| **Cream White** | `--cream-white` | `#FAF7F0` | Elevated card surfaces, form input containers |
| **Muted Slate** | `--muted-slate` | `#687386` | Secondary typography, metadata, chart axis labels |
| **Soft Blue** | `--soft-blue` | `#E5EAF2` | Secondary highlight surfaces, badge backgrounds |
| **Light Burgundy**| `--light-burgundy`| `#F2E5E8` | Warning badges, high-impact highlight surfaces |

*Includes an optional, finely tuned **Royal Dark Mode** (`#0D1628` midnight blue with antique gold highlights).*

---

## ✨ Main Features

### 1. Executive Overview Dashboard
- **Summary KPI Cards**: Real-time totals for Monthly Consumption (`kWh`), Estimated Bill (`₹`), Appliance Inventory Count (`Units`), and Average Daily Consumption (`kWh`).
- **Primary Load Spotlight**: Automatically highlights the highest energy-consuming appliance, computing its direct percentage contribution to the monthly bill.
- **Dynamic Charts**:
  - **Weekly Load Projection**: 7-day cyclical consumption profile factoring in weekend load variations.
  - **Category Breakdown Donut**: High-precision proportional distribution across appliance categories.
- **Quick Action Bar**: One-click shortcuts for appliance registration, analytics exploration, and tariff adjustments.

### 2. Comprehensive Appliance Management
- **Full CRUD Support**: Add, update, delete, and inspect appliances with instant UI reflection.
- **Granular Parameters**:
  - Appliance Name (e.g., *1.5 Ton 5-Star Inverter Split AC*)
  - Category (*Cooling, Lighting, Kitchen, Entertainment, Computing, Other*)
  - Nominal Power Rating (Watts)
  - Daily Usage Hours (`0.0` to `24.0` hours)
  - Operating Days per Month (`1` to `31` days)
  - Unit Quantity (Integer $\ge 1$)
- **Live Calculation Preview Modal**: Computes projected daily kWh, monthly kWh, and monthly cost in real time as values are typed into the form.
- **Standard Preset Library**: 16 realistic built-in presets (e.g., BLDC fans, induction cooktops, OLED TVs, microwave ovens, water geysers) for instant auto-filling.
- **Search, Filter & Sort**: Live instant search by appliance name/category, multi-category pill filtering, and sorting by consumption, cost, power, or operational hours.

### 3. Consumption Analytics Engine
- **Multi-Horizon Projections**:
  - **Diurnal (24h)**: Realistic residential load curve modeling morning and evening peak demand.
  - **Weekly Cycle**: 4-week billing progression.
  - **Monthly Horizon**: 6-month projected horizon.
- **Cost Allocation Donut**: Visualizes where currency is allocated per category in INR.
- **Appliance-Wise Ranking**: Horizontal comparative bar chart highlighting top-tier consumers.
- **Granular Consumption Matrix**: Complete tabular ledger itemizing wattage, schedules, monthly kWh, and percentage share.

### 4. Rule-Based Energy Optimization Engine
- **Data-Driven Diagnostics**: Algorithmic assessment based on actual inventory rather than generic static tips:
  - *Dominant Share Alert*: Flags appliances consuming $> 22\%$ of total household electricity.
  - *Extended Run-Time Warning*: Identifies devices with $> 600\text{W}$ running $> 4\text{ hours/day}$.
  - *Thermostat Eco-Optimization*: Calculates savings for cooling appliances operating at baseline 24°C standards ($12\%$ average compressor relief).
  - *Water Heating Schedule*: Advises on pre-bath heating vs. continuous standby cycles.
  - *Solid-State Lighting Retrofits*: Compares installed lighting wattage with modern 9W LED standards.
  - *Vampire / Standby Elimination*: Quantifies residual parasitic draw on entertainment clusters.
- **Transparent Quantified Savings**: Computes exact monthly kilowatt-hours saved, monthly monetary savings in INR, and projected annual financial impact.
- **Clear Utility Disclaimers**: Explicitly notes calculations are mathematical approximations, avoiding unsubstantiated utility guarantees.

### 5. System Settings & Data Portability
- **Adjustable Tariff Engine**: Configure price per unit (₹/kWh) with precision stepper buttons and quick preset buttons (`₹6.50`, `₹8.00`, `₹10.00`, `₹12.50`).
- **Complete JSON Portability**:
  - **Export**: One-click download of timestamped configuration file (`wattwatch-data-YYYY-MM-DD.json`).
  - **Import**: Full schema validation verifying data types, positive power ratings, and hour constraints with informative toast error feedback.
- **Curated Demonstration Dataset**: Instantly populates a realistic 7-appliance household for demonstration and review.
- **Factory Reset**: Safety confirmation dialog to wipe local storage cleanly.

---

## 🧮 Electricity Calculation Engine

WattWatch adheres strictly to standard electrical physics formulas:

### 1. Daily Energy Consumption ($E_{\text{daily}}$)
$$E_{\text{daily}} = \frac{P \times Q \times H_{\text{daily}}}{1000} \quad [\text{kWh}]$$

### 2. Monthly Energy Consumption ($E_{\text{monthly}}$)
$$E_{\text{monthly}} = \frac{P \times Q \times H_{\text{daily}} \times D_{\text{operating}}}{1000} \quad [\text{kWh}]$$

### 3. Estimated Electricity Cost ($C_{\text{monthly}}$)
$$C_{\text{monthly}} = E_{\text{monthly}} \times R_{\text{tariff}} \quad [₹]$$

Where:
- $P$ = Nominal Power Rating in Watts ($\text{W}$)
- $Q$ = Unit Quantity
- $H_{\text{daily}}$ = Daily Active Operating Hours ($0 \le H \le 24$)
- $D_{\text{operating}}$ = Operational Days per Month ($1 \le D \le 31$, default $30$)
- $R_{\text{tariff}}$ = Utility Tariff Rate in Indian Rupees per unit ($₹/\text{kWh}$, default $₹8.00/\text{kWh}$)

*All monetary and energy values are formatted to two decimal places consistently.*

---

## 💻 Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Markup** | HTML5 Semantic Architecture | Standards-compliant, accessible structure (`<nav>`, `<aside>`, `<main>`, `<section>`) with ARIA dialog roles. |
| **Styling** | Vanilla CSS3 (Custom Design System) | Modern CSS custom properties (variables), responsive flexbox and CSS grid layouts, zero CSS frameworks. |
| **Logic** | Vanilla ES6+ JavaScript | Strict modular architecture, zero runtime compilation or bundlers required. |
| **Data Visualizations** | Chart.js v4.4.7 (UMD) | Interactive canvas-based charts utilizing the official royal luxury palette. Bundled locally with fallback. |
| **Persistence** | Web Storage API (`localStorage`) | Secure client-side persistence for appliances, user settings, tariff configurations, and theme preferences. |
| **Vector Assets** | Custom SVG Emblems | Scalable luxury emblem and system icons embedded with zero external icon font dependencies. |

---

## 📂 Project Structure

```
WattWatch-Web/
├── index.html                   # Master single-page application document
├── README.md                    # Comprehensive documentation and portfolio guide
│
├── css/
│   ├── style.css                # Royal luxury design tokens, variables, typography, buttons, toasts
│   ├── dashboard.css            # Component styles: sidebar, metric cards, tables, charts, presets
│   └── responsive.css           # Breakpoints (desktop, tablet, mobile) and drawer transitions
│
├── js/
│   ├── app.js                   # Application controller, view routing, modals, toasts, event bindings
│   ├── calculations.js          # Core electrical physics math engine and currency formatters
│   ├── appliances.js            # Appliance CRUD, input validation, live preview, presets, filters
│   ├── charts.js                # Chart.js instances, color schemas, responsive resizing, empty states
│   ├── storage.js               # LocalStorage management, schema validator, JSON import/export
│   ├── recommendations.js       # Rule-based diagnostic algorithms for quantified energy conservation
│   └── chart.umd.min.js         # Production Chart.js v4 bundle for 100% offline local execution
│
└── assets/
    └── logo.svg                 # Custom SVG luxury geometric shield and energy lightning crest
```

---

## 🚀 Installation & Local Execution

WattWatch does not require Node.js, npm, compilers, or server processes. It is completely portable and operates locally directly in any modern browser.

### Option 1: Direct File Launch
1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-username/WattWatch-Web.git
   ```
2. Navigate into the folder:
   ```bash
   cd WattWatch-Web
   ```
3. Open `index.html` directly in your preferred web browser:
   - **Windows**: Double-click `index.html` or run `start index.html`
   - **macOS**: `open index.html`
   - **Linux**: `xdg-open index.html`

### Option 2: Local Static Server (Optional)
If you prefer serving over a local development server:
```bash
# Using Python 3
python -m http.server 8080

# Using Node npx
npx serve .
```
Then navigate to `http://localhost:8080` in your browser.

---

## 🧪 Quality Control & Verification Matrix

The application has been verified against the 16 core test cases:

| Test ID | Verification Scope | Status | Notes |
| :---: | :--- | :---: | :--- |
| **TC-01** | Adding an appliance | ✅ PASSED | Validates inputs, renders live cost preview, stores to localStorage, updates all views. |
| **TC-02** | Editing an appliance | ✅ PASSED | Pre-populates modal inputs, preserves ID, updates calculations across views. |
| **TC-03** | Deleting an appliance | ✅ PASSED | Triggered via custom confirmation dialog, re-aggregates totals, updates badge counts. |
| **TC-04** | Multiple appliance calculations | ✅ PASSED | Verified against independent arithmetic equations; accurately handles mixed quantities. |
| **TC-05** | Electricity rate changes | ✅ PASSED | Immediate reactive recalculation across summary cards, analytics charts, and tips. |
| **TC-06** | Daily consumption calculations | ✅ PASSED | Accurate formulas: $(W \times Q \times H)/1000$, formatted to 2 decimals. |
| **TC-07** | Monthly consumption calculations | ✅ PASSED | Accurate formulas: $(W \times Q \times H \times D)/1000$, formatted to 2 decimals. |
| **TC-08** | Dashboard updates | ✅ PASSED | Instantaneous updates to 4 metric cards and primary load spotlight. |
| **TC-09** | Charts & filtering | ✅ PASSED | Dynamic redraw of 5 interactive charts; category filters and search execute seamlessly. |
| **TC-10** | LocalStorage persistence | ✅ PASSED | All appliances, active rate, and theme restored flawlessly on browser refresh. |
| **TC-11** | JSON export & import | ✅ PASSED | Validates payload structure, checks positive values, rejects corrupted files safely. |
| **TC-12** | Invalid input handling | ✅ PASSED | Inline error messages displayed for $W \le 0$, hours $> 24$, and empty names. |
| **TC-13** | Mobile responsiveness | ✅ PASSED | Off-canvas sliding drawer, touch targets $\ge 44\text{px}$, responsive charts, zero horizontal overflow. |
| **TC-14** | Empty states | ✅ PASSED | Custom luxury empty states displayed when 0 appliances match or exist. |
| **TC-15** | Navigation between sections | ✅ PASSED | Smooth tab switching across Overview, Appliances, Analytics, Tips, and Settings. |
| **TC-16** | Theme switching | ✅ PASSED | Royal Beige Light Mode (default) and Royal Dark Mode switch with full chart palette adaptation. |

---

## ⚠️ Known Limitations & Assumptions

1. **Utility Tariff Simplicity**: Utility bills often feature stepped slab tariffs (e.g., ₹4.50 for first 100 units, ₹7.50 for next 200 units), fixed meter rents, and municipal electricity duty. WattWatch intentionally uses a single flat rate per unit ($₹/\text{kWh}$) to maintain transparency without making arbitrary assumptions regarding local state regulations.
2. **Duty Cycles**: Certain appliances like refrigerators and inverter air conditioners cycle their compressors depending on ambient weather conditions. The calculation engine accepts nominal effective active hours or rated compressor hours.
3. **Local Storage Bound**: Persistence is tied to the specific browser profile. For multi-device synchronization, use the JSON Export/Import feature.

---

## 🔮 Future Enhancements

- [ ] **Multi-Tier Slab Tariff Calculator**: Optional user-configurable progressive billing slabs (e.g. 0-100 units, 101-300 units, 301+ units).
- [ ] **Solar PV Offsetting Calculator**: Model potential rooftop solar generation (in kWp) to calculate net zero utility offset.
- [ ] **PDF Executive Energy Report**: Client-side formatted PDF generation suitable for printing household energy audits.
- [ ] **Multi-Room Grouping**: Group appliances by location (Master Bedroom, Kitchen, Home Office, Living Room).

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

*Crafted with precision for modern energy intelligence.*
