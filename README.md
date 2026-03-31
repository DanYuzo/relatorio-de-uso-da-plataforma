# Prosperus Club — Corporate Training Dashboard

A client-side tool that processes 5 CSV files and generates per-company HTML dashboards for the Prosperus Club corporate training platform.

## Quick Start

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build     # → dist/
npm run preview   # local preview
```

Deploy `dist/` to Netlify (auto-configured via `netlify.toml`).

## CSV Files Required

| File | Purpose |
|---|---|
| `referencia.csv` | Master reference (email → company mapping) |
| `acessos.csv` | Platform access log |
| `conclusoes.csv` | Lesson/module completions |
| `progresso.csv` | User progress percentages |
| `ultimo_acesso.csv` | Last access timestamps |

## Tech Stack

- React 19 + TypeScript (strict)
- Vite 7 + TailwindCSS v4
- Recharts (in-app) + Chart.js (exported HTML)
- PapaParse for CSV processing
