# Dripplex — Engineering Playbook for Claude

DrippleX is built across many separate Claude sessions and feature branches. This file is
the durable operating guide. Follow it on **every** session so work stays continuous,
aligned to the approved design, and trustworthy.

## 1. Session continuity — always verify previous work

Treat the **previous session's work as the point of reference**. Before continuing,
extending, or building on prior work:

1. **Find where the last session left off** — check out the relevant branch, read its
   latest commits, and read any `docs/DPX-*` design/verification docs it produced.
2. **Verify, don't assume.** Independently confirm what a prior session _reported_ against
   the **actual code** — file existence, migrations, permission-catalog counts, SDK route
   contracts, test assertions. A report doc is a claim; the code is the ground truth.
3. **State the verified baseline** before doing new work, and call out any gap between what
   was reported and what the code actually shows.
4. **Verify repository state before updating progress documentation.** Never mark something
   done in a status/burn-down/audit doc without confirming it in the code first.

## 2. Design fidelity — Figma is the visual source of truth

- Treat the **production Figma as the visual source of truth** for all UI work.
- **Keep the Figma MCP connected when performing UI work** so implementation stays aligned
  with the approved design (confirm with `whoami`; use `get_design_context` / Code Connect
  rather than guessing layout, tokens, or component structure).
- Reconcile implementation against the Figma screen mapping (`docs/reference/dpx-100-figma-screen-mapping.md`,
  `docs/reference/DPX-FIGMA-DIFF-REGISTER.md`) and log differences there.

## 3. No speculative behavior

- **Never invent backend endpoints, business logic, enums, or contracts.** Build only what
  the founder decisions and design docs specify.
- **Document gaps instead of implementing speculative behavior.** When something is missing
  or ambiguous, record it (blockers register / diff register / design doc follow-ups) and
  flag it for founder confirmation — do not silently fill it in.
- Dependencies that don't exist yet (e.g. file upload/storage) are stated as dependencies,
  not invented.

## 4. Branch & PR discipline

- **One feature per branch/PR** whenever practical. Do not stack unrelated features onto an
  already-complete branch — isolation keeps work reviewable, testable, and revertable.
- **PRs are review PRs.** Open a PR for founder review; **never auto-merge**. Wait for
  founder review and approval before merging into `main`.
- Do not start the next major feature area until the current one is reviewed and merged.

## 5. Verification standard

- Backend/SDK/UI tests are the acceptance gate. When claiming "done", verify against real
  Postgres/Redis where behavior touches the DB, and note any pre-existing/unrelated failures
  explicitly rather than folding them into a pass/fail headline.
- **Never bundle verification and publication in one command.** The order is
  `test → inspect the result → fix → retest → then push`. Chaining a test run and a
  `git push` together means the push lands before anyone has read the result; that happened
  on 2026-09-12 during the order-sync increment and put a known-failing commit on the remote
  for one cycle. It was corrected immediately and the final branch was sound, which is exactly
  why the rule is worth writing down rather than trusting to care.
- **A green run is not proof for anything concurrent, and mapped is not reachable.** Two
  defect classes have now shipped past a full green suite: a route that Nest reported as
  `Mapped` but that an earlier parameterised route swallowed, and a race that failed 5 runs
  in 10. Prove a route by driving the running API over HTTP and reading the response _body_
  (which handler answered), and prove a concurrency guard by running it repeatedly and
  reporting the ratio — never by one green run. Report a non-deterministic mutation as the
  ratio it is, not as a clean red.

## Founder decisions already locked

- **No username.** Stable identity is phone (primary) + optional email + name.
- **Customer KYC lifecycle is locked:** `NOT_STARTED → IN_PROGRESS → PENDING_REVIEW →
VERIFIED | REJECTED | EXPIRED | REQUIRES_RESUBMISSION` (`REJECTED`/`REQUIRES_RESUBMISSION`
  re-enter `IN_PROGRESS`; `EXPIRED` terminal from `VERIFIED`). Customer KYC is a **separate**
  model from `DriverKyc` — do not merge them.
- **Merchant commission precedence is locked** (2026-09-11, DPX-MERCHANT-016):
  `Campaign → Negotiated merchant rate → Platform rate`. A negotiated rate is the merchant's
  standing commercial rate; a campaign is exceptional promotional pricing that overrides it only for
  its eligible window, after which resolution returns to the agreement automatically. Negotiated
  rates are strictly `0 < rate < 1` — zero commission is **not** expressible through this control.
  Every financially settled transaction snapshots the negotiated rate in force, so editing an
  agreement can never alter a historical settlement. **Do not change this precedence without
  explicit founder approval.**
- Founder-decision records live under `docs/DPX-*`; read them before changing locked scope.
