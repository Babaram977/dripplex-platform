# Archived: unrealized release documentation

**Archived:** 2026-07-28, following `docs/AUDIT-PRODUCTION-READINESS.md` and the founder-approved recovery plan (Step 2, Priority 3).

## Why these are here

These three documents (`RELEASE-v1.0.0.md`, `RELEASE-RC1.md`, `PROGRAM-D5.md`) describe a `1.0.0` release and an `rc.1` release candidate as if they shipped. Neither ever did:

- **No `v1.0.0` or `1.0.0-rc.1` git tag exists** in this repository, then or now.
- `PROGRAM_READINESS.md` from the since-closed PR #36 recorded the actual launch attempt's verdict as **NO-GO** — every live-verification check failed, no surface was ever reachable.
- The frontend completeness these documents describe doesn't match the source tree — confirmed independently by both `docs/AUDIT-IMPLEMENTATION.md` (2026-07-28) and `docs/AUDIT-PRODUCTION-READINESS.md` (2026-07-28).

They're archived, not deleted, because they're a real record of what was _attempted_ and _intended_ — useful context for understanding the project's history — but they must not be read as describing a real release. See `docs/RELEASE-HISTORY.md` for the accurate timeline, and correction banners were added to each file before archival for anyone who finds them independently.

## What replaced this

`docs/RELEASE-HISTORY.md` is now the canonical release timeline. It will only ever record a `v1.0.0` tag once the repository actually reaches that point — per the founder's explicit instruction, no tag is created ahead of the work it's supposed to represent.
