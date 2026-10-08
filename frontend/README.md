# BurnInWatch frontend

React + TypeScript single-page application for BurnInWatch. It uploads a burn-in CSV, shows the
backend's dataset validation, runs a screening and presents the result (status, detector agreement,
anomaly timeline, abnormal signals, window inspector). **All analysis and feature engineering happen
in the backend**; the frontend only sends a file, a device ID and a model name.

## Requirements

* Node.js 20.19+ (22 recommended) and npm
* The BurnInWatch backend running (see `../backend/README.md`)

## Installation

```powershell
cd frontend
npm install
copy .env.example .env
```

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend origin. `/api/v1` is appended automatically (a value that already ends in `/api/v1` also works). |

The backend must list the frontend origin in `BURNINWATCH_CORS_ORIGINS` (default allows `http://localhost:5173`).

## Development

```powershell
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit
npm test             # vitest (unit + component + flow tests)
```

## Production build

```powershell
npm run build        # type-checks, then writes dist/
npm run preview
```
`dist/` is static; serve it from any web server and set `VITE_API_URL` **at build time**.

## Backend connection

Endpoints used (all under `/api/v1`): `GET /health`, `GET /models`, `POST /datasets/validate`,
`POST /screenings/analyze`, `GET /screenings`, `GET /screenings/{id}`,
`GET /screenings/{id}/windows/{index}`, `GET /screenings/{id}/signals/{signal}`.
The result page uses the timeline embedded in `GET /screenings/{id}`; `GET /screenings/{id}/timeline`
exists on the backend but is not needed by the UI. See `../backend/docs/api-contract.md`.

Behaviour worth knowing:

* Health is polled every 15 s; the status pill and the New Screening page react to it.
* Screening history is **server memory**: it is cleared when the backend restarts, and the UI says so.
* Window and signal drill-down data is kept only for the 25 most recent screenings; older ones show a clear message.
* The analysis runs in a single backend request. The processing screen shows real upload progress and elapsed time and does not
  fake per-step progress; measured per-stage timings are shown on the result page.
* `timeEpoch` has no declared unit. Values that look like Unix time are shown as clock time; otherwise they are shown as elapsed
  seconds exactly as stored.

## Application structure

```
src/
  api/          axios client, typed endpoint functions, error normalization (ApiError, describeError)
  types/        TypeScript types mirroring the backend schemas
  components/   ui/ (Button, Card, Badge, StatusBadge, MetricCard, DataTable, EmptyState, ErrorState,
                LoadingState, Tooltip, Modal, Drawer, ChartContainer, ...) + StatusPill, ErrorBoundary
  features/     screening-new/ (upload, checks, model selector, config summary, processing, state hook)
                result/ (status, metrics, agreement, timeline, signals, signal detail, window table/drawer)
  hooks/        useAsync, useBackendStatus, useOverlay
  layouts/      AppShell (sidebar, topbar)
  pages/        Overview, NewScreening, ScreeningResult (lazy-loaded), History, System, NotFound
  utils/        format, status wording, timeline helpers
  constants/    signal labels, pipeline text, chart colours
```

Status semantics (shown to the user) follow the backend exactly: a window is `NORMAL` when no detector flags it, `REVIEW` when
exactly one does, `ANOMALY` when both do; the overall status is the most severe window. These are screening signals, not failure
predictions, and abnormal signals are observations, not causes.
