# DPX-DRIVER-REDIRECT-001 — `driver.dripplex.com` compatibility redirect

**Date:** 2026-09-13
**Reported by:** founder — two screenshots: Railway's "the train has not arrived at the
station", and an iOS "This Connection Is Not Private".
**Status:** implemented as a review PR. **Nothing has been executed in production.**
**Supersedes:** `DPX-LAUNCH-009-DRIVER-DOMAIN-TLS.md` (see §6).

---

## 1. What is actually wrong

Railway's own domain status for the host:

| Field          | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Attached to    | `@dripplex/driver-portal`, target port 3005                               |
| `verified`     | **false**                                                                 |
| Certificate    | `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP` — stuck, no error recorded |
| CNAME required | `u1jtq3rx.up.railway.app`                                                 |
| CNAME actual   | `hhni6n78.up.railway.app`                                                 |

The CNAME does not match, so ownership validation can never complete and no certificate is
ever issued. That is both screenshots in one line: no certificate gives the iOS warning, and
the stale CNAME lands on a Railway edge target with no binding for this host, which answers
with the "Not Found" page.

Confirmed independently of Railway's view, over DNS-over-HTTPS:
`driver.dripplex.com → hhni6n78.up.railway.app`.

This corrects the earlier reading recorded in DPX-LAUNCH-009 and repeated on 2026-09-13, that
this was a stalled Railway certificate needing Railway support. It is a DNS misconfiguration.

## 2. Why this host broke and its siblings did not

The 2026-08-30 founder decision retired `driver`, `merchant` and `rider`. It removed the
`attach` calls from CI; it did not detach the Railway domain and did not touch DNS.

`merchant` and `rider` survived that anyway, because each has a Cloudflare Worker still
deployed and still answering — both return 200 today, serving their old portals.
`driver` never had a Worker: it is absent from `DEPLOY_APPS` and has no `scripts/cf-build.sh`,
and no `dripplex-driver` Worker has ever existed in the Cloudflare account. Railway was its
only home, so when the Railway attachment went stale there was nothing underneath.

**`rider.dripplex.com` and `merchant.dripplex.com` are still serving their retired portals.**
That contradicts the same founder decision and is deliberately **not** addressed here. It needs
its own decision.

## 3. What is being built

A redirect and nothing else:

```
driver.dripplex.com  →  301  →  https://app.dripplex.com/driver  →  Driver login
```

`apps/driver-redirect` is a Worker with no origin, no assets binding, no service binding and no
`env` — it cannot serve the retired Driver Portal or the customer app, because it has no way to
reach either. 36 tests; 7 mutations, all killed.

The destination already works: `PORTAL_ROUTES` in `apps/super-app/src/app/App.tsx` maps the path
segment `driver` to the `drvlogin` screen, and `https://app.dripplex.com/driver` serves 200 today.

**The path is deliberately dropped.** The old portal had 18 paths (`/earnings`, `/shift`,
`/sos`, `/wallet`, …); the Super App's router recognises 5 (`ops`, `merchant`, `rider`,
`driver`, `fleet`). They share none. Forwarding `/earnings` would reach
`app.dripplex.com/earnings`, match no portal route, fall through to the hostname check and land
a driver on the customer splash.

## 4. Required production sequence

**Do not reorder these.** Attaching the Worker while Railway still holds the domain leaves two
systems claiming one hostname.

1. **Detach** `driver.dripplex.com` from `@dripplex/driver-portal` in Railway.
   (Project `f09361bd-3cda-4f0f-a22a-2ea464e47ab2`, service `fd77d021-611a-493d-82e4-270442df7be9`,
   domain id `6b9b9d84-8ac9-41dd-b30c-38c742a5e39b`.)
2. **Deploy the Worker without binding anything:** dispatch _Deploy Cloudflare Workers_ with
   `apps=driver-redirect`, `confirm=deploy-production`, `attach_driver_redirect=false`.
   Verify `https://dripplex-driver-redirect.<subdomain>.workers.dev/` returns
   `301 → https://app.dripplex.com/driver`. Nothing user-facing has changed at this point.
3. **Attach the hostname:** dispatch again with `attach_driver_redirect=true`. This deletes the
   stale Railway CNAME and creates the Workers Custom Domain. Cloudflare creates the DNS record
   and issues the certificate itself — per Cloudflare's documentation, _"Cloudflare will create
   DNS records and issue necessary certificates on your behalf"_ — which is what removes this
   whole class of failure: the party that owns the record also owns the certificate.
4. **Verify the certificate** resolves for `driver.dripplex.com` (Cloudflare-issued, not
   `*.up.railway.app`).
5. **Verify the redirect** end to end: `curl -sSI https://driver.dripplex.com/` →
   `301`, `location: https://app.dripplex.com/driver`. Repeat for `/login` and `/earnings`.
6. **Verify the destination** in a real browser: `https://app.dripplex.com/driver` reaches the
   **Driver login**, not the customer splash. See §5 — this has not been proved yet.

### Rollback

Deleting the Workers Custom Domain reverts step 3. Cloudflare does **not** delete the
Advanced Certificate it generated — that is a manual removal under SSL/TLS → Edge Certificates.
Leaving it costs nothing but will confuse a later certificate audit.

## 5. Not yet proved

- **`app.dripplex.com/driver` renders the Driver login.** It returns 200 with the super-app
  bundle, and the `/driver → drvlogin` mapping is in the source — but that mapping is
  client-side, so serving 200 does not prove it. Browser verification from this environment was
  attempted and failed: the egress relay closes browser tunnels mid-exchange, identically for
  `accounts.google.com` and `www.google.com`, so it is environmental. **Founder-side check, and
  worth doing before step 3 points a live hostname at it.**
- **Play Console listing.** Whether a store-listing field still publishes the old URL cannot be
  read from here. **Founder-side.**
- **Anything outside `Babaram977/dripplex-platform`.** GitHub access is scoped to that one
  repository. Within it, nothing generates `driver.dripplex.com`:
  `NEXT_PUBLIC_DRIVER_PORTAL_URL` exists in `apps/customer-web/.env.example` and is referenced
  by no code.

## 6. Stale references to clear afterwards

Not touched in this PR — they are wrong under the founder decision either way, and belong in one
controlled follow-up once the sequence above has run:

| File                                                   | Note                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `docs/ops/DPX-LAUNCH-009-DRIVER-DOMAIN-TLS.md`         | 12 refs — obsolete; the 2026-08-30 decision is newer than this 2026-08-18 incident |
| `docs/ops/PRODUCTION-COOLIFY.md`                       | 4 refs                                                                             |
| `docs/ops/DPX-LAUNCH-004-PRODUCTION-VERIFICATION.md`   | 3 refs                                                                             |
| `docs/ops/DPX-LAUNCH-002-CUSTOM-DOMAINS.md`            | 2 refs                                                                             |
| `docs/ops/DPX-LAUNCH-008-DEPLOYMENT-RECONCILIATION.md` | 1 ref                                                                              |
| `scripts/backend/write-env-production.sh`              | 1 ref — CORS origin                                                                |
| `apps/customer-web/.env.example`                       | 1 ref — `NEXT_PUBLIC_DRIVER_PORTAL_URL`, referenced by no code                     |

`apps/super-app/src/app/App.tsx` keeps `driver: 'drvlogin'` — that is the redirect's destination,
not a stale reference.

## 7. What this does not do

It does not restore the standalone Driver Portal. The 2026-08-30 decision stands: the Driver
experience lives in the Super App. This is a doorway for people holding an old link, and the
Worker is built so that it could not become anything more without being rewritten.

The tempting one-line alternative — repointing the CNAME to `u1jtq3rx.up.railway.app` — would
validate the certificate and work immediately, and is rejected precisely because it would
resurrect the retired portal.
