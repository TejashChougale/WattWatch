# WattWatch ⚡

### Advanced Electricity Management & Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-B99A62.svg)](https://opensource.org/licenses/MIT)
[![Pure Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-172B55.svg)](#technology-stack)
[![Chart.js v4](https://img.shields.io/badge/Visuals-Chart.js%20v4-6E293F.svg)](https://www.chartjs.org/)
[![Audit Test Suite](https://img.shields.io/badge/Audit%20Tests-474%2F474%20Passed-2E946E.svg)](#-automated-testing--quality-assurance)
[![Responsive Verification](https://img.shields.io/badge/Responsive-20%2F20%20Passed-2E946E.svg)](#-automated-testing--quality-assurance)

> **WattWatch** is an enterprise-grade client-side energy intelligence platform. It provides comprehensive household electricity monitoring, frozen historical monthly billing snapshots, an active electricity budget tracker, month-to-month comparative deltas, an interactive appliance replacement simulator, an advanced progressive multi-slab tariff engine, a carbon footprint estimator, and client-side PDF energy audit reports.

---

## 🏛️ Visual Identity & Modern Typography

WattWatch pairs a refined, editorial color palette inspired by high-end financial dashboards with a modern, high-legibility typographical hierarchy.

### Typography Hierarchy

* **Heading Typography (`--font-heading`)**: **Manrope** — geometric, modern sans-serif optimized for clear metric scannability and structural headers.
* **Body Typography (`--font-sans`)**: **Inter** — precision engineered for user interfaces, exceptional legibility at small sizes, and tabular numeral alignment.
* **Legacy Serif Token (`--font-serif`)**: Aliased directly to `--font-heading` (`Manrope`) to ensure 100% backwards compatibility without serif rendering artifacts.

### Official Color Tokens

| Token | Name | Hex Code | Purpose & Application |
| :--- | :--- | :--- | :--- |
| **Royal Blue** | `--royal-blue` | `#172B55` | Primary navigation, card headers, primary CTA buttons |
| **Warm Beige** | `--warm-beige` | `#F0E5D0` | Primary ambient page background (Light Theme - Default) |
| **Deep Burgundy** | `--deep-burgundy` | `#6E293F` | Financial statistics, cost metrics, peak load indicators |
| **Antique Gold** | `--antique-gold` | `#B99A62` | Architectural borders, status badges, active tab indicators |
| **Cream White** | `--cream-white` | `#FAF7F0` | Elevated card surfaces, form input containers |
| **Muted Slate** | `--muted-slate` | `#687386` | Secondary typography, metadata, chart axis labels |
| **Soft Blue** | `--soft-blue` | `#E5EAF2` | Secondary highlight surfaces, badge backgrounds |
| **Light Burgundy**| `--light-burgundy`| `#F2E5E8` | Warning badges, high-impact highlight surfaces |

*Includes an optional, finely tuned **Royal Dark Mode** (`#0D1628` midnight blue with antique gold highlights).*

---

## ⚙️ Architecture & Security Model

WattWatch is built entirely with pure vanilla web technologies: standard HTML5, CSS3, and ES6 JavaScript modules with zero build tools, compilers, or server-side frameworks.

```
┌─────────────────────────────────────────────────────────────────┐
│                      WattWatch Single-Page App                  │
├──────────────────────────────┬──────────────────────────────────┤
│         Guest Mode           │    Authenticated Account Mode    │
│  (Default local workspace)   │ (Firebase Auth: email/password)  │
├──────────────────────────────┼──────────────────────────────────┤
│ LocalStorage:                │ LocalStorage:                    │
│ • wattwatch_appliances       │ • wattwatch_user_{uid}_appliances│
│ • wattwatch_history_v1       │ • wattwatch_user_{uid}_history   │
│ • wattwatch_settings         │ • wattwatch_user_{uid}_settings  │
└──────────────────────────────┴──────────────────────────────────┘
```

### 1. Authentication & Workspace Isolation
* **Explicit Startup Authentication Gate**: On initial application load, an authentication modal appears requiring the user to explicitly select an action:
  * **Sign In / Create Account**: Authenticates with Firebase and unlocks the user's private workspace.
  * **Continue as Guest**: Activates the isolated local guest workspace.
* **No Accidental Gate Bypass**: The startup authentication gate cannot be dismissed by pressing `Escape`, clicking the backdrop, or clicking modal close buttons. Background controls are inaccessible until an explicit choice is made.
* **Focus Trap & Keyboard Accessibility**: A full `Tab` / `Shift+Tab` keyboard focus trap cycles focus inside the active modal; Escape dismisses only once a valid session exists. The HTML5 `inert` property and `aria-hidden` are applied to the background application layout while modals are open, fully restoring interactivity upon dismissal.
* **Strict Workspace Isolation**: Guest data is stored under default keys (`wattwatch_appliances`, `wattwatch_settings`, `wattwatch_history_v1`). Authenticated accounts store their records under isolated keys (`wattwatch_user_{uid}_*`). Switching accounts or reverting to guest mode never leaks or overwrites records.
* **Guest-to-Account Migration**: When creating or logging into an account, users can merge local guest records into their account workspace. The migration is non-destructive, duplicate-safe (skips existing records without overwriting), idempotent, and includes atomic rollback on storage quota failure.

### 2. Security & Data Integrity Protections
* **Stored XSS Neutralization**: User-controlled inputs (appliance names, categories, billing periods) are strictly sanitized and HTML-escaped. The DOM uses `textContent` and safe element construction. All table actions use delegated event listeners (`data-action`, `data-id`) with zero inline `onclick` attributes.
* **Spreadsheet Formula Injection (CSV Injection) Protection**: Neutralizes dangerous spreadsheet formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) by prefixing unquoted text with a single quote (`'`), while leaving legitimate negative numbers (`-15.5`) uncorrupted. All CSV exports prepend a UTF-8 BOM (`\uFEFF`) for seamless character rendering in Microsoft Excel and spreadsheet software.
* **Atomic Backup Import & Restoration**: Importing JSON backups captures an in-memory snapshot of current appliances, history, and settings before writing. If storage quota is exceeded or an I/O error occurs, the pre-import state is automatically restored, and the user is honestly informed whether restoration succeeded.
* **Corrupted LocalStorage Recovery**: Malformed JSON in browser storage is detected safely without crashing the dashboard. The raw corrupted string is preserved under a quarantine key (`wattwatch_corrupted_${timestamp}_${key}`), while the application initializes a clean fallback state and warns the user.
* **Strict Domain Validation**: Appliance additions enforce integer quantities $\ge 1$, category whitelisting (`Cooling`, `Lighting`, `Kitchen`, `Entertainment`, `Computing`, `Other`), realistic power bounds ($\le 50,000$ W), daily operating hours ($0 \le h \le 24$), and operating days ($1 \le d \le 31$).
* **Content Security Policy & Subresource Integrity**: A client-side CSP meta policy restricts script, style, image, and network connect origins, completely disallowing dynamic code evaluation (`unsafe-eval`). Because WattWatch uses static vanilla HTML with declarative event attributes and dynamic utility styling, `'unsafe-inline'` is permitted, representing an origin boundary rather than a strict nonce/hash-only sandbox. Chart.js CDN fallbacks include cryptographic Subresource Integrity (`integrity="sha384-..."`) and `crossorigin="anonymous"` verification.

---

## 🚀 Key Modules & Capabilities

### 1. Appliance Management & Inventory Control
* **Inventory Management**: Create, edit, and delete household appliances with live power and cost preview calculations.
* **Category Filtering & Live Search**: Filter by appliance category or search by name with responsive UI updates.
* **Remove All Appliances**: A dedicated bulk-deletion option that prompts an intentional confirmation displaying the exact number of appliances to be removed. History snapshots and custom tariff settings are completely preserved. Workspace isolation guarantees that clearing account inventory never impacts guest records, and vice versa.

### 2. Monthly Electricity Bill History & Snapshots
* **Frozen Immutable Snapshots**: Captures the complete household state for any billing cycle (e.g., `2026-11` / November 2026), freezing consumed units, costs, applied tariffs, and individual appliance breakdowns.
* **Historical Highlights**: Automatically detects peak and lowest recorded monthly bills.
* **Snapshot Inspector**: Deep-inspection modal displaying the frozen appliance inventory captured at the time of the snapshot.
* **Chronological Trend Graph**: Dynamic multi-month line visualization showing the progression of consumed units and billed charges.

### 3. Electricity Budget Tracker
* **Configurable Allowance**: Set a monthly budget in INR (₹) within Settings or directly from the dashboard.
* **Dynamic Progress Indicator**: Color transitions across safety tiers: Safe ($< 75\%$), Caution ($75\% - 89.9\%$), Critical ($90\% - 99.9\%$), and Exceeded ($\ge 100\%$).
* **Threshold Notifications**: Toast alerts when spending crosses the 75%, 90%, and 100% threshold boundaries.

### 4. Month-to-Month Comparative Analytics
* **Bi-Period Delta Engine**: Select and compare any two historical billing snapshots (Baseline Period A vs. Target Period B).
* **Metric Variances**: Quantifies energy delta ($\Delta \text{kWh}$, $\% \Delta \text{kWh}$) and financial delta ($\Delta ₹$, $\% \Delta ₹$).
* **Zero-Division Protection**: Robust mathematical fallbacks prevent runtime exceptions when comparing periods with zero baseline consumption.

### 5. Advanced Electricity Tariff Engine & Sandbox
* **Dual Tariff Architecture**:
  * **Flat Tariff**: Standard uniform rate per unit (default ₹8.00 / kWh).
  * **Progressive Multi-Slab Tariff**: Configurable tiered limits and slab rates (e.g., 0–100 kWh @ ₹4.50, 101–300 kWh @ ₹7.50, >300 kWh @ ₹10.00).
* **Excess Consumption Allocation**: When total consumption exceeds the highest slab tier, excess energy is accurately billed at the highest tier rate and reported as `Excess above X kWh` in the breakdown.
* **Fixed Charges & Taxes**: Incorporates monthly meter rent/sanctioned load charges and percentage-based electricity duty/surcharges.
* **Tariff Sandbox**: Test hypothetical monthly consumption figures in real time with a slab-by-slab breakdown.

### 6. Appliance Replacement Simulator & ROI Payback
* **Interactive Model Comparison**: Select any existing appliance and compare it against an energy-efficient alternative.
* **Differential Math**: Computes exact monthly energy conservation (kWh), financial savings (₹), annual savings, and percentage reduction.
* **ROI Payback Period Estimator**: Enter prospective purchase cost in INR to instantly calculate the break-even timeframe in months.

### 7. Carbon Footprint Estimator
* **Quantified Environmental Impact**: Translates electrical consumption into estimated greenhouse gas emissions ($\text{kg CO}_2\text{e}$ and Metric Tons).
* **Configurable Grid Factor**: User-customizable carbon intensity factor ($\text{kg CO}_2/\text{kWh}$, default $0.82$).
* **Urban Tree Offsetting Metric**: Calculates the estimated number of mature trees required to sequester annual household electrical emissions (assuming $21.77\text{ kg CO}_2/\text{year}$ per tree).

### 8. Client-Side PDF Monthly Audit Report Generator
* **Executive Document Formatting**: Formats a print-ready executive report with logo, metadata, KPI strip, appliance breakdown table, budget status, and recommendations.
* **Zero Heavy Dependencies**: Uses high-fidelity `@media print` rules for browser-native "Save as PDF" generation.

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

## 🔒 Cloud Firestore Security Rules

WattWatch integrates with Firebase Authentication and Cloud Firestore for user profiles. The repository includes `firestore.rules` and `firebase.json` enforcing strict owner-only access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    function isValidUserProfile(data) {
      return data.keys().hasAll(['username', 'displayName'])
        && data.username is string
        && data.username.size() >= 3
        && data.username.size() <= 30
        && data.displayName is string
        && data.displayName.size() >= 1
        && data.displayName.size() <= 50
        && (!('hasImportedGuestData' in data) || data.hasImportedGuestData is bool);
    }

    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId) && isValidUserProfile(request.resource.data);
      allow update: if isOwner(userId) && isValidUserProfile(request.resource.data)
        && request.resource.data.username == resource.data.username;
      allow delete: if isOwner(userId);
    }

    // Default deny for all other collections and documents
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Deployment Instructions

#### Method 1: Deploying via Firebase CLI (Recommended)
1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in with your Google account:
   ```bash
   firebase login
   ```
3. Set your active Firebase project:
   ```bash
   firebase use <your-firebase-project-id>
   ```
4. Deploy the Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

#### Method 2: Deploying via the Firebase Console
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your WattWatch Firebase project.
3. In the left navigation, navigate to **Build** → **Firestore Database**.
4. Click the **Rules** tab at the top of the database dashboard.
5. Replace the editor contents with the code from `firestore.rules`.
6. Click **Publish**.

### Verification Steps (Rules Playground)
In the Firebase Console **Rules** tab, click **Rules Playground** to verify:
1. **Authenticated Owner Access (Allowed)**:
   * Operation: `get` or `create`
   * Location: `/users/test_user_123`
   * Check **Authenticated** with UID `test_user_123`.
   * Click **Run** → Should output `Simulated read/write allowed`.
2. **Unauthenticated Access (Denied)**:
   * Uncheck **Authenticated**.
   * Location: `/users/test_user_123`
   * Click **Run** → Should output `Simulated read/write denied`.
3. **Cross-User Access (Denied)**:
   * Check **Authenticated** with UID `attacker_uid`.
   * Location: `/users/victim_uid`
   * Click **Run** → Should output `Simulated read/write denied`.

---

## ⚠️ Data Persistence & Limitations

1. **Local Browser Storage**: WattWatch operates as a client-side application. Appliance inventory, tariff settings, and billing snapshots are saved directly to the browser's `localStorage`.
2. **No Real-Time Cloud Synchronization**: **Cross-device cloud synchronization is not implemented.** An account signed into Browser A will not automatically sync appliances or snapshots to Browser B. Data must be transferred between devices using the built-in JSON Backup Export and Import features.
3. **Synthetic Username Authentication**: User accounts use synthetic email identities (`username@wattwatch.local`) with Firebase Authentication. Because these addresses cannot receive incoming mail, automated out-of-band password reset emails cannot be delivered. The password recovery modal transparently informs users of this limitation.

---

## 🧪 Automated Testing & Quality Assurance

WattWatch features a comprehensive, automated test harness designed to run directly in modern web browsers or headless environments.

### 1. Test Suite Overview

| Test Suite | File Path | Total Tests | Passed | Failed | Scope |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Audit Test Suite** | [`tests/audit_tests.html`](tests/audit_tests.html) | **474** | **474** | **0** | Energy formulas, tariff slabs, budget tracking, CSV injection, atomic JSON rollback, theme export/import rollback, focus trap & modal stacking manager, Remove All Appliances, stored XSS, corrupted storage recovery, workspace isolation, CSP meta verification, Chart.js SRI integrity, and Firebase asynchronous sign-out resilience. |
| **Responsive Verification** | [`tests/responsive_verification.html`](tests/responsive_verification.html) | **20** | **20** | **0** | Mobile viewports (320px, 360px, 390px), tablet (768px), desktop (1024px, 1366px), zero overflow across all 7 views and both light and dark themes, touch targets ($\ge 44\text{px}$), font sizes ($\ge 16\text{px}$), modal bottom sheets. |

### 2. Isolated Test Execution
The test suite utilizes a dedicated `testNamespace` (`wattwatch_audit_test_`). Running tests will **never overwrite, modify, or erase real user or guest data** in `localStorage`. Once execution completes, all test keys are cleaned up, and the suite asserts that production keys remain completely untouched.

### 3. How to Run the Tests

#### In Any Browser (Interactive UI)
Simply double-click or open the test files in your browser:
* Open `tests/audit_tests.html` to run the 474-test audit suite.
* Open `tests/responsive_verification.html` to run the 20-test responsive layout verification suite.

#### In Headless Chrome (CLI / Automated CI)
```powershell
# Run Audit Test Suite
$proc = Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", `
  "--dump-dom", "file:///E:/GitHub%20Projects/Wattwatch%20web/tests/audit_tests.html" `
  -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\audit_results.html"
$proc.WaitForExit(10000)
Get-Content "$env:TEMP\audit_results.html" | Select-String -Pattern "TEST_RESULTS:.*"

# Run Responsive Verification Suite
$proc = Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", `
  "--dump-dom", "file:///E:/GitHub%20Projects/Wattwatch%20web/tests/responsive_verification.html" `
  -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\resp_results.html"
$proc.WaitForExit(10000)
Get-Content "$env:TEMP\resp_results.html" | Select-String -Pattern "RESPONSIVE_VERIFY:.*"
```

---

## 📂 Project Structure

```
WattWatch-Web/
├── index.html                   # Master single-page application document
├── README.md                    # Comprehensive architecture, security, and verification documentation
├── LICENSE                      # MIT Open Source License
├── firebase.json                # Firebase configuration mapping for Firestore rules
├── firestore.rules              # Owner-only Cloud Firestore security rules
│
├── css/
│   ├── style.css                # Visual identity, typography (Manrope & Inter), buttons, toasts, modals
│   ├── dashboard.css            # Component styles: sidebar, budget card, history, simulator, print
│   └── responsive.css           # Responsive breakpoints (320px–1366px), bottom sheets, touch targets
│
├── js/
│   ├── app.js                   # Application controller, view routing, modals, toasts, event delegation
│   ├── calculations.js          # Energy formulas, multi-slab tariff excess allocation, budget, carbon
│   ├── appliances.js            # Appliance CRUD, Remove All, validation, live preview, presets, filters
│   ├── history.js               # Historical snapshot management, bi-period comparisons, details modal
│   ├── simulator.js             # Replacement simulator and advanced tariff calculator sandbox
│   ├── report.js                # Monthly executive audit report & client-side PDF generator
│   ├── charts.js                # Chart.js instances, color schemas, responsive resizing, empty states
│   ├── storage.js               # LocalStorage management, testNamespace, atomic JSON rollback, CSV export
│   ├── auth.js                  # Firebase Auth, startup gate, focus trap, session resume, guest migration
│   ├── recommendations.js       # Rule-based diagnostic algorithms for quantified energy conservation
│   └── chart.umd.min.js         # Production Chart.js v4 bundle for 100% offline local execution
│
├── tests/
│   ├── audit_tests.html         # Automated 474-assertion audit test suite
│   └── responsive_verification.html # Automated 20-check responsive layout verification suite
│
└── assets/
    └── logo.svg                 # Custom SVG geometric shield and energy lightning crest
```

---

## 🚀 How to Run the Application

WattWatch requires no build steps, compilers, or server processes:

1. Open [`index.html`](index.html) directly in any modern browser (Chrome, Edge, Firefox, Safari) or serve via any static HTTP server.
2. The authentication modal will prompt you to Sign In, Create an Account, or Continue as Guest.
3. Explore the dashboard, manage appliances, analyze historical billing records, test tariff slabs, and generate executive energy reports.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

*WattWatch — Precision Energy Intelligence.*
