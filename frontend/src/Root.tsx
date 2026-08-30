import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ReflowCursor } from "./cursor/ReflowCursor";

/**
 * Top-level split between the frozen public surface and the logged-in application.
 *
 * Both branches are lazy. That matters in one direction specifically: the marketing
 * experience statically imports Three.js, GSAP and Lenis, and if it stayed in the
 * eager entry every `/app` route would download roughly 900 kB of WebGL it never
 * runs. The cost is one extra chunk request before the marketing page paints; the
 * marketing page itself is unchanged.
 */
const MarketingApp = lazy(() => import("./App"));
const AppRoutes = lazy(() => import("./app/AppRoutes"));
// Text only: the FAQ deliberately does not pull the story bundle.
const FaqPage = lazy(() => import("./faq/FaqPage"));

export function Root() {
  return (
    <>
      <ReflowCursor />
      <BrowserRouter>
        <Suspense
          fallback={<div className="lab-loading" aria-label="Loading Reflow" />}
        >
          <Routes>
            <Route path="/app/*" element={<AppRoutes />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="*" element={<MarketingApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default Root;
