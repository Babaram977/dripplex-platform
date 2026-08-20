# DPX-LAUNCH-010 — Production flow verification

Run 2026-08-20 against live `https://api.dripplex.com/api/v1`. Founder directive: prove the
platform as a system, with real accounts and real data — no mock data, no fake states, no
simulator. Nothing here is asserted from reading code; every line is a real request and its real
response.

**Gate 1 (database backup):** founder confirmed backups switched on. Note for the record: "switched
on" schedules future snapshots — it is not the same as a snapshot existing now, nor as a restore
having been proven. Confirm the first snapshot has completed before any destructive change.

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

## 5. Not claimed

- No flow past registration has been executed. Nothing below the OTP wall is marked PASS.
- Real-hardware behaviour (cold launch, push, camera, geolocation) is untested — no device here.
- Google sign-in inside the Capacitor shell remains expected-to-fail pending a native path.
