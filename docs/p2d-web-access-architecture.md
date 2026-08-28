# P2D web access architecture

Firebase Hosting serves the Vite build at `reflow-objective-recovery.web.app`, applies the SPA/deep-link rewrite, and rewrites only `/api/**` to the public `reflow-web-bff` Cloud Run service. The existing `objective-recovery` Cloud Run service remains private.

## Trust boundaries

1. The browser signs in with Firebase Google identity (`openid`, `email`, `profile`) or Firebase anonymous identity. Gmail ingestion OAuth is separate and is not used by product login.
2. The browser sends the fresh Firebase ID token once to same-origin `POST /api/auth/session`. The BFF verifies its signature and expiry, then performs token-bound Firebase account lookup so disabled or revoked identities fail closed.
3. The BFF stores that short-lived credential in a 55-minute `__session` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, and `/` scope. The Firebase browser SDK uses in-memory persistence and signs out after the exchange.
4. A Google principal enters `Live workspace`. The BFF mints an audience-bound Google service identity for the fixed private backend origin and forwards only the six allowlisted read paths.
5. An anonymous principal enters `Demo workspace · Read only`. Those same read paths are served from a bounded, sanitized canonical dataset; arbitrary incident IDs and all mutations are rejected and never reach the private backend.

The BFF runs as the dedicated service account `reflow-web-bff@project-f334c42b-7a03-4194-932.iam.gserviceaccount.com`. Its only recovery-service permission is service-level `roles/run.invoker` on `objective-recovery`; it has no Owner, Editor, or project-wide admin role. Browser Firebase credentials are never forwarded to that backend, and no service-account or audience credential enters the browser bundle.

## Application/data boundary

`ApiUiDataProvider` implements the existing `UiDataProvider` interface. It reads Overview, Objectives, Recovery, Evidence, Events, and Operator context through same-origin paths, validates every `200` response with CSP-safe build-time Ajv validators generated from the frozen OpenAPI document, and preserves ETag, loading, bounded-error, and read-only truth semantics.

The public landing page is dashboard-first. Its `Live demo` and final workspace CTA use React Router navigation to `/app`, whose authenticated index resolves to `/app/overview`. Direct `/app` loads no Three.js, GSAP, Lenis, or marketing GLB asset.

## Browser protections

- Mutating session endpoints require an exact allowlisted `Origin`; no cross-origin CORS access is enabled.
- Sign-out deletes the product cookie; missing, malformed, expired, disabled, and revoked sessions return `401`.
- Hosting and BFF set CSP, HSTS, frame denial, MIME sniffing denial, referrer, and permissions headers.
- SPA HTML at `/`, `/app`, and `/app/**` is `no-store`; hashed assets are immutable.
- P2D exposes no Operator ACT/DIRECT/SIMULATE, backend mutation, Calendar/GitHub mutation, voice, upload, Slack, or Agents 6/7 behavior.
