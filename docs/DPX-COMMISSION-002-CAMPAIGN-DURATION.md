# DPX-COMMISSION-002 — Campaign duration is an Ops-controlled parameter

**Status: RULED, 2026-09-18.** A maximum campaign window was proposed and
**declined**. Campaign duration is set by the Operations Console as part of the
campaign, subject only to `endsAt > startsAt`. The platform imposes no ceiling
and none is to be added.

|          |                                                                                |
| -------- | ------------------------------------------------------------------------------ |
| Raised   | 2026-09-17, during the commission-campaigns migration to ops.dripplex.com      |
| Proposed | `COMMISSION_CAMPAIGN_MAX_WINDOW_MS`, a code constant shipping inert            |
| Ruled    | 2026-09-18 — no maximum; duration is Ops-controlled and intentionally flexible |
| Proof    | `apps/backend/src/commercial/commission-campaign-window.db.spec.ts`            |

## What was found

`assertWindow` bounds a campaign only by `endsAt > startsAt`. There is no
maximum. Alongside that:

- `commissionRate` is valid at **0**. Deliberately: the negotiated merchant
  rate refuses zero (`0 < rate < 1`), on the grounds that a partner DrippleX
  charges nothing is a decision whose cost has no ceiling — and the locked
  precedence names the campaign as the instrument for expressing it.
- A campaign with no `rules` applies **platform-wide** within its scope.

Together those make a **permanent, platform-wide, zero-commission** campaign
expressible in one authenticated call.

## What was proposed, and why it was declined

The proposal was a maximum window as a reviewed code constant — the pattern
`RECOVERY_ACTIVATION_AT` uses for the recovery backstop — shipping `null` so
that merging it changed nothing until a founder chose a number.

**The founder declined it.** How long exceptional pricing runs is an
operational decision, not a property the platform should constrain in advance.
A fixed ceiling would either be so generous as to be theatre, or would one day
refuse a legitimate commercial arrangement at the worst possible moment, with
the remedy being a code change and a deploy rather than a decision in the
console. Ops owns the window because Ops owns the commitment.

The ceiling machinery was removed rather than left inert: a dormant seam
invites someone to set a number without a ruling.

## What this means in practice

- **Any duration is expressible**, from an hour to decades, on create and on
  update alike.
- **An invalid window is still refused** — `endsAt` must be strictly after
  `startsAt`, on both write paths. Flexible is not unvalidated.
- **Zero-rate campaigns remain expressible**, unchanged.
- **`Campaign → Negotiated → Platform` precedence is untouched.** Campaign
  resolution is covered by `commission-rate-resolver.service.spec.ts`; nothing
  in this ruling changes it.
- **Every settled transaction still snapshots the rate in force**, so ending or
  editing a campaign can never alter a historical settlement.

## The risk is accepted by design — these are the controls that remain

With no duration ceiling, three controls carry the weight. They are asserted,
not assumed:

1. **Permission.** Reading campaigns needs `commission:campaigns:read`; all
   five mutations — create, update, pause, resume, archive — need
   `commission:campaigns:manage`. Pinned in the spec, because a mutation that
   silently dropped to READ would let anyone who can view campaigns set a
   platform-wide rate.
2. **Audit.** Every mutation records an audit action.
3. **Visibility and reversibility.** The Operations Console shows the window on
   every campaign and lets Ops shorten or pause one at any time. **This is the
   real answer to a campaign running too long: Ops can stop it.** The platform
   does not need to have refused to let them start it.

## What is deliberately NOT solved

**Cumulative duration is not bounded.** An operator can roll `endsAt` forward
repeatedly; `update` validates the resulting window, not the total time a
campaign has been in force. Under a ceiling this would have been a gap; under
Ops-controlled duration it is simply the same decision made again, and each
edit is permissioned and audited like any other. Recorded so nobody later reads
its absence as an oversight.

## History

- **2026-09-17** — Gap found while porting the campaigns desk to
  ops.dripplex.com. The five mutations were **held** pending this ruling; the
  read-only surface shipped as #432.
- **2026-09-17** — Ceiling proposed as #433, shipping inert.
- **2026-09-18** — **Ruled: no maximum.** Duration is Ops-controlled. Ceiling
  machinery removed, the five mutations released, and this document rewritten
  from a proposal into the decision record.
