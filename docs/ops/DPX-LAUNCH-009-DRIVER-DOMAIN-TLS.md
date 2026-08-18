# DPX-LAUNCH-003 — `driver.dripplex.com` serves the wrong TLS certificate

**Date:** 2026-08-18
**Reported by:** founder — "drivers get a security warning"
**Status:** diagnosed; the remedy is a Railway dashboard action, not a code change.

---

## 1. What a driver sees

`https://driver.dripplex.com` presents a certificate for `CN=*.up.railway.app`. That name does
not cover `driver.dripplex.com`, so every browser refuses the connection and shows a full-page
security warning. Nobody can sign in past it.

Ignoring the warning does not help either: past the handshake the host returns Railway's edge
fallback, not the app.

```
$ curl -k -i https://driver.dripplex.com/
HTTP/2 404
server: railway-hikari
x-railway-fallback: true
{"status":"error","code":404,"message":"Application not found"}
```

## 2. The driver app itself is healthy

This is a domain problem only. The same deployment serves fine on its Railway hostname:

| URL                                                       | Certificate              | HTTP  |
| --------------------------------------------------------- | ------------------------ | ----- |
| `https://dripplexdriver-portal-production.up.railway.app` | valid (Railway)          | `200` |
| `https://driver.dripplex.com`                             | `CN=*.up.railway.app` ❌ | `404` |

Railway reports the service `@dripplex/driver-portal` **online**, one replica running, no issues.
**Until the domain is repaired, drivers can use the `.up.railway.app` URL above** — it is the same
app, with a valid certificate.

## 3. Every other `dripplex.com` hostname is fine

Measured this pass, not assumed:

| Host                    | Certificate served    | HTTP  | DNS shape                         |
| ----------------------- | --------------------- | ----- | --------------------------------- |
| `dripplex.com`          | `CN=dripplex.com`     | `200` | Cloudflare-proxied                |
| `www.dripplex.com`      | `CN=dripplex.com`     | `200` | Cloudflare-proxied                |
| `merchant.dripplex.com` | `CN=dripplex.com`     | `200` | Cloudflare-proxied                |
| `admin.dripplex.com`    | `CN=dripplex.com`     | `200` | Cloudflare-proxied                |
| `ops.dripplex.com`      | `CN=dripplex.com`     | `200` | Cloudflare-proxied                |
| `api.dripplex.com`      | `CN=api.dripplex.com` | `200` | CNAME → `29fwdwci.up.railway.app` |
| `driver.dripplex.com`   | `CN=*.up.railway.app` | `404` | CNAME → `hhni6n78.up.railway.app` |

Two different arrangements are in use. Four subdomains sit behind Cloudflare's proxy, which
terminates TLS with Cloudflare's own `dripplex.com` certificate. `api` and `driver` are DNS-only
CNAMEs straight at Railway, so Railway must issue their certificates itself. `api` got one.
`driver` did not.

## 4. The DNS record is not the fault

The obvious theory — that the CNAME points at a stale target — was tested and does not hold.
Railway's edge routes by **`Host` header**, not by which `*.up.railway.app` entry point the DNS
resolves to. Both entry points behave identically when addressed by their own name:

```
$ curl -i https://hhni6n78.up.railway.app/   → 404 x-railway-fallback: true   (driver's target)
$ curl -i https://29fwdwci.up.railway.app/   → 404 x-railway-fallback: true   (api's target, works)
```

So the difference between `api` and `driver` is not the DNS value. It is that Railway's edge has a
binding for the host `api.dripplex.com` and none for `driver.dripplex.com`.

## 5. Root cause

Railway's API _does_ hold the custom-domain record — service `@dripplex/driver-portal`, domain id
`9a495f90-387b-4930-95e1-c67e5f952ffd`, `targetPort: 3005`, which matches the service's `PORT`.
But the record was never provisioned through to a live binding: no certificate was issued and the
host was never registered at the edge. It has been in that state since the domains were configured
on 2026-08-05.

This was foreseeable from the record. DPX-LAUNCH-002 §2 could not verify DNS or reachability that
pass and closed the item as "trust Railway's dashboard" — and the dashboard was never re-checked
for this one subdomain. The four Cloudflare-proxied hostnames masked the same class of problem,
because Cloudflare serves its own certificate regardless of what Railway did.

Ruled out along the way:

- **A second Railway project claiming the domain** (which would block issuance). The three
  duplicate projects in the workspace — `surprising-friendship`, `optimistic-fulfillment`,
  `zonal-freedom` — were checked service by service. None holds any custom domain. _Note: all
  three still exist in the Railway API despite being reported deleted._
- **A port mismatch.** `targetPort: 3005` matches the running service.
- **A dead deployment.** The service is online and answering `200`.

## 6. The fix

Railway's public API exposes no certificate or DNS-validation status, and the MCP tooling has no
way to detach and re-attach a custom domain, so this cannot be driven from a session. Both
attempts are recorded rather than hidden: re-attaching the domain returned
`Failed to create custom domain` (it already exists), and `redeploy` refused because the service's
most recent deployment record is a path-filtered `SKIPPED` with no build to copy.

**In the Railway dashboard:**

1. `overflowing-unity` → `@dripplex/driver-portal` → **Settings → Networking → Custom Domains**.
2. Open `driver.dripplex.com` and read its status and the CNAME value Railway requires.
3. **Remove the domain, then add it again** with target port `3005`. This regenerates the record
   and re-runs DNS validation and certificate issuance.
4. Set the Cloudflare record for `driver` to whatever CNAME value Railway shows after the re-add,
   **DNS only (grey cloud)** — the same shape `api.dripplex.com` already uses.
5. Wait for Railway to show the domain green, then verify.

**Verification — the certificate subject must change:**

```
curl -sv https://driver.dripplex.com/ -o /dev/null 2>&1 | grep subject:
```

It must report `CN=driver.dripplex.com`, not `CN=*.up.railway.app`. Then confirm the page loads:

```
curl -s -o /dev/null -w "%{http_code}\n" https://driver.dripplex.com/     # expect 200
```

No `x-railway-fallback: true` header should remain.

## 7. Nothing else needs to change

`CORS_ORIGINS` on the backend already includes `https://driver.dripplex.com` (DPX-LAUNCH-002 §4),
so the driver app will reach the API as soon as the hostname resolves and the certificate is
valid. No code, environment variable, or deployment change is part of this fix.

## 8. Follow-up worth doing at the same time

The four Cloudflare-proxied subdomains have never been confirmed green on the Railway side either
— Cloudflare's certificate hides whether Railway ever issued one. They work today, but they are
working through the proxy, not because the Railway custom domain is healthy. Worth a look at the
same dashboard screen while it is open.
