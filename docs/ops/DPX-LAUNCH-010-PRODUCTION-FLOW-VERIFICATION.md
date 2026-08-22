# DPX-LAUNCH-010 — Production flow verification

Run 2026-08-20 against live `https://api.dripplex.com/api/v1`. Founder directive: prove the
platform as a system, with real accounts and real data — no mock data, no fake states, no
simulator. Nothing here is asserted from reading code; every line is a real request and its real
response.

**Gate 1 (database backup): CLOSED 2026-08-21.** The original caveat was right, and worse than it
read. "Backups switched on" was not true: the Backups tab showed **no schedule at all**, and the
only backup in existence was a manual one from **2026-08-09, eleven days old**. A host failure the
same night took Postgres down for 3h18m (22:13Z–01:31Z). The volume survived, so nothing was lost
— but had it not, the loss would have been eleven days of orders, wallet ledger entries,
settlements, KYC submissions and registrations. Roughly 59 MB of data, measured as the difference
between that 173 MB snapshot and a fresh one.

Now in place, each verified in the live service rather than assumed:

|                        | State                         | Evidence                 |
| ---------------------- | ----------------------------- | ------------------------ |
| Volume backup          | 232 MB taken 2026-08-21 03:33 | Backups tab              |
| Backup schedule        | running, 3-hourly             | "Next backup in 3 hours" |
| Point-in-time recovery | **enabled and archiving**     | see below                |

PITR was verified three independent ways, because the first attempt to enable it reported success
and had not in fact applied (the Railway MCP returned `"status": "applied"` for a change that was
only staged; the subsequent deploy ran on the previous configuration):

1. `WAL_ARCHIVE_BUCKET / ENDPOINT / KEY / PATH / REGION / SECRET` present in the **live rendered
   variables**, not merely staged.
2. The restore window's upper edge advancing in real time — `04:02:00` then `04:03:05` across two
   observations 65 seconds apart.
3. Postgres network egress non-zero for the first time (peak 6.9 MB/hour) and memory up from
   0.05 GB to 0.23 GB, consistent with the pgBackRest worker shipping WAL.

Restore window floor is **2026-08-21 03:54:59** — the first base backup. PITR cannot reach behind
it; anything earlier is covered only by the two volume snapshots.

**Still not proven: an actual restore.** The second half of the original caveat stands. Backups
existing is not the same as a restore having been performed and its data verified. Railway's PITR
restores into a _new sibling service_ and leaves the source running, so a rehearsal is
non-destructive and safe to do — but it has not been done, and until it is, we know we are taking
backups, not that we can recover from them. Worth rehearsing once before launch.

---

## 1. What passed

| Check                                  | Result                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| `GET /health`                          | **200** — `database: up`, `redis: up`                   |
| `GET /merchants`                       | **200** — 3 real merchants                              |
| `GET /products` · `/products/trending` | **200** — 14 real products, real prices, real R2 images |
| `GET /auth/google` (OAuth start)       | **302** → Google, `redirect_uri` = api.dripplex.com     |
| `POST /auth/google/exchange`           | **400** on a short code — contract reachable            |
| `POST /auth/email/verify`              | **400** on a short token — contract reachable           |
| `POST /auth/register/customer`         | **400** on `{}` — validation reachable                  |
| `POST /auth/login/customer`            | **400** — `password must be longer than or equal to 8`  |
| `POST /auth/phone/send-otp`            | **400** — `phone must be a valid E.164-like number`     |

**Every authenticated route refused an anonymous caller with `401 UNAUTHORIZED`** — no gate leaks:
`/auth/me`, `/customer/cart`, `/customer/orders`, `/customer/wallet`, `/customer/rides/types`,
`/merchant/orders`, `/rider/jobs`, `/rider/profile`, `/driver/profile`, `/driver/rides/offers`,
`/driver/kyc`, `/driver/activation-eligibility`, `/operations/rides`.

## 2. The demo cast is genuinely gone from production

Previously unverifiable from outside the database. Now confirmed against the live catalogue:

```
merchants  Gwarzo Furnitures (FURNITURE, VERIFIED)
           Mani restaurant   (RESTAURANT, VERIFIED)
           Ghasan Leather Shop (FASHION, VERIFIED)
products   14 · e.g. Tuwon Shinkafa ₦2,500 · Wall Mirror Deco ₦650,000 · Vinci Shoes ₦38,000
demo cast  0 matches for "Dx Resto" / "demo"
```

These are real onboarded merchants with real Naira prices, not seeded fixtures. Migration
`20260812120000_purge_demo_cast` has taken effect.

## 3. Real content gap found

`GET /products/featured` returns an **empty list** while `/products/trending` returns 14. No
product carries `isFeatured: true`. The customer home screen requests `products/featured`, so that
rail renders empty for every real customer today. Not a code fault — nothing has been flagged
featured. Merchandising decision, not an engineering one.

## 4. Where verification stops, and why

The multi-persona flows cannot be driven from an agent session. `OtpService.generateStoreAndDispatch`
logs the OTP **only** when `!isProduction` (`apps/backend/src/auth/services/otp.service.ts:80-89`);
in production it is dispatched to a real inbox or handset and never appears in a response or a log.
That is correct security and must not be worked around — bypassing it would be exactly the fake
state this directive bans.

So registration can be started but never activated from here, and every step past it needs a
session:

```
register -> OTP (out of band) -> activate -> login -> everything else
                    ^ hard stop for an agent
```

**To unblock, one of:**

1. Real activated credentials for each persona — customer, merchant, rider, driver, operations.
   With those, the whole chain (marketplace → cart → checkout → order → merchant accept → rider
   assign → deliver → settlement → Ops visibility) can be driven and reported PASS/FAIL per step.
2. Founder registers on a real device and relays the OTP once per persona.
3. Founder drives the device legs while this session verifies each transition server-side through
   Ops and the API in parallel.

Option 3 is the most faithful to "prove the platform as a system": real hardware where hardware
matters, independent server-side confirmation that each event actually landed.

## 5. Every transition in the protocol has a live route

Probed 2026-08-20 without credentials, which is enough to tell the two cases apart: `401` means
the route is registered and gated, `404 Cannot <METHOD> <path>` would mean it does not exist.
**Zero missing routes** — the five-persona test cannot fail on a missing endpoint.

| Persona    | Transitions checked                                                                                                           | Result      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Customer   | register · verify email/phone · login · merchants · product · cart/items · checkout · order · tracking · verify               | all present |
| Merchant   | register · login · orders · accept · ready · reject                                                                           | all present |
| Rider      | register · login · profile · availability · jobs · accept · pickup · deliver                                                  | all present |
| Driver     | register · login · kyc · vehicles · activation-eligibility · availability · offers · offer accept · start · arrive · complete | all present |
| Operations | login · dashboard counters · rides · driver record · approve · reject                                                         | all present |

## 6. Harness for the device test

`scripts/ops/verify-flow.sh` is the server-side half. After each device action, it reads what the
backend actually holds, so a screen reading "Completed" is never taken as evidence the operation
happened.

```
./scripts/ops/verify-flow.sh login customer ada@example.com 'password'   # -> export DX_TOKEN=…
DX_TOKEN=… ./scripts/ops/verify-flow.sh customer      # identity, cart, orders, wallet
DX_TOKEN=… ./scripts/ops/verify-flow.sh order <id>    # order, tracking, delivery, payment
DX_TOKEN=… ./scripts/ops/verify-flow.sh merchant      # incoming orders
DX_TOKEN=… ./scripts/ops/verify-flow.sh rider         # profile, availability, jobs, wallet
DX_TOKEN=… ./scripts/ops/verify-flow.sh driver        # kyc, vehicles, eligibility, offers, earnings
DX_TOKEN=… ./scripts/ops/verify-flow.sh ops           # counters, activity feed, rides
DX_TOKEN=<ops> ./scripts/ops/verify-flow.sh driver-record <driverId>
```

It only reads. `login` is the single call that writes anything, and only a session, exactly as the
app does. It cannot approve, activate or advance a state — driver approval goes through the real
Ops Console and the script is then re-run to confirm the state actually moved. Nothing in it
bypasses activation or edits a row to let a test proceed.

## 7. Not claimed

- No flow past registration has been executed. Nothing below the OTP wall is marked PASS.
- Real-hardware behaviour (cold launch, push, camera, geolocation) is untested — no device here.
- Google sign-in inside the Capacitor shell remains expected-to-fail pending a native path.
