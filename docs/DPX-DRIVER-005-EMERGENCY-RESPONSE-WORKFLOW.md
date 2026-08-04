# DPX-DRIVER-005 — Emergency Response Workflow (Future Milestone)

**Status: Deferred, not yet implemented.** Founder request (2026-08-04), recorded
alongside approval of Driver Slice 2 item 5 (SOS/Emergency alert): SOS is a
life-safety feature, and what happens _after_ an alert is raised deserves its
own focused design pass once Operations is actually staffing and using the
queue this creates. This document exists so the SOS foundation shipped in
Slice 2 is built with the right extension points now, rather than needing a
redesign when the full response workflow is scoped.

## What Slice 2 already ships (the foundation this builds on)

`SosAlertService`/`SosAlert` (`apps/backend/src/drivers/sos/`) already
provides:

- A durable record created _before_ any notification is sent (reliability:
  the alert exists even if a push is missed).
- `SosAlertStatus`: `OPEN` → `ACKNOWLEDGED` → `RESOLVED`.
- `acknowledgedBy`/`acknowledgedAt`, `resolvedAt`, `adminNotes` — a real
  (if minimal) audit trail of who acted and when.
- A `CRITICAL`-priority broadcast to every user holding
  `admin:drivers:sos-alert:manage`, and a separate customer notice when an
  active ride was resolved.
- `admin:drivers:sos-alert:manage`-gated admin endpoints
  (`GET/PATCH /admin/sos-alerts`) — currently backend-only, no
  operations-console page yet.

## Scope, once activated

The founder's own list, recorded as the actual requirements this workflow
needs to satisfy when scoped:

- **Acknowledged by Operations** — already exists as a status transition;
  the open question is response-time SLAs and whether an unacknowledged
  alert needs to escalate automatically after some threshold.
- **Dispatcher assigned** — a named responder taking ownership of a specific
  alert, distinct from "anyone with the permission can see the queue."
  Needs an `assignedTo` concept on `SosAlert` (or a separate assignment
  record) plus reassignment/handoff.
- **Contact driver** — closing the loop back to the driver beyond a status
  notification: a real-time channel (call, in-app message) from the
  responder, not just push notifications.
- **Contact customer (if applicable)** — beyond the existing "assistance
  requested" notice, whether/how a responder reaches the customer directly
  during an active incident.
- **Escalate to supervisor** — a second-tier response path when the
  first responder can't resolve or needs authority they don't have.
- **Escalate to emergency services (where policy permits)** — explicitly
  deferred in Slice 2 pending country-specific legal/operational policy;
  this workflow is where that policy decision, once made, gets wired in as
  an actual escalation path rather than being retrofitted.
- **Resolved / False alarm** — Slice 2 only has `RESOLVED`; a `FALSE_ALARM`
  (or similar) outcome distinct from a genuinely resolved emergency may be
  worth tracking separately for reporting/trend purposes.
- **Full incident timeline and audit trail** — Slice 2's `adminNotes` is a
  single free-text field overwritten on each update, not an append-only
  timeline. A real incident record needs a structured, ordered log of every
  status change, assignment, and contact attempt — closer to how
  `AuditService` already records structured events elsewhere in the
  platform than to the current single-note field.

## Extension points to preserve in Slice 2's implementation

So that adding this later doesn't require touching the SOS trigger path:

- **`SosAlertStatus` stays an extensible enum**, not hard-coded to exactly
  three values in application logic — `FALSE_ALARM` and any intermediate
  states (e.g. `DISPATCHED`) should be additive when this ships, not a
  breaking change to the trigger/acknowledge/resolve flow.
- **`adminNotes` is not assumed to remain the only audit surface.** When
  a structured timeline is built, it should live alongside (or replace)
  `adminNotes` without changing what `trigger()`/`updateAlert()` already do
  for the driver-facing side.
- **The permission model (`admin:drivers:sos-alert:manage`) is the seed,
  not the final shape.** Dispatcher/supervisor tiers, if they need distinct
  permissions rather than one flat "can manage SOS" grant, are a new
  decision at that time — not assumed here.
- **`NotificationCenterService.broadcast()`/`.send()` remain the delivery
  mechanism** for any new notification types this workflow adds
  (dispatcher-assigned, escalated-to-supervisor, etc.) — no new transport
  layer is implied by this document.
- **No operations-console UI is assumed to exist yet.** This entire
  workflow is unusable without a real queue/response UI for Operations —
  scoping that UI is itself part of activating this document, not a
  separate afterthought.

## Why this is safe to defer

Slice 2's SOS already satisfies the founder's original, narrower decision
(alert Operations immediately with real context; notify the customer;
explicitly do not auto-contact emergency services or a personal emergency
contact). What this document adds is the _response_ side — turning a raised
alert into a managed incident with ownership, escalation, and a full audit
trail. That's real scope, deserving its own design pass once Operations is
actually staffing this queue, rather than being guessed at now. A missing
response workflow is a named, honest gap — not a silently-skipped one — the
same discipline applied to every other deferred capability in this module
(see `DPX-DRIVER-003-BACKGROUND-SCREENING.md` for the same pattern).
