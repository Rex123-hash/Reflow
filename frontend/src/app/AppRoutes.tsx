import { lazy, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { UiDataProviderRoot } from "./data/UiDataContext";

/**
 * Every logged-in route is a separate chunk, so the marketing entry never pays for
 * the application and vice versa. The marketing bundle (Three.js, GSAP, Lenis) is
 * never imported from anything under `/app`.
 */
function lazyNamed<
  T extends Record<string, ComponentType<Record<string, never>>>,
>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const OverviewRoute = lazyNamed(
  () => import("./routes/OverviewRoute"),
  "OverviewRoute",
);
const ObjectivesRoute = lazyNamed(
  () => import("./routes/ObjectivesRoute"),
  "ObjectivesRoute",
);
const RecoveryRoute = lazyNamed(
  () => import("./routes/RecoveryRoute"),
  "RecoveryRoute",
);
const RecoveryLandingRoute = lazyNamed(
  () => import("./routes/RecoveryRoute"),
  "RecoveryLandingRoute",
);
const EvidenceRoute = lazyNamed(
  () => import("./routes/EvidenceRoute"),
  "EvidenceRoute",
);
const EvidenceLandingRoute = lazyNamed(
  () => import("./routes/EvidenceRoute"),
  "EvidenceLandingRoute",
);
const OperatorRoute = lazyNamed(
  () => import("./routes/OperatorRoute"),
  "OperatorRoute",
);

export function AppRoutes() {
  return (
    <UiDataProviderRoot>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewRoute />} />
          <Route path="objectives" element={<ObjectivesRoute />} />
          {/* Safe landing routes: the global tabs never choose an incident. */}
          <Route path="recovery" element={<RecoveryLandingRoute />} />
          <Route path="recovery/:incidentId" element={<RecoveryRoute />} />
          <Route path="evidence" element={<EvidenceLandingRoute />} />
          <Route path="evidence/:incidentId" element={<EvidenceRoute />} />
          <Route path="operator" element={<OperatorRoute />} />
          <Route path="*" element={<Navigate to="/app/overview" replace />} />
        </Route>
      </Routes>
    </UiDataProviderRoot>
  );
}

export default AppRoutes;
