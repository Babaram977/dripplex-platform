# DPX-COMMISSION-002 — A maximum window for commission campaigns

**Status:** PROPOSAL. Ships inert. Awaiting a founder ruling on the ceiling.
**Raised:** 2026-09-17, during the ops-console migration (step 4).
**Decides:** how long "exceptional promotional pricing" may run.

This document exists because a boundary is missing, not because a bug was
found. Nothing here is a defect report against anyone's work; the behaviour
below is what the code was built to do, and the question is whether it should
keep being allowed to.

---

## 1. The invariant that exists today

`CommissionCampaignService.assertWindow` is the only validation a campaign's
window receives, on both create and update:

```ts
private assertWindow(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new ValidationDomainException('A campaign must end after it starts');
  }
}
```

Verified as the single seam: the only two writes that touch `startsAt` /
`endsAt` are `create` (service:160) and `update` (service:243), and both call
`assertWindow` first. The other four writes to `commissionCampaign` set
`status` or `announcedAt` only, and the two `updateMany` calls are the sweep's
status transitions. There is no bypass.

## 2. What is absent

**A maximum.** A window is legal at any length provided it ends after it
starts. `endsAt: 2099-01-01` passes validation exactly as `endsAt: tomorrow`
does.

## 3. Zero commission is intentional, and is not the problem

This needs saying plainly, because it looks like the problem and is not.

| Control                                                   | Rate bound                  | Zero allowed? |
| --------------------------------------------------------- | --------------------------- | ------------- |
| Negotiated merchant rate (`SetMerchantNegotiatedRateDto`) | `@Min(0.0001) @Max(0.9999)` | **No**        |
| Commission campaign (`CreateCommissionCampaignDto`)       | `@Min(0) @Max(0.9999)`      | **Yes**       |
| Commission campaign (`assertRate`, service:538)           | `rate < 0 \|\| rate >= 1`   | **Yes**       |

The asymmetry is the locked ruling working as designed. The negotiated rate
refuses zero on the stated grounds that a partner DrippleX charges nothing is
_a decision with no ceiling on its cost_ — and the ruling names the campaign as
the instrument for expressing exactly that, bounded in time.

So a zero-rate campaign is legitimate. **The time-bounding is the safeguard,
and the time-bounding is what has no ceiling.**

## 4. The consequence

Three properties compose:

1. `commissionRate: 0` is valid.
2. A campaign with no `rules` applies platform-wide within its scope. The
   sweep's own comment describes activation as telling _"every merchant on the
   platform that the rate changed"_.
3. The window has no maximum.

Therefore **permanent, platform-wide, zero commission is expressible in one
authenticated `POST`**, by any holder of `admin:commission-campaign:manage`,
with no second approval. "Exceptional promotional pricing, for its eligible
window" is the locked description of this instrument; a window with no ceiling
does not express _exceptional_.

This is reachable today only in principle: the standalone
`apps/operations-console` cannot call the API at all (its origin receives no
`Access-Control-Allow-Origin`). **That is why the five campaign mutations were
held back from ops.dripplex.com in #432** — porting them is what would make
this operationally reachable, and doing so before the policy is settled would
turn an unresolved boundary into a live production control.

`docs/DPX-MERCHANT-016` precedence is unaffected and was verified intact:
`merchant-settlement.service.ts:170-193` composes `negotiatedRate ??
platformRate` and hands it to the campaign resolver, snapshotting
`commissionCampaignId` on the settlement. Campaign → Negotiated → Platform.

## 5. Candidate enforcement locations

| #     | Location                                            | Notes                                                                                                                                                                                                                         |
| ----- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | `assertWindow` — **what this PR implements**        | One seam, already called by both write paths. Cannot be enforced on create and missed on update. Rejects at the service boundary with a message naming the limit and the ask.                                                 |
| B     | DTO validators (`@MaxDate` / custom)                | Declarative and visible in the contract, but must be duplicated across Create and Update DTOs, and a validator cannot see `existing.startsAt` when only `endsAt` is being changed — precisely the case W2 in the spec covers. |
| C     | Database `CHECK` constraint                         | Strongest, unbypassable by any code path. But it cannot produce an actionable message, and the ceiling becomes a migration rather than a reviewed constant.                                                                   |
| D     | A separate approval for long or zero-rate campaigns | Orthogonal to a ceiling and a larger change: it needs a second-person model this codebase does not yet have.                                                                                                                  |

A and C are complementary rather than alternatives. A is proposed now because
it is reviewable, reversible and message-bearing; C is worth considering once a
number exists.

## 6. No ceiling is chosen here

`COMMISSION_CAMPAIGN_MAX_WINDOW_MS` is `null`, and `null` means today's
behaviour exactly. **Merging this PR changes nothing.**

How long exceptional pricing may run is a commercial commitment, of the same
kind as the Campaign → Negotiated → Platform precedence it sits beside. It is
not engineering's to pick, and picking one quietly — even a conservative one —
would be choosing a commercial policy by default. The constant is the one place
a founder sets it, in its own reviewed change, which is the same shape
`RECOVERY_ACTIVATION_AT` uses for the recovery backstop and for the same
reason.

**The open question:** what is the longest a single commission campaign may
run? A related one, deliberately left separate: should a zero-rate campaign
face a _shorter_ ceiling, or an additional approval, than a reduced-rate one?

## 7. What the tests demonstrate

`commission-campaign-window-bound.db.spec.ts`, 15 tests, against real Postgres.

**With no ceiling configured — the state this merges in:**

- the constant is `null` and the resolver says so — this fails if a default is
  ever smuggled in
- a **seventy-three-year** window is still accepted
- a **permanent, platform-wide, zero-rate** campaign is still accepted, and is
  recorded as a passing test rather than described in prose, so the gap is
  demonstrable rather than asserted
- an inverted window is still refused

**With a ceiling configured (90 days, used only as a test fixture — not a
proposal):**

- a window inside it is accepted
- a window exactly at it is accepted
- a window one millisecond over is refused
- the permanent zero-commission campaign this document is about is refused
- **`update` refuses too, not only `create`** — a ceiling enforced on create
  alone is a ceiling an operator steps around by editing
- the refusal names the limit and the ask, so it is actionable

**The resolver fails OPEN**, deliberately unlike `resolveRecoveryActivationAt`,
which fails closed. There, an unreadable boundary must stop the platform moving
money by itself. Here, an unreadable boundary must not start refusing every
campaign including a one-day one, so zero, negative, `NaN` and `Infinity` all
resolve to "no ceiling".

Six mutations, each reddening at least one test: a ceiling smuggled in as a
default; the bound enforced on create but not update; an off-by-one refusing a
window exactly at the limit; the bound skipped entirely; the resolver failing
closed instead of open; and the refusal message dropping its numbers.

## 8. What this does NOT do

A ceiling bounds the window a single campaign may **declare**. It does not stop
an operator extending a campaign repeatedly by rolling `endsAt` forward inside
the limit, because `update` re-validates the resulting window rather than the
total time a campaign has been in force.

Bounding _that_ needs a rule about cumulative duration, and possibly
re-approval — neither of which is implied by a maximum window, and neither of
which is invented here. Recorded so it is a known limitation rather than one
rediscovered later.
