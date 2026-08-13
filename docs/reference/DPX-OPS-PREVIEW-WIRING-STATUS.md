# Ops Console (super-app Design Preview) — real-backend wiring status

The super-app `adminConsoleScreen.tsx` is the design-preview of the Operations
Console. This session removed all mock data from it and connected every screen
to the **existing** DrippleX backend — no new/duplicate backend architecture,
no invented endpoints. This file records, per screen, exactly what is now real
and where a genuine UI action has **no** matching backend yet (so the founder
can decide whether to prioritise the missing capability). The frozen Figma UI
was not modified.

## Fully wired to real endpoints

| Screen        | Endpoint(s) reused                                                                                               | Actions wired                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Dashboard     | `GET /operations/dashboard/counters`, `/operations/rides`, `/operations/fleet`, `/operations/analytics/overview` | Live KPIs, Trip Status pie (live-ride distribution), Live Trip Feed with real 15s auto-refresh |
| Live Map      | `GET /operations/fleet`                                                                                          | Real driver dots (lat/long), online/trips counts, Nearby Drivers list                          |
| Trips         | `GET /operations/rides`                                                                                          | Real live ride queue; View shows the ride; status filters map to live statuses                 |
| Drivers       | `GET /admin/drivers`, suspend/reactivate                                                                         | Roster, search, KYC filter, Suspend/Reactivate                                                 |
| Driver KYC    | `GET /admin/drivers` (+ per-doc verify/reject)                                                                   | Review queue, verify/reject, approve-all                                                       |
| Vehicles      | `GET /admin/vehicles`, approve/reject                                                                            | Pending queue, Approve/Reject                                                                  |
| Incidents/SOS | `GET /operations/queues/{incidents,sos}`, `PATCH /operations/cases/:id`                                          | Merged live queue, Resolve, Escalate (version-checked), Contact Driver (tel:)                  |
| Support       | `GET /operations/queues/support`, `PATCH /operations/cases/:id`                                                  | Ticket queue, Resolve, Escalate                                                                |
| Customers     | `GET /admin/customers`                                                                                           | Real roster (name/phone/email/status) + per-customer completed-trip count and spend            |
| Profile       | `auth.getUser()`                                                                                                 | Real operator identity                                                                         |

## Genuine UI actions with **no** matching backend (documented gaps)

These are surfaced honestly in the UI ("not available yet …") rather than
faked. Each names the exact missing capability.

1. **Customers screen** — ✅ roster now wired to `GET /admin/customers` (new,
   gated by the existing `users:read` permission; lists name/phone/email/status
   with each customer's completed-trip count and spend). Still missing: a
   customer **rating** source (no customer-rating model — the Rating column shows
   "—"), a **block** write (`POST /admin/customers/:id/block`; the `User.status`/
   `blockedAt`/`blockedReason` fields exist but no endpoint sets them — the Block
   button says so), and a **per-customer trip history** screen (the View-All-Trips
   button says so).
2. **Pricing — Fare Configuration** (base/distance/time/waiting) — no
   Ops-editable fare-config endpoint exists (fares are computed in the frozen
   Ride module). Missing: a ride fare-parameters settings resource. Note: the
   platform **commission rate** _is_ Ops-editable via
   `GET/PATCH /admin/commercial/commission-settings`, but that field is not part
   of this frozen screen. The live fare preview stays a client-side calculator.
3. **Pricing — Promo Campaigns** — `GET/POST/PATCH/DELETE /admin/promotions`
   exists but is gated by `promotions:admin:manage`, a marketing permission the
   `operations_staff` role does not hold. Wiring it here would 401 for operators;
   promos belong on the marketing/admin surface, not the ops console.
4. **Support — reply to driver** — no admin endpoint sets a support ticket's
   response/notifies the driver. `PATCH /operations/cases/:id` (status/priority/
   assignment) and `POST /operations/cases/:id/notes` (internal note) exist, but
   neither is a customer-facing reply. Missing: `POST /driver/support-tickets/:id/respond`.
5. **Support — Chats / Calls tabs** — no live-chat or call backend channel.
6. **Incidents — Contact Passenger / Export Report** — SOS/incident cases carry
   the driver's identity, not the passenger's; and there is no report-export
   endpoint.
7. **Analytics — Weekly Revenue & Trips, Driver Growth, Peak Hours, Heatmap** —
   the analytics endpoints (`/operations/analytics/*`) return KPI aggregates and
   ranked drill-down lists, not the day/hour/month time-series these specific
   charts need, and there is no revenue time-series feed at all. Charts render
   empty until a series endpoint exists.
8. **Reports** — no report-generation/export endpoint.
9. **Audit Logs** — the `AuditService` writes audit entries but exposes no
   admin _read_ endpoint. Missing: `GET /admin/audit-logs`.
10. **Settings** — broad settings surface; only the commission rate has a
    backing endpoint (see #2).

## Principle applied

Per the engineering playbook (§3, no speculative behavior): where an endpoint
exists and fits the operator's role, it is wired to real data and real writes;
where it does not, the UI states so plainly and the gap is recorded here for
founder prioritisation — nothing is faked and no endpoint was invented.
