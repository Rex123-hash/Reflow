# P2E-A Calendar authority audit (before implementation)

Baseline: checkout `24a4219` includes approved marketing `18313e6`; worktree clean.
No remote is configured, so fetch/pull is unavailable; local `main` is older and was not used
to roll back the accepted checkout. Marketing is frozen.

1. **Adapter:** `GoogleCalendarGateway` in `calendar_gateway.py`, using existing short-lived
   service-account impersonation scoped to Calendar events and a dedicated calendar.
2. **Execution:** `CalendarExecutionService.execute_selected_plan` projects the deterministic
   intent, then `execute` claims, inserts/adopts, acknowledges, gets, compares and records.
3. **Receipt:** existing `action_receipts/receipt-9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c`.
4. **Idempotency:** existing key `9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c`;
   `action_claims` contains its typed intent. No new receipt or correlation is needed.
5. **Event:** `p1b9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c`.
6. **Independent read-back:** `gateway.get_event`, `normalize_calendar_event`, and
   `verification_differences`; insert response is not verification authority.
7. **Persistence:** receipt `observed_state`, `read_back_at`, and `verification_differences`;
   later `plan_revisions/0002.calendar_closure_evidence` preserves another independent GET.
8. **Canonical action:** `calendar-9899dba7a849a328a49d`, Recovery 01. API acknowledged
   `2026-08-27T19:07:44.825660+00:00`; receipt read-back
   `2026-08-27T19:07:45.772017+00:00`, VERIFIED. Expected/observed event time is
   `2026-08-28T13:00:00+00:00`–`2026-08-28T14:00:00+00:00`, status `confirmed`.
   Later closure read-back `2026-08-27T19:08:54.311870+00:00`, passed with no differences.
9. **Sanitization:** existing safe observed persistence still contains private calendar ID
   and fingerprint; presentation must further allowlist only times/status and safe event ID.
   No attendees were created. No descriptions, account/calendar IDs, meetings, arbitrary
   external titles, private properties, grants or credentials belong in the new response.
10. **Existing presentation:** RecoveryCaseView.actions and EvidencePageView.evidence already
    expose receipt `calendar:<receipt_id>` with event ID/status, acknowledgement/read-back
    times. Reuse this exact join; add detailed expected/observed data, not another receipt.

## Fresh-read decision

The existing GET adapter supports the required known-event read and comparison without an
executor. Its normal 20-second request budget and executor retries are unsuitable for UI.
Use an opt-in shorter gateway request budget (default execution behavior untouched), one
GET, and a six-second presentation wait bound. Never instantiate an executor/action ledger
for this endpoint. Return preserved history on fresh timeout/unavailability, with an explicit
failed-current-read status; never relabel history as live. Guest uses a reviewed static export
and never invokes the private backend or Calendar.

## Canonical baseline

- Incident: `incident-0fc3af5b0bd1ad847aea`
- Revision: 16; state RESOLVED / objective_restored
- Document SHA-256: `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`
- Durable workflow events: 28
- Recovery 01 verified Calendar action remains distinct from its failed objective verification.
