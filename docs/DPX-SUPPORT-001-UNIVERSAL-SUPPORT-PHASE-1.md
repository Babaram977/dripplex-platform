# DPX-SUPPORT-001 — Universal Support, Phase 1

**Founder decision: 2026-09-11. Status: implemented, awaiting review.**

## The problem

Only drivers could file a support ticket. `DriverSupportTicket` was keyed on
`driverId`, so the Operations queue could only ever contain drivers' problems.
Customers, riders, merchants and fleet owners were shown an email address. Email
lands in an inbox: no ticket, no status, no audit trail, and no way for anyone to
answer "how many people are waiting on us right now".

DrippleX is live on the Play Store. Every persona above is a real person who has
already had a problem and had nowhere to take it.

## What Phase 1 does

One support channel for every authenticated persona, feeding the Operations
queue that already carries SOS alerts and incident reports.

- **`SupportTicket`** — keyed to `userId`, not `driverId`, with `persona`
  (`CUSTOMER`, `RIDER`, `DRIVER`, `MERCHANT`, `FLEET_OWNER`).
- **Ten categories, locked**: `PAYMENT`, `RIDE`, `FOOD_ORDER`, `MERCHANT`,
  `DRIVER_RIDER`, `WALLET`, `ACCOUNT`, `TECHNICAL`, `SAFETY`, `OTHER`.
- **`POST /support/tickets`** — the path deliberately does not encode who you
  are. `GET /support/tickets` and `GET /support/tickets/:id` return only your
  own.
- **`GET|PATCH /admin/support/tickets`** — Operations, behind its own permission.
- The Operations Support queue now reads `support_tickets`. It is still **one**
  queue; only the table it reads changed.

## Decisions worth not re-litigating

**Persona is derived from the session, never from the request body.**
`CreateSupportTicketDto` has no persona field at all. A caller who can name their
own persona can route their own ticket into a filter no operator is watching.
The portal is preferred over the role because one human is often several
personas: a driver is usually also a customer, and only the portal separates
"my trip" from "my order". `fleet_owner` is the exception — there is no fleet
portal — so the role is consulted only where the portal says nothing specific.

**`PAYMENT`, `WALLET` and `SAFETY` are marked for mandatory human handling,
server-side, from the category alone.** Nothing reads the flag in Phase 1
because no automation exists yet. It is written now so that when first-line
automation arrives it inherits a decision already made, instead of being asked
to judge its own competence. A stored boolean is also auditable afterwards; a
rule evaluated at read time is not.

**Attached order/ride references must belong to the filer.** Operations reads an
attached order as context about the person in front of them, so an unowned
reference is a way to point staff at a stranger's business. A party is: the
order's customer, its merchant, or the rider carrying it; a ride's customer or
its driver.

**`/driver/support-tickets` is kept and adapted, not deleted.** Driver builds
already on people's phones call it. It is now a thin adapter over
`SupportService`: same routes, same request and response shapes, writing into
`support_tickets`. It must never become a second writer again — a ticket written
to the old table still returns a valid response to the driver's app and is a
ticket no operator will ever see, which is a failure invisible from both ends.
`driver-support.adapter.db.spec.ts` is what proves it has not returned.

## Migration

`20260913060000_universal_support_tickets` creates the three enums, the table,
four indexes and two foreign keys, then copies every existing driver ticket
across — preserving id, timestamps, status, response and resolver. Keeping the
id is what stops the `operations_cases` rows already keyed to those tickets from
being orphaned.

Category mapping (identical to the adapter's, so a driver's ticket does not land
in a different category depending on when they filed it):

| Legacy    | New         | Note                                             |
| --------- | ----------- | ------------------------------------------------ |
| `PAYOUT`  | `PAYMENT`   | acquires `requires_human_handling` — it is money |
| `ACCOUNT` | `ACCOUNT`   |                                                  |
| `APP_BUG` | `TECHNICAL` |                                                  |
| `KYC`     | `ACCOUNT`   | KYC is account verification; no KYC category     |
| `OTHER`   | `OTHER`     |                                                  |

**`driver_support_tickets` is copied, not moved, and not dropped.** If anything
about the new queue is wrong, every original row is still where it was. A later
migration can retire it once the new queue has been watched in production.

`ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_TICKET_UPDATED'` is a
**separate** migration (`20260913070000`). Prisma runs any file containing
`ADD VALUE` outside a transaction, so folding it into the migration above would
have stripped transactional protection from the backfill in the same file —
turning a half-completed copy into a failed migration row and a P3009 that
blocks every subsequent deploy.

## RBAC

Catalogue 150 → 152, in both copies (`seed-data/*.ts` and `seed-rbac.cjs`):

- `support:tickets:use` → `customer`, `merchant`, `rider`, `driver`, `fleet_owner`
- `admin:support:tickets:manage` → `operations_staff`, `administrator`, `super_administrator`

The two `driver:`-prefixed permissions stay in the catalogue: deployed driver
apps still call the routes behind them.

Admin roles are deliberately **not** granted `support:tickets:use`. There is no
`ADMIN` persona, so an administrator filing would be recorded as `CUSTOMER` —
wrong in the queue they themselves manage.

## Verification

- Full backend suite on a fresh, never-seeded database with `CI=true`:
  **279 suites, 2786 tests, all passing.**
- `prisma migrate diff` against a freshly migrated database: **no difference
  detected** (schema and migrations agree).
- The backfill spec executes the `INSERT` read out of the migration file itself,
  so the test cannot drift from what runs in production.
- Every guard added here was deleted in turn and the suite confirmed red:
  ownership isolation, persona derivation, the human-handling rule, the
  order/ride ownership checks, the legacy-table regression, and the migration's
  category mapping.

## Explicitly not in Phase 1

- **Guest (unauthenticated) support.** Not started.
- **Drip AI / first-line automation.** Not started. `FloatingAIButton` in the
  super-app remains presentational — there is no LLM provider anywhere in this
  repository, and this phase adds none.
- **Client-side Help & Support screens.** Phase 1 is the backend and the
  Operations queue; no persona app has been given a new screen.

## Open follow-ups

- Retire `driver_support_tickets` once the new queue has been watched in
  production for a period the founder is comfortable with.
- `SupportQueueItemDto` still carries `driverId`/`driverName`/`driverPhone` from
  the shared `OperationsCaseBaseDto`, filled with the filer whatever persona
  they are. New UI reads `userId`/`userName`/`userPhone`/`persona`; the inherited
  three can be retired when SOS and incidents are revisited.
