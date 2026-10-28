import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingState } from "./components/ui";
import { BackendStatusProvider } from "./hooks/useBackendStatus";
import { AppShell } from "./layouts/AppShell";
import HistoryPage from "./pages/HistoryPage";
import NewScreeningPage from "./pages/NewScreeningPage";
import NotFoundPage from "./pages/NotFoundPage";
import OverviewPage from "./pages/OverviewPage";
import SystemPage from "./pages/SystemPage";

// Charts and 3D scenes are heavier dependencies; load on demand.
const ScreeningResultPage = lazy(() => import("./pages/ScreeningResultPage"));
const ModelPerformancePage = lazy(() => import("./pages/ModelPerformancePage"));
const DigitalTwinPage = lazy(() => import("./digitalTwin/DigitalTwinPage"));

export default function App() {
  return (
    <ErrorBoundary>
      <BackendStatusProvider>
        <Routes>
          <Route
            path="digital-twin"
            element={
              <Suspense fallback={<LoadingState label="Initializing 3D Digital Twin…" height={400} />}>
                <DigitalTwinPage />
              </Suspense>
            }
          />
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="screenings/new" element={<NewScreeningPage />} />
            <Route path="screenings" element={<HistoryPage />} />
            <Route
              path="screenings/:screeningId"
              element={
                <Suspense fallback={<LoadingState label="Loading result view…" height={300} />}>
                  <ScreeningResultPage />
                </Suspense>
              }
            />
            <Route path="performance" element={<ModelPerformancePage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BackendStatusProvider>
    </ErrorBoundary>
  );
}
