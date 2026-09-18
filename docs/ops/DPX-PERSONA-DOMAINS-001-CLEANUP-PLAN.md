# DPX-PERSONA-DOMAINS-001 — Persona domain cleanup plan

**Status:** read-only plan. **No production change has been made.**
Nothing was deployed, detached, deleted or re-pointed to produce this document.

**Date:** 2026-09-14
**Author:** Claude (Repository/Implementation/CI)
**Decision owner:** Founder

---

## Canonical architecture (founder statement, 2026-09-14)

`https://app.dripplex.com` is the single comprehensive DrippleX application for
all personas — Customer, Driver, Rider and Merchant. Persona-specific
experiences are selected **within** that application and its authenticated
shell, not maintained as separate portal applications.

`driver.dripplex.com`, `rider.dripplex.com` and `merchant.dripplex.com` are
legacy persona domains requiring an explicit migration and retirement plan.

---

## 1. What each hostname currently serves

Measured 2026-09-14 03:46 UTC by `curl -sS -D -` against each host, plus the
Railway and Cloudflare control planes. Not from documentation — several
documents disagree with what is actually running.

| Hostname                | Serves today                               | Evidence                                                                                                                               |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `app.dripplex.com`      | **Super App** (Railway `super-app`)        | HTTP 200, `server: railway-hikari`, `content-disposition: index.html`; Railway custom domain on `super-app`                            |
| `ops.dripplex.com`      | **Super App**, Ops Console screen          | HTTP 200, same Railway service; second custom domain on `super-app`                                                                    |
| `dripplex.com`          | 308 → `www.dripplex.com`                   | `server: railway-hikari`; Railway custom domains on `@dripplex/customer-web`                                                           |
| `www.dripplex.com`      | Marketing site (`customer-web`)            | Railway custom domain on `@dripplex/customer-web`                                                                                      |
| `rider.dripplex.com`    | **A separate Rider Portal application**    | HTTP 200, `server: cloudflare`, `cf-ray: a3ac680c…`, `<title>DrippleX Rider Portal</title>` — Cloudflare Worker `dripplex-rider`       |
| `merchant.dripplex.com` | **A separate Merchant Portal application** | HTTP 200, `server: cloudflare`, `cf-ray: a3ac6811…`, `<title>DrippleX Merchant Portal</title>` — Cloudflare Worker `dripplex-merchant` |
| `driver.dripplex.com`   | **Nothing usable — TLS failure**           | `curl: (60) SSL: no alternative certificate subject name matches target host name`                                                     |

### The finding that matters

A founder decision of **2026-08-30** retired `merchant.`, `rider.` and
`driver.`, and `.github/workflows/deploy-cloudflare-workers.yml` was changed to
stop attaching them. **The DNS records were never removed.** So:

- `rider.` and `merchant.` are _retired in the pipeline and live on the
  internet_. Their Workers still build and deploy on every merge — both were
  rewritten at 22:24 and 22:25 UTC on 2026-09-13 by the referral merges — and
  each still answers with its own separate persona application.
- `driver.` had no Worker to keep answering, so it degraded instead of
  disappearing.

This is the fragmentation. It is not only a Driver problem, and it is not
merely "legacy domains to redirect": **two separately-built persona
applications are live right now** alongside the Super App's own persona
experiences.

### Why `driver.dripplex.com` is broken specifically

`driver.dripplex.com` is still attached as a Railway custom domain to the
retired `@dripplex/driver-portal` service (target port 3005), and its DNS is
pointed at the wrong Railway target:

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Required CNAME | `u1jtq3rx.up.railway.app`                      |
| Current CNAME  | `hhni6n78.up.railway.app` (status: PROPAGATED) |
| Ownership      | `verified: false`                              |
| Certificate    | `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` |

Ownership validation can never complete against the wrong target, so no
certificate is ever issued. This corrects `docs/ops/DPX-LAUNCH-009`, which
attributes the failure to a stalled certificate: the certificate is stalled
_because_ of the CNAME mismatch, and re-issuing it changes nothing.

---

## 2. Which hostname becomes canonical

`app.dripplex.com` — already serving, already the Android shell's origin
(`apps/customer-mobile/capacitor.config.ts`), already carrying the
`apple-app-site-association` for Universal Links.

`ops.dripplex.com` is **kept** as a second hostname on the same application.
It is not a separate app: it opens the Ops Console screen of the Super App by
hostname label. Operations is a desktop tool with its own audience, and the
address is in use by staff.

No other persona hostname remains an entry point.

---

## 3. Existing routes inside `app.dripplex.com` per persona

From `PORTAL_ROUTES` in `apps/super-app/src/app/App.tsx`. A visitor's portal is
resolved from the path, then `?app=`, then the hostname's leading label:

| Persona     | Route       | Screen                     |
| ----------- | ----------- | -------------------------- |
| Customer    | `/`         | splash → customer home     |
| Driver      | `/driver`   | `drvlogin` → `drvdash`     |
| Rider       | `/rider`    | `riderlogin` → `riderdash` |
| Merchant    | `/merchant` | `mxdash`                   |
| Fleet owner | `/fleet`    | `fleetconsole`             |
| Operations  | `/ops`      | `admindash`                |

Verified live: `https://app.dripplex.com/driver` returns HTTP 200 from the
Super App.

Each route carries its own sign-in gate, so a URL grants no access by itself.

### The hostname-label rule is the thing being retired

`portalFromHostname()` matches the **leading DNS label** against the same map.
That is what lets `rider.dripplex.com` or `merchant.dripplex.com` open a
persona if they are ever pointed at the Super App — and it is the mechanism
that keeps persona hostnames meaningful in code.

Retiring it is the end state of this cleanup, and it must come **last**: while
any legacy hostname still points at the Super App, removing the rule would send
those visitors to the customer splash instead of their persona.

---

## 4. Which legacy domains redirect, and to exactly where

| Legacy hostname         | Becomes           | Target                              |
| ----------------------- | ----------------- | ----------------------------------- |
| `driver.dripplex.com`   | 301 redirect only | `https://app.dripplex.com/driver`   |
| `rider.dripplex.com`    | 301 redirect only | `https://app.dripplex.com/rider`    |
| `merchant.dripplex.com` | 301 redirect only | `https://app.dripplex.com/merchant` |

Redirect only. No origin, no bindings, no ability to serve a portal — the
property that stops a compatibility doorway from quietly becoming a second
application again.

`apps/driver-redirect` already implements exactly this for Driver
(`DRIVER_ENTRY_POINT = 'https://app.dripplex.com/driver'`, 36 tests). It is
merged and has never been deployed. Rider and Merchant need the same Worker,
parameterised — one Worker with a hostname → path map is preferable to three
near-identical copies, for the reason the bank-name matching in this codebase
drifted across five call sites.

**Path preservation:** the Driver redirect deliberately discards the incoming
path. `driver.dripplex.com/earnings` becomes `app.dripplex.com/driver`, not
`app.dripplex.com/earnings` — which would match no portal route and land the
visitor on the customer splash. The same rule applies to Rider and Merchant.

---

## 5. Cloudflare changes required

**DNS (zone `dripplex.com`)**

| Record     | Today                              | After                                  |
| ---------- | ---------------------------------- | -------------------------------------- |
| `driver`   | CNAME → `hhni6n78.up.railway.app`  | Worker custom domain                   |
| `rider`    | CNAME → Worker `dripplex-rider`    | Worker custom domain (redirect Worker) |
| `merchant` | CNAME → Worker `dripplex-merchant` | Worker custom domain (redirect Worker) |

**Workers**

- `dripplex-driver-redirect` — deploy and attach `driver.dripplex.com`. The
  workflow already has the gated step (`attach_driver_redirect`, default
  false).
- `dripplex-rider`, `dripplex-merchant` — these are the _portal_ Workers. Their
  hostnames move to the redirect Worker; the portal Workers themselves stay
  deployed on their `workers.dev` URLs so nothing is destroyed and rollback is
  one DNS change.
- `dripplex-ops`, `dripplex-customer-web` — untouched.

**Not required:** no Worker deletion. Deleting a Worker to "clean up" removes
the rollback path.

---

## 6. Railway changes required

| Service                     | Custom domain                          | Action                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@dripplex/driver-portal`   | `driver.dripplex.com` (port 3005)      | **Detach.** Must happen before the Cloudflare attach — two providers cannot both own the hostname                                                                                                           |
| `@dripplex/merchant-portal` | `merchant.dripplex.com` (port 8080)    | **Detach.** Stale: Railway reports `DNS_RECORD_STATUS_REQUIRES_UPDATE` with an empty current value, i.e. nothing points at it. It is an attachment with no traffic, and it will fight the Cloudflare attach |
| `@dripplex/rider-portal`    | none                                   | Nothing to do                                                                                                                                                                                               |
| `super-app`                 | `app.dripplex.com`, `ops.dripplex.com` | **Unchanged**                                                                                                                                                                                               |
| `@dripplex/customer-web`    | `dripplex.com`, `www.dripplex.com`     | **Unchanged**                                                                                                                                                                                               |

`merchant.dripplex.com` being attached in Railway _and_ served by Cloudflare is
a live inconsistency: the Railway certificate sits at `ISSUING` and will never
complete, exactly as Driver's did. It is not currently harmful because nothing
resolves to it — but it is the same trap one DNS edit away.

---

## 7. TLS / certificate implications

- **Driver:** the certificate is stalled because ownership can never validate
  against the wrong CNAME. Detaching from Railway and attaching to a Cloudflare
  Worker custom domain issues a fresh certificate through Cloudflare and ends
  the error drivers see today. Expect a short window during propagation where
  the host is unreachable rather than wrong — preferable to the current state.
- **Rider and Merchant:** already served over valid Cloudflare certificates.
  Moving the hostname from the portal Worker to the redirect Worker is a
  Cloudflare-internal change; the certificate covers the hostname either way,
  so **no TLS interruption is expected**.
- **HSTS:** `rider.` and `merchant.` currently serve
  `strict-transport-security: max-age=63072000; includeSubDomains; preload`.
  Two years, with preload. The redirect Worker **must** continue to serve
  HTTPS on these hostnames — a browser that has seen that header will refuse
  plain HTTP for two years, and `includeSubDomains` means this cannot be undone
  by removing the header.
- **`app.dripplex.com` and `ops.dripplex.com`:** untouched throughout. No step
  in this plan alters the certificate of a hostname that is working.

---

## 8. Remaining references to the legacy persona domains

Swept across `*.ts, *.tsx, *.js, *.json, *.md, *.yml, *.yaml, *.jsonc,
*.example, *.env*`, excluding `node_modules` and `dist`.

**Live, and must change with the migration**

| File                                                                        | What it says                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy-cloudflare-workers.yml`                           | Builds `NEXT_PUBLIC_APP_URL` for the portal Workers from `PROD_MERCHANT_URL`/`PROD_RIDER_URL`, defaulting to `https://merchant.dripplex.com` / `https://rider.dripplex.com`. A portal that redirects must not also be told it lives at that address |
| `apps/customer-web/.env.example`                                            | `NEXT_PUBLIC_DRIVER_PORTAL_URL`, `NEXT_PUBLIC_MERCHANT_PORTAL_URL` still point at the legacy hosts                                                                                                                                                  |
| `infrastructure/uptime-kuma/monitors.json`                                  | Monitors `merchant.dripplex.com/` and `rider.dripplex.com/` expecting a portal. After the migration these must assert a **301 to the canonical path**, or they will page on success                                                                 |
| `infrastructure/monitoring/prometheus/prometheus.yml`, 3 Grafana dashboards | Scrape/label the legacy hosts                                                                                                                                                                                                                       |
| `infrastructure/kubernetes/ingress/ingress.yaml`                            | Ingress rules for the legacy hosts (pre-Railway; confirm whether this cluster is live before touching)                                                                                                                                              |

**Documentation to reconcile** (`DPX-LAUNCH-009` is actively wrong about the
Driver cause; `DPX-LAUNCH-002`, `DPX-LAUNCH-004`, `PRODUCTION-COOLIFY.md`,
`DEPLOYMENT_REPORT.md`, `PRODUCTION_READINESS.md`, `PROGRAM-D1.md`,
`MERCHANT-RIDER-PACKAGING.md`, and the `docs/archive/pre-railway-*` set, which
is archive and can be left as history).

**Correct already, no change needed**

- `apps/customer-web/src/lib/site.ts` — `crossPortalUrls` keeps only
  `operations`; the driver and merchant entries were removed on 2026-08-30.
- `apps/driver-redirect/src/*` — the redirect Worker and its 36 tests.

**Not checked by this sweep, and a real gap:** transactional email templates
and push deep links are generated by the backend, and any that were authored
with a persona hostname would not appear in a repository grep of these file
types. **Before step 1, someone must confirm** whether driver/rider/merchant
notification emails and deep links reference the legacy hosts. I have not
verified this and am not guessing.

---

## 9. Impact on the Admin Console UI and links

**None.**

`apps/super-app/src/app/adminConsoleScreen.tsx` contains no persona entry links
at all. Its only `href` attributes are KYC document images and profile photos.
There is no "Customer → app / Driver → driver.dripplex.com" link set in the
console to unify — the console navigates in-app (`go('drvlogin')`), which is
function calls, not URLs.

The second Ops application, `apps/operations-console`, likewise contains no
`dripplex.com` hostname anywhere in its source.

So the persona-link fragmentation the console appeared to have is not in the
console's code. It is the DNS reality described in §1, which is what the
migration below fixes.

---

## 10. Migration order, with rollback

Each step is reversible on its own. Nothing here is authorised yet.

**Gate 0 — parity confirmation (founder/product, not engineering)**

The 2026-08-30 decision asserts every capability of the Rider and Merchant
portals — SOS, shifts, earnings, wallet, KYC, onboarding, campaign — exists in
the Super App. **That claim is not verified in this document and must be
confirmed before Rider or Merchant is redirected.** Redirecting a working
portal to a persona experience that is missing a capability takes a function
away from live partners. Driver does not need this gate: its portal is already
gone, and the hostname serves nothing.

**Step 1 — Driver** _(lowest risk: the hostname is already broken)_

1. Detach `driver.dripplex.com` from `@dripplex/driver-portal` in Railway.
2. Run the Workers workflow by manual dispatch with
   `attach_driver_redirect=true` — it deletes the conflicting DNS record and
   attaches `dripplex-driver-redirect`.
3. Verify: `curl -sI https://driver.dripplex.com/` → `301` with
   `location: https://app.dripplex.com/driver`, valid certificate.
   _Rollback:_ re-attach the Railway custom domain and restore the CNAME. The
   state being restored is a broken hostname, so rollback is only meaningful
   during propagation.

**Step 2 — Rider** _(after Gate 0)_

1. Add `rider.dripplex.com` to the redirect Worker's hostname map; deploy.
2. Move the Cloudflare custom domain from `dripplex-rider` to the redirect
   Worker.
3. Verify the 301, then update the uptime monitor to expect it.
   _Rollback:_ re-attach the hostname to `dripplex-rider`. The portal Worker is
   still deployed and still serving on its `workers.dev` URL, so this is one
   change and takes effect at Cloudflare speed.

**Step 3 — Merchant** _(after Gate 0)_
Same as Step 2, plus detach the stale Railway custom domain from
`@dripplex/merchant-portal`.
_Rollback:_ as Step 2.

**Step 4 — references**
Workflow env defaults, `.env.example`, uptime monitors, Prometheus/Grafana,
and the documentation corrections in §8. Repository-only; no production change.

**Step 5 — retire the hostname-label rule** _(last)_
Remove `portalFromHostname()` so a persona is chosen by path only. Safe only
once no legacy hostname points at the Super App. Until then it is load-bearing.
_Rollback:_ revert the commit.

**Step 6 — decommission** _(optional, much later)_
Delete the `@dripplex/driver-portal` Railway service and the `rider-portal` /
`merchant-portal` Workers once the redirects have run long enough that nothing
is asking for the portals. Deliberately last: while they exist, every step
above rolls back in minutes.

---

## What is NOT in this plan

- No production change of any kind has been made.
- No DNS record, Cloudflare Worker, Railway domain or certificate was created,
  modified, deleted or detached.
- No financial logic, no data deletion.
- `app.dripplex.com` and `ops.dripplex.com` are untouched at every step.

## Open questions for the founder

1. **Gate 0:** is the Super App at capability parity with the Rider and
   Merchant portals? Engineering cannot settle this by inspection.
2. **`ops.dripplex.com`:** confirmed as a keeper — a second hostname on the one
   application, not a separate app?
3. **Email and deep links** (§8): who confirms whether transactional email and
   push deep links reference the legacy hosts?
4. **Sequencing:** Driver alone first, or all three together after Gate 0?
   Driver is independently safe because its hostname is already broken.
