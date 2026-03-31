# PRD-Update: Prosperus Club — Corporate Training Dashboard v2.0

> **Document Owner:** Lead Architect / Sr. Technical PM
> **Version:** 2.0 — February 13, 2026
> **Repository:** `curso-dashboard`
> **Brand:** Prosperus Club
> **Status:** DRAFT — Pending Stakeholder Review

---

## 1. Executive Summary

The **Prosperus Club Corporate Training Dashboard** processes five CSV files to generate **per-company HTML dashboards** that are delivered individually to each company leader — ensuring **data privacy** (Company A never sees Company B's data). The generated HTML files are then imported into a **PWA application** for in-app viewing or downloading.

### Core Business Requirement

> Each company leader receives **only their own company's dashboard** via a web link (HTML). The output files are imported into an existing PWA that handles distribution. There is no cross-company visibility.

### Current State vs. Target State

| Dimension | Current | Target |
|---|---|---|
| **Architecture** | Monolithic single-file (`App.tsx` — 2,302 lines) | Modular components with clear separation of concerns |
| **Deployment** | `npm run dev` on localhost | **Netlify via `dist/` folder** — accessible as a website |
| **Branding** | Generic blue/gray Vite defaults | **Prosperus Club brand** — Midnight Blue, Gold, Manrope font |
| **Mobile** | Desktop-only; horizontal scroll on tables | **Mobile-first; tables compacted to card view, zero horizontal scroll** |
| **Export Control** | Bulk export only (all companies at once) | **Selective export** — pick which companies to generate |
| **Output Naming** | `Dashboard_{CompanyName}.html` | **`{first-email-from-referencia}.html`** (e.g., `roberto@colegioprogresso.g12.br.html`) |
| **Delivery** | ZIP download | HTML files imported into **PWA app** for web-link delivery |
| **User Detail** | Basic modal (access count + 5 last lessons) | **Rich profile** — content viewed, entry date, full history |
| **Testing** | Zero coverage | Vitest (unit) + Playwright (E2E) |

---

## 2. Codebase Audit — Key Findings

### 2.1 Critical Technical Debt

| # | Issue | Severity | Impact |
|---|---|---|---|
| 1 | **God Component** — All 2,302 lines in a single `Dashboard()` function | 🔴 Critical | Untestable, unmaintainable |
| 2 | **Duplicated Metrics Logic** — `useMemo(metricas)` fully duplicated in `calculateCompanyMetrics()` | 🔴 Critical | Bug fixes must be applied in 2 places |
| 3 | **Duplicated `pickContentKey()`** — Same function at L700 and L1606 | 🟡 Medium | Maintenance burden |
| 4 | **HTML String Concatenation** — 200+ lines of raw HTML building for export | 🟡 Medium | XSS risk, no type safety, no brand consistency |
| 5 | **Runtime CDN Script Injection** — JSZip loaded via `document.createElement('script')` | 🟡 Medium | Fragile; breaks offline |
| 6 | **No TypeScript Strictness** — `any` types everywhere, no CSV row interfaces | 🟡 Medium | Runtime errors on malformed data |
| 7 | **No Error Boundaries** — Parsing error crashes entire app | 🟡 Medium | Poor UX |
| 8 | **Default Vite CSS** — `App.css` and `index.css` are boilerplate from scaffolding | 🟢 Low | Dead code |
| 9 | **CSS Injected via JS** — Scrollbar styles via `useEffect` + `createElement('style')` | 🟢 Low | Should be in CSS files |

### 2.2 Data Flow

```
CSV Files → PapaParse → email→empresa mapping (referencia.csv)
  → Enriched dataset → Filter by company → Compute metrics
  → Render in-app (Recharts) + Generate standalone HTML (Chart.js)
```

### 2.3 CSV Schema

| File | Key Columns | Role |
|---|---|---|
| `referencia.csv` | `Nome`, `Cel`, `Email`, `Empresa`, `Programa`, `PC`, `Observações` | Master reference — maps email → company. **First email per company = output filename** |
| `acessos.csv` | `Nome`, `Email`, `Data` | Platform access log |
| `conclusoes.csv` | `Nome`, `Email`, `CPF`, `Conteúdo`, `Módulo`, `Nome da aula`, `Data de conclusão` | Lesson/module completions |
| `progresso.csv` | `Nome`, `Email`, `CPF`, `Situação do membro`, `Progresso` | User progress percentage |
| `ultimo_acesso.csv` | `Nome`, `Email`, `Último acesso`, `Situação` | Last access info |

---

## 3. Prosperus Club Brand Application

All UI surfaces (the generator tool AND the exported dashboards) must follow the Prosperus Club brand identity:

### 3.1 Color System

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-primary` | `#031A2B` (Midnight Blue) | Primary background / canvas |
| `--color-bg-secondary` | `#123F5B` (Medium Navy) | Cards, panels, secondary surfaces |
| `--color-accent` | `#FFDA71` (Vibrant Gold) | Highlights, CTAs, key metrics |
| `--color-accent-light` | `#FFE39B` (Pale Gold) | Gradient highs, hover states |
| `--color-accent-dark` | `#CA9A43` (Antique Gold) | Text on light bg, gradient shadows |
| `--color-text-primary` | `#EDF4F7` (Cool White) | Body text on dark backgrounds |
| `--color-text-secondary` | `#FCF7F0` (Warm Cream) | Subtle text, descriptions |
| `--color-surface-light` | `#EDF4F7` | Light-mode fallback surfaces |
| `--color-black` | `#080808` (Rich Black) | High-contrast text |

### 3.2 Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| **Headlines** | **Manrope** (Google Fonts) | 600–800 | Titles, KPI values, section headers |
| **Body/Formal** | **Adobe Garamond Pro** (fallback: `Georgia, serif`) | 400–500 | Descriptive text, table content, reports |

### 3.3 Visual Principles

- **Luxury minimalist** aesthetic — generous whitespace, high contrast
- **Gold on Dark** as the dominant pattern
- Subtle gold gradients (`#CA9A43` → `#FFDA71` → `#FFE39B`) for progress bars and accents
- Geometric touches inspired by the Φ monogram in decorative elements

---

## 4. Deployment Strategy: Netlify via `dist/`

### 4.1 Build & Deploy

| Step | Command | Output |
|---|---|---|
| Build | `npm run build` | Generates `dist/` folder |
| Deploy | Push `dist/` to Netlify (Git integration or `netlify deploy --prod --dir=dist`) | Live website URL |

### 4.2 Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 4.3 User Flow (Post-Deploy)

```
User visits Netlify URL → Uploads CSVs in-browser → Selects companies
  → Generates dashboards → Downloads selected HTML files
  → Imports HTML into PWA app → Company leader views via PWA link
```

> [!IMPORTANT]
> All CSV processing happens **client-side in the browser**. No data leaves the user's machine — the Netlify site is purely a static SPA. This is critical for data privacy.

---

## 5. Functional Requirements

### 5.1 Selective Company Export

**Current:** Bulk export — always generates dashboards for ALL companies in the ZIP.

**New Behavior:**

| Feature | Description |
|---|---|
| **Company Selector Panel** | After processing CSVs, show a checklist of all detected companies with select-all / deselect-all |
| **Individual Export** | Click a company → generates & downloads `{first-email}.html` immediately |
| **Batch Export** | Select multiple companies → downloads a ZIP containing only selected companies |
| **Preview Before Export** | Click "Preview" next to any company to see the dashboard in-app before exporting |

This eliminates the need to clean spreadsheets before importing — the user can import all data and selectively choose which companies to extract.

### 5.2 Output File Naming Convention

| Rule | Example |
|---|---|
| Take the **first email** listed in `referencia.csv` for the company | Colégio Progresso → first email: `roberto@colegioprogresso.g12.br` |
| Output filename = `{email}.html` | `roberto@colegioprogresso.g12.br.html` |
| For batch ZIP, the ZIP itself stays named with a date | `Dashboards_2026-02-13.zip` |

**Implementation:** When processing `referencia.csv`, the first occurrence of each `Empresa` value determines that company's filename:
```typescript
const companyFirstEmail: Record<string, string> = {};
referencia.forEach(row => {
  if (row.Empresa && row.Email && !companyFirstEmail[row.Empresa]) {
    companyFirstEmail[row.Empresa] = row.Email.toLowerCase().trim();
  }
});
// Output: { "Colégio Progresso": "roberto@colegioprogresso.g12.br", ... }
```

### 5.3 Mobile-First Responsive Design (No Horizontal Scroll)

> [!IMPORTANT]
> Tables must **never** produce horizontal scroll on mobile. Instead, they transform into card-style layouts.

#### Mobile Table Strategy (< 640px)

**Collaborator Ranking Table → Stacked Cards:**
```
┌─────────────────────────────────┐
│ #1  Roberto                     │
│ roberto@colegioprogresso.g12.br │
│ ┌──────────┐ ┌──────────┐      │
│ │ 42 acess │ │ 18 concl │      │
│ └──────────┘ └──────────┘      │
│                    [Detalhes →] │
└─────────────────────────────────┘
```

**Progress Table → Compact Cards:**
```
┌─────────────────────────────────┐
│ Roberto                         │
│ Curso: Marketing Digital        │
│ ████████████░░░░░░  67%         │
└─────────────────────────────────┘
```

#### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| **< 640px** | Single column. KPIs as 2×2 grid. Tables → cards. Charts full-width with `aspect-ratio` |
| **640–1024px** | 2-column grid. Tables remain tabular with compact columns |
| **> 1024px** | Full desktop layout (similar to current, with brand refinements) |

**Touch targets:** ≥ 44px (WCAG 2.5.5). No horizontal scroll anywhere.

### 5.4 Enhanced User Detail View

The current user detail modal shows: name, email, access count, lessons completed, last access, and 5 most recent lessons.

**New User Detail Panel** (slide-over, not modal):

| Section | Data Shown | Source |
|---|---|---|
| **Profile Header** | Name, email, company, entry date (`Data de conclusão` first occurrence), member status | `referencia.csv`, `progresso.csv`, `conclusoes.csv` |
| **Engagement KPIs** | Total accesses, total lessons completed, days since last access, engagement score | `acessos.csv`, `conclusoes.csv`, `ultimo_acesso.csv` |
| **Content Viewed** | Full list of courses/content accessed with individual progress bars | `conclusoes.csv`, `progresso.csv` |
| **Module Breakdown** | Per-course module list with completion status | `conclusoes.csv` |
| **Access Timeline** | Chart showing access frequency over time + day-of-week pattern | `acessos.csv` |
| **Full Completion History** | All lessons completed (not just last 5), sortable by date | `conclusoes.csv` |
| **Contact Info** | Phone number (`Cel`), program (`Programa`), observations (`Observações`) | `referencia.csv` |

### 5.5 Interactivity Specifications

#### Global Filter Bar (Dashboard View)

| Filter | Type | Behavior |
|---|---|---|
| **Company** | Multi-select dropdown with search | Filter all data to selected companies |
| **Date Range** | Date picker (from — to) | Filter `acessos` and `conclusoes` by date |
| **User Status** | Toggle (Active / Inactive / All) | Quick-filter based on access count |
| **Search** | Global text search | Searches across all tables simultaneously |

#### Table Interactivity

| Feature | Behavior |
|---|---|
| **Column Sorting** | Click header to toggle asc/desc (already partially exists — extend) |
| **In-line Search** | Debounced search with highlight across all tables |
| **CSV Re-export** | Export current filtered view as CSV |

### 5.6 Exported HTML Dashboard Improvements

The per-company HTML files (delivered via PWA) must also be branded and mobile-responsive:

| Aspect | Current | Target |
|---|---|---|
| **Branding** | Generic gray/blue | Prosperus Club brand (Midnight Blue + Gold + Manrope) |
| **Mobile** | Desktop-only, horizontal scroll | Responsive; tables → cards on mobile |
| **Charts** | Chart.js (basic line chart) | Chart.js with brand colors + access heatmap |
| **User Data Depth** | Basic ranking table | Enhanced table with progress, status indicators |
| **File Size** | Self-contained (Chart.js CDN) | Self-contained; all CSS inline; Chart.js via CDN |

> [!NOTE]
> PDF export is **not** in scope. Delivery is exclusively via HTML files imported into the PWA app for web-link access or download.

---

## 6. Tech Stack Recommendations

### 6.1 Retain & Upgrade

| Layer | Current | Action |
|---|---|---|
| React 19 + Vite 7 | ✅ Keep | Already modern |
| TypeScript ~5.8 | ✅ Keep; enable `strict: true` | Catch bugs early |
| PapaParse 5.5 | ✅ Keep | Mature CSV parser |
| Recharts | ✅ Keep (in-app charts) | Already working |
| Lodash | Migrate to `lodash-es` | Tree-shakeable, ~60 KB savings |

### 6.2 Add

| Library | Purpose |
|---|---|
| **TailwindCSS v4** | Utility-first CSS; responsive out-of-box; custom design tokens for Prosperus brand |
| **Zustand v5** | Lightweight state for filters, selections, export queue |
| **date-fns v4** | Replace manual date parsing with locale-aware (`pt-BR`) helpers |
| **TanStack Table v8** | Virtual scrolling, sorting, filtering — with mobile card-view adapter |
| **JSZip** (npm install) | Replace CDN script injection with proper dependency |
| **Vitest v3** | Unit testing — native Vite integration |
| **Playwright v1.50** | E2E testing — CSV upload simulation, mobile viewport tests |

### 6.3 Remove

| Item | Reason |
|---|---|
| Chart.js CDN in runtime app | Keep only for exported HTML; in-app uses Recharts |
| Runtime JSZip CDN injection | Install via npm |
| `App.css` / `index.css` boilerplate | Replace with TailwindCSS + brand tokens |
| **PDF export (jsPDF, html2canvas)** | Out of scope — delivery is web-link via PWA |

---

## 7. DX (Developer Experience) Improvements

### 7.1 Netlify-Ready Build Pipeline

```bash
# Development
npm run dev          # Vite HMR on localhost:5173

# Production
npm run build        # TypeScript check + Vite build → dist/
npm run preview      # Preview production build locally

# Deploy
# Option A: Netlify Git integration (auto-deploys on push)
# Option B: netlify deploy --prod --dir=dist
```

### 7.2 Linting & Formatting

| Tool | Purpose |
|---|---|
| ESLint (upgrade to `strictTypeChecked`) | Type-aware lint rules |
| Prettier + `prettier-plugin-tailwindcss` | Code formatting + Tailwind class ordering |
| Husky + lint-staged | Pre-commit hooks |

### 7.3 CI/CD (GitHub Actions)

```
Push → Lint → TypeCheck → Vitest → Build → Playwright → Netlify Deploy
```

---

## 8. Implementation Roadmap

### Phase 1: Architecture + Branding + Deployment (Weeks 1–3)

> **Goal:** Decompose the monolith, apply Prosperus Club brand, deploy to Netlify, achieve mobile responsiveness.

| # | Task | Effort |
|---|---|---|
| 1.1 | Install TailwindCSS v4; configure Prosperus Club design tokens (colors, fonts) | 3h |
| 1.2 | Create TypeScript interfaces for all CSV row types and metrics objects | 4h |
| 1.3 | Extract data-processing logic into `src/services/dataProcessor.ts` (single source of truth — eliminates duplication) | 6h |
| 1.4 | Extract shared utilities (`pickContentKey`, date formatters) into `src/utils/` | 2h |
| 1.5 | Decompose UI into components: `UploadScreen`, `DashboardHeader`, `KPIGrid`, `AccessChart`, `UserTable`, `ProgressTable`, `UserDetailPanel`, `CompanySelector`, `ExportPanel` | 8h |
| 1.6 | Replace JSZip CDN injection with npm dependency | 1h |
| 1.7 | Implement mobile-first responsive layouts — tables → card view on mobile | 8h |
| 1.8 | Apply Prosperus Club brand to all UI surfaces (generator + exported HTML) | 4h |
| 1.9 | Configure Netlify deployment (`netlify.toml`, SPA redirect, `dist/` build) | 2h |
| 1.10 | Set up Vitest + write unit tests for `dataProcessor.ts` | 4h |
| 1.11 | Set up Playwright + write smoke test (upload → process → verify KPIs) | 4h |

**Exit Criteria:**
- [ ] Live on Netlify URL
- [ ] No file exceeds 300 lines
- [ ] Brand colors and fonts applied everywhere
- [ ] Mobile: zero horizontal scroll, tables render as cards on 375px viewport
- [ ] Vitest coverage ≥ 60% on data processing

---

### Phase 2: Selective Export + Enhanced Detail + State Management (Weeks 4–6)

> **Goal:** Selective company export, rich user detail view, centralized state, URL-based filtering.

| # | Task | Effort |
|---|---|---|
| 2.1 | Install Zustand; create stores: `uploadStore`, `filterStore`, `dashboardStore`, `exportStore` | 4h |
| 2.2 | Build Company Selector Panel (checklist, select-all, individual export, preview) | 6h |
| 2.3 | Implement first-email naming convention for exported HTML files | 2h |
| 2.4 | Build enhanced User Detail slide-over panel (content viewed, entry date, contact info, full history) | 6h |
| 2.5 | Integrate `date-fns` for all date operations | 3h |
| 2.6 | Integrate TanStack Table with mobile card-view adapter | 8h |
| 2.7 | Refactor export engine — use `renderToStaticMarkup()` with shared branded components | 6h |
| 2.8 | Brand the exported HTML dashboards (Prosperus colors, Manrope font, responsive) | 4h |
| 2.9 | Expand test suites (Vitest: state + export logic; Playwright: selective export flow) | 4h |

**Exit Criteria:**
- [ ] User can select individual companies and export only those
- [ ] Exported files named `{first-email}.html`
- [ ] User detail panel shows full content history, entry dates, contact info
- [ ] Exported HTML dashboards are branded and mobile-responsive
- [ ] Vitest coverage ≥ 80%

---

### Phase 3: Interactivity + Polish (Weeks 7–9)

> **Goal:** Advanced filtering, cross-filtering, enhanced visualizations, PWA-ready output.

| # | Task | Effort |
|---|---|---|
| 3.1 | Build Global Filter Bar (multi-company, date range, status toggle, global search) | 6h |
| 3.2 | Implement cross-filtering (click KPI → filter table; click chart → highlight) | 4h |
| 3.3 | Add access heatmap visualization (week × day-of-week density grid) | 4h |
| 3.4 | Add sparklines to user table rows (30-day access trend) | 3h |
| 3.5 | Implement filtered CSV re-export (download current filtered view as CSV) | 2h |
| 3.6 | Accessibility audit and remediation (WCAG 2.1 AA) | 4h |
| 3.7 | Performance profiling for large datasets (10K+ rows) | 3h |
| 3.8 | Full Playwright E2E suite (10+ scenarios: mobile, export, filters, PWA-import simulation) | 6h |

**Exit Criteria:**
- [ ] All interactive features work on mobile and desktop
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Exported HTML validated for PWA import compatibility
- [ ] Full E2E test suite passes across Chrome, Firefox, Safari viewports

---

## 9. Testing Strategy

### 9.1 Unit Tests (Vitest)

| Module | Key Test Cases |
|---|---|
| `dataProcessor.ts` | Empty CSVs, malformed emails, missing columns, duplicate entries, encoding edge cases |
| `metricsComputer.ts` | Correct aggregation, edge case: company with 0 users, progress % boundaries |
| `dateHelpers.ts` | Portuguese date formats, invalid dates, timezone (GMT-3) |
| `pickContentKey.ts` | All header variations, missing headers, mixed-case |
| `exportHelpers.ts` | First-email naming, HTML output structure, ZIP contents |

### 9.2 E2E Tests (Playwright)

| Test | Steps |
|---|---|
| **Happy Path** | Upload 5 CSVs → process → verify KPIs → select company → export → verify filename |
| **Selective Export** | Select 2 of 3 companies → export → verify ZIP contains only 2 files with correct names |
| **Mobile View** | 375px viewport → upload → navigate → verify no horizontal scroll → verify card layout |
| **File Validation** | Upload invalid CSV → verify error → upload correct → verify recovery |
| **User Detail** | Click user → verify all detail sections populated → verify content history |

### 9.3 Running Tests

```bash
# Unit + Integration
npx vitest run --coverage

# E2E
npx playwright test --reporter=html

# Full suite
npm test   # vitest run && playwright test
```

---

## 10. Proposed File Structure

```
curso-dashboard/
├── netlify.toml
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── index.html
├── public/
│   └── vite.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx                         # Root: Router + Layout
│   ├── index.css                       # TailwindCSS directives + brand tokens
│   ├── types/
│   │   ├── csv.ts                      # CSV row interfaces
│   │   └── metrics.ts                  # Computed metrics types
│   ├── services/
│   │   ├── csvParser.ts                # PapaParse wrapper + validation
│   │   ├── dataProcessor.ts            # Email→empresa mapping, enrichment
│   │   └── metricsComputer.ts          # Single shared metrics engine
│   ├── stores/
│   │   ├── uploadStore.ts              # Zustand: file state
│   │   ├── filterStore.ts              # Zustand: active filters
│   │   ├── dashboardStore.ts           # Zustand: processed data  
│   │   └── exportStore.ts              # Zustand: export queue + company selection
│   ├── utils/
│   │   ├── dateHelpers.ts              # date-fns based formatters
│   │   ├── pickContentKey.ts           # Header variation resolver
│   │   └── exportHelpers.ts            # ZIP generation + first-email naming
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx            # Branded header + main content
│   │   ├── upload/
│   │   │   ├── UploadScreen.tsx
│   │   │   ├── FileDropZone.tsx
│   │   │   └── ProcessingScreen.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── KPIGrid.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── AccessEvolutionChart.tsx
│   │   │   └── EngagementHeatmap.tsx
│   │   ├── tables/
│   │   │   ├── UserTable.tsx           # TanStack Table + mobile card adapter
│   │   │   └── ProgressTable.tsx
│   │   ├── user-detail/
│   │   │   └── UserDetailPanel.tsx     # Slide-over with full profile
│   │   └── export/
│   │       ├── CompanySelector.tsx      # Checklist for selective export
│   │       ├── ExportPanel.tsx
│   │       └── ReportTemplate.tsx       # Branded HTML template for export
│   └── pages/
│       ├── UploadPage.tsx
│       └── DashboardPage.tsx
├── tests/
│   ├── unit/
│   │   ├── dataProcessor.test.ts
│   │   ├── metricsComputer.test.ts
│   │   └── exportHelpers.test.ts
│   └── e2e/
│       ├── happyPath.spec.ts
│       ├── selectiveExport.spec.ts
│       └── mobileView.spec.ts
└── Exemplo/                             # Sample CSV data (unchanged)
```

---

## 11. Success Metrics

| Metric | Current | Phase 1 | Phase 3 |
|---|---|---|---|
| **Mobile Usability** (Lighthouse) | ~30 | ≥ 80 | ≥ 95 |
| **Test Coverage** | 0% | ≥ 60% | ≥ 85% |
| **Horizontal Scroll on Mobile** | Yes | ❌ None | ❌ None |
| **Export Options** | Bulk only | Selective | Selective + filtered CSV |
| **Time to First Meaningful Paint** | ~2s | < 1.5s | < 1s |
| **Developer Onboarding Time** | ~30 min | < 10 min | < 5 min |
