# DPX-PORTAL-RETIREMENT-001 · Merchant & Rider portals — evidence, not authority

**Status: evidence gathered. No retirement authority established. Nothing changed.**

This record exists because two documents disagree about whether the Merchant and Rider portals
are retired, and because the safe operational position — **do not delete them** — should rest on
recorded evidence rather than on whichever document was read last.

> **Nothing in this document authorises deletion, disabling, redirection or dismantling of any
> portal.** It reports what is deployed and what the documents say. The retirement decision
> itself is a founder/operational ruling that has **not** been made.

---

## 1 · The contradiction

| Source                                                          | Claim                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ops/DPX-DRIVER-REDIRECT-001-COMPATIBILITY-REDIRECT.md` §2 | "The 2026-08-30 founder decision **retired** `driver`, `merchant` and `rider`."                                                                                                                                   |
| Same document, same section                                     | "**`rider.dripplex.com` and `merchant.dripplex.com` are still serving their retired portals.** That contradicts the same founder decision and is deliberately **not** addressed here. It needs its own decision." |
| `docs/ops/PRODUCTION-RAILWAY.md:54`                             | Both Railway services deployed SUCCESS from PR #384 on 2026-09-13; both hostnames answer HTTP 200. Records the same contradiction as unresolved.                                                                  |

Both documents already flag the conflict. Neither resolves it, and neither claims the authority
to.

---

## 2 · What is actually deployed (verified 2026-09-14)

### Live HTTP (read-only GET, no credentials, nothing mutated)

| Host                    | Status                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `merchant.dripplex.com` | **200**                                                                                                         |
| `rider.dripplex.com`    | **200**                                                                                                         |
| `app.dripplex.com`      | **200** (Super App)                                                                                             |
| `ops.dripplex.com`      | **200** (same Railway service as the Super App)                                                                 |
| `driver.dripplex.com`   | **000** — does not resolve/connect; consistent with DPX-DRIVER-REDIRECT-001's account of a DNS misconfiguration |

### Two independent delivery paths per portal

Merchant and Rider each have **two** live surfaces, which matters because removing one would not
remove the portal:

1. **Railway services** — `merchant-portal` (`e5faaec7-…`), `rider-portal` (`fbf274cb-…`),
   both deployed SUCCESS from PR #384 on 2026-09-13.
2. **Cloudflare Workers** — each has `apps/<portal>/scripts/cf-build.sh` present.
   `driver-portal` has **no** `cf-build.sh`, which is exactly why `driver` had no Worker to
   survive on when its Railway attachment went stale.

### CI still deploys them — by default

`.github/workflows/deploy-cloudflare-workers.yml:77`:

```
DEPLOY_APPS: ${{ github.event.inputs.apps || 'customer-web,merchant-portal,rider-portal,operations-console' }}
```

**`merchant-portal` and `rider-portal` are in the default deploy set.** They are not residue left
behind by a decommissioning that forgot to clean up — the pipeline actively redeploys them.

This sharpens the earlier account. The 2026-08-30 decision removed the **Railway domain `attach`
calls** from CI; it did **not** remove these apps from the **Cloudflare Worker** deploy list. So
"retired" was never operationally true for these two, and has not been since.

`operations-console` is in that same default list, while `ops.dripplex.com` is served by the
Super App service — a second, related inconsistency, recorded here and **not** acted on.

---

## 3 · Code present in the repository

| App                    | Source files (`.ts`/`.tsx`) |
| ---------------------- | --------------------------- |
| `apps/super-app`       | 195                         |
| `apps/merchant-portal` | 30                          |
| `apps/rider-portal`    | 21                          |

The Super App is the consolidated experience (Customer, Driver, Merchant, Operations). The two
portals are materially smaller, but "smaller" is not "empty", and file counts say nothing about
whether the functionality they carry is still relied upon.

---

## 4 · Why "old" must not be read as "safe to delete"

- **The Driver toggle.** A driver can toggle into delivery participation, so the rider/delivery
  experience may be a **mode within the Driver product**, not a superseded separate product.
  Treating `rider-portal` as redundant assumes an answer to that.
- **Both hosts answer 200 today**, so any traffic they currently serve is real traffic.
- **CI redeploys them**, so a deletion would have to change the pipeline as well as the services
  — and a partial removal could leave a hostname pointing at nothing, which is precisely the
  `driver.dripplex.com` failure mode already observed.
- The documents that call them "retired" simultaneously record that they are **not** retired in
  practice. That is not authority to act.

---

## 5 · What would have to be established first

Open questions, none of which this document answers:

1. What functionality does each portal currently provide that the Super App does not?
2. Is any of it part of the intended operating model — particularly the rider/delivery mode?
3. Who is actually using these hostnames today?
4. What is the authoritative retirement decision, and does it supersede the 2026-08-30 one?
5. If retirement is confirmed: the ordered, non-destructive sequence — CI deploy list, then
   Worker, then Railway service, then domain, then DNS — such that no hostname is left resolving
   to nothing.

**Until those are answered: do not delete, disable, redirect or dismantle either portal.**

Cloudflare and DNS remain outside the scope of any engineering-session change.
