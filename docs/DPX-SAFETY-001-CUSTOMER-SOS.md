# DPX-SAFETY-001 — Passenger Emergency SOS

**Status: implemented.** Founder request, 2026-09-06: "Wire the SOS screen to a
real endpoint."

## Why this needed a design decision at all

The customer-facing `EmergencySOSScreen` (`ridesos`, reached from Ride in
Progress, Live Tracking and Ride Home Extended) was **entirely inert**:

- the three action cards — "Call 911 / Emergency", "Share Live Location",
  "Contact DrippleX Safety" — were rendered from a static array with no
  `onClick` handler;
- the emergency contact was hardcoded (`Mum · +234 803 000 0001`), and
  "+ Add emergency contact" did nothing;
- the hold-to-send button, after its three-second hold, called
  `go('rideinprogress')` — it navigated back.

A passenger in trouble pressed something that looked like it summoned help and
did nothing.

That state was **known and deliberate**, not an oversight:
`docs/DPX-FIGMA-FULL-WIRING-SPEC.md` listed Emergency SOS under "No backend in
api.ts → 'Not available yet' (don't fake)", and `docs/RIDE-003-SLICE-4.md` §6
recorded SOS as confirmed absent from the backend. The bug is that the screen
never actually said "not available yet" — it looked live.

Meanwhile a full SOS backend **did** exist, and was driver-only:
`SosAlert`/`SosAlertService` (`apps/backend/src/drivers/sos/`),
`POST /driver/sos-alerts`, an Operations queue, an ops console page. The
founder-approved decision behind it (2026-08-04) puts the customer in it only
as a _notified party_ — "the ride's customer is notified assistance was
requested". **No customer-originated SOS was approved anywhere.** Wiring the
passenger's screen therefore meant designing one.

## What was built

One new endpoint, `POST /customer/sos-alerts`, writing the **same `SosAlert`
row** as the driver path with a new `origin` discriminator.

| Decision                                          | Choice                                                                     | Why                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One table or two?                                 | **One** — `SosAlert` gains `origin` (`DRIVER`/`CUSTOMER`) and `customerId` | Two tables means two Operations queues. A dispatcher watching the SOS queue would not see passenger emergencies. For a life-safety feature that is a hazard, not a tidiness question.                                                               |
| When may a passenger raise SOS?                   | **Only during an active ride** (`DRIVER_ASSIGNED`/`ARRIVED`/`IN_PROGRESS`) | The screen is an in-ride feature — it renders a "Current Trip" card — and the ride is what supplies the driver, vehicle and route that make an alert actionable. See open question 1.                                                               |
| Is the driver told their passenger raised an SOS? | **No**                                                                     | The mirror of the driver flow would tell them. But the passenger's emergency may _be_ the driver; telling them is the one action that could make it worse. Operations decides who to contact.                                                       |
| Auto-contact emergency services?                  | **No**, unchanged                                                          | The locked 2026-08-04 decision stands. The screen offers the passenger a dialler; DrippleX never places the call.                                                                                                                                   |
| New permission?                                   | **No** — reuses `customer:ride:manage`                                     | SOS is only possible on your own active ride, so anyone who can manage that ride can already raise it. A new permission adds a catalog entry and a seed migration while excluding nobody — and risks a real emergency failing on an unseeded grant. |
| Rate limiting?                                    | **None**, matching the driver endpoint                                     | Rate-limiting a life-safety endpoint trades a real emergency for protection against a nuisance. If abuse appears, the answer is Operations-side duplicate suppression, not a 429 in front of an SOS button.                                         |
| `customerId` on delete                            | `SET NULL`, not `CASCADE`                                                  | A life-safety record must outlive the account that raised it. Deleting a customer must not erase the emergency they reported.                                                                                                                       |

`driver_id` stays `NOT NULL`: a customer alert is only accepted during an
active ride, and an active ride always has a driver. On a `CUSTOMER` alert the
driver is recorded **for context** — Operations needs to know whose car the
passenger is in — and is not the raiser. Every pre-existing row is a driver
alert, which is exactly the enum default, so the migration needs no backfill.

## Screen changes

`EmergencySOSScreen` now files a real alert and shows the passenger its
reference. Three things are deliberately **not** faked, because no backend
exists for them:

- **Emergency services** — a real `tel:112` link. The passenger places the call.
- **DrippleX Safety chat** — the card is gone. There is no safety-chat endpoint,
  and the SOS itself is what reaches Operations; the screen says so.
- **Saved emergency contacts** — the fabricated "Mum" row and the dead
  "+ Add emergency contact" are gone. Customers have no stored emergency
  contacts (only drivers do, via KYC). The screen states this rather than
  inventing one.

The "Current Trip" card now reads real values (`CustomerRideDto.driverName`,
`driverVehicle`, `dropoffAddress`) — its old `GAP:` comment claiming only
`driverId` was exposed had gone stale. Location is awaited for up to five
seconds and the alert is sent regardless: a missing fix must never cost the
alert. On failure the screen shows the error and stays put; it never navigates
away, because believing help is coming when it is not is the worst outcome this
screen has.

## Open questions for founder confirmation

1. **SOS with no trip in progress.** Currently refused with an explanation.
   A passenger in danger who is not mid-ride is a real case, but it has no
   driver, vehicle or route context, and no approved policy for what
   Operations does with it. Deferred rather than guessed at.
2. **The emergency number.** `112` is Nigeria's national emergency line and
   replaces the screen's old, wrong "911". Some states also run 767. Confirm
   whether 112 is the number DrippleX should surface, and whether it should
   vary by state.
3. **Notifying the driver.** Recorded above as "no". Confirm — it is a safety
   judgement, not a technical one.
4. **Operations response workflow.** Unchanged and still deferred:
   `DPX-DRIVER-005` owns acknowledgement SLAs, dispatcher assignment,
   escalation and the incident timeline. Passenger alerts land in the same
   queue and inherit whatever that document eventually specifies.

## Verification

- `apps/backend`: `tsc --noEmit` clean; `eslint --max-warnings=0` clean on every
  changed file; `jest src/drivers/sos` **9/9** and `jest src/operations`
  **84/84**, both against real Postgres 16 with migrations applied by
  `prisma migrate deploy` (the new migration included).
- `packages/sdk`: 190/190. `apps/super-app`: `tsc --noEmit` clean, 174/174.
  `apps/operations-console`: `tsc --noEmit` clean, `eslint` clean.
- Not covered by automated tests: the screen itself has no component test —
  the super-app's existing suite covers libs and one ride screen, and adding a
  first harness for `rideScreen.tsx` was out of scope for this change. The
  trigger path is covered at the service level.
