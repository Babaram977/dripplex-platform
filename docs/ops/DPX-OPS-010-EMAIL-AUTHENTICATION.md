# DPX-OPS-010 — Email authentication (SPF, DKIM, DMARC)

**Status:** Live state verified 2026-09-02. The DMARC enforcement ramp below is
**not applied** — the records are written out for the founder to paste, because DNS for
`dripplex.com` is on Cloudflare and founder-side. No tooling in an agent session can
change it.

## Why this exists

A DMARC aggregate report arrived at `admin@dripplex.com` on 2026-09-02 and nobody knew
what it was. It is routine — Google sends one daily because the DMARC record asks it to —
but chasing it down surfaced that the domain is in **monitoring only**, which is worth
recording and worth ending.

## Live state (verified 2026-09-02 by DNS-over-HTTPS lookup, not from memory)

| Record                | Value                                                   |
| --------------------- | ------------------------------------------------------- |
| `_dmarc.dripplex.com` | `v=DMARC1; p=none; rua=mailto:admin@dripplex.com; fo=1` |
| `dripplex.com` TXT    | `v=spf1 ip4:181.215.243.96 ~all`                        |
| `send.dripplex.com`   | `v=spf1 include:amazonses.com ~all`                     |
| `resend._domainkey`   | DKIM public key present                                 |
| `dripplex.com` MX     | `10 mail.dripplex.com`                                  |
| `mail.dripplex.com` A | `181.215.243.96`                                        |

## Who legitimately sends as this domain

Exactly two senders, and **both already authenticate**. This is the fact that makes
enforcement safe, and it is the check to repeat before any future tightening.

| Sender          | Path                                   | Authentication                                         |
| --------------- | -------------------------------------- | ------------------------------------------------------ |
| Own mail server | `mail.dripplex.com` = `181.215.243.96` | Covered by the apex SPF `ip4:` term                    |
| Resend (SES)    | Return-path `send.dripplex.com`        | That subdomain's SPF, plus DKIM at `resend._domainkey` |

MX points at the domain's own server, **not** Google Workspace — so there is no third
sender to account for. `mail.dripplex.com` resolving to the exact IP already in the apex
SPF is what confirms the first row rather than assuming it.

## The enforcement ramp

`p=none` collects reports and protects nothing: anyone can send mail claiming to be
`dripplex.com` and it is still delivered. Monitoring is a stage, not a destination — and it
matters more now that a Play listing will carry `support@dripplex.com`, which makes the
brand a phishing target.

Applied at the Cloudflare DNS record `_dmarc`, type `TXT`.

### Step 1 — quarantine a quarter of failing mail

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:admin@dripplex.com; adkim=r; aspf=r; sp=quarantine
```

### Step 2 — after ~1 week of clean reports

Change `pct=25` to `pct=100`.

### Step 3 — after ~2 further clean weeks

Change `p=quarantine` to `p=reject` and drop `pct` entirely.

**No SPF change is needed at any step.** `~all` stays correct: DMARC now carries the
policy, so SPF does not have to be the enforcer.

## Three things about that record that are easy to get wrong

**`aspf=r` is load-bearing. Never "tighten" it to `aspf=s`.** Relaxed alignment is what
lets Resend's `send.dripplex.com` return-path align with a `dripplex.com` From address.
Strict alignment would fail **every transactional email the platform sends** — email
verification included, which would break onboarding. It is the DMARC default, so it is
written explicitly here to survive a future well-meaning edit.

**`fo=1` was dropped.** It only controls forensic reports and there is no `ruf=`, so in
the current record it does nothing at all.

**`sp=quarantine` depends on an unverified value.** DMARC evaluates the policy of the
**From:** header domain. If `RESEND_FROM_EMAIL` (Railway, `@dripplex/backend`) sends as
`…@dripplex.com`, the apex policy applies and `sp` is irrelevant to transactional mail —
safe. If it sends as `…@send.dripplex.com`, then `sp` governs it, and Step 1 must use
`sp=none` instead or transactional mail starts being quarantined.

> **Check `RESEND_FROM_EMAIL` before pasting Step 1.** This was not verifiable from the
> agent session — the value is a Railway secret. It is the one thing in this document
> taken on trust rather than looked up.

## Follow-up worth doing

Point `rua=` at a DMARC analytics service (Postmark and dmarcian both offer free digests)
rather than a human inbox. Raw XML delivered daily to a person is noise that stops being
read within a week, which defeats the purpose of collecting it.
