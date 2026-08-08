# DPX-BLOCKERS-REGISTER — Integration Blockers

Founder-requested 2026-08-08. Distinct from the other two registers on purpose:

- **Missing Figma Design Register** (`dpx-100-figma-screen-mapping.md`) and **Missing Backend
  Register** (same file) catalogue every individual gap, screen by screen.
- **This register** answers a narrower, sharper question: _which of those gaps actually stop a
  real Customer, Driver, or Merchant from completing a real business workflow_ — the ones that
  block the 20-driver beta, not every open item.

Scope: only **missing Figma screens** that block a workflow. Screens where Figma already has the
design and only the customer-web integration is outstanding (e.g. Driver Dashboard) are **not**
blockers in this register — they're tracked as ordinary remaining work in the burn-down table
(`dpx-100-figma-screen-mapping.md`). Conflating "no design exists" with "design exists, not built
yet" is exactly the distinction this register exists to keep clean.

Severity: **Critical** (blocks the persona entirely or blocks beta launch) · **High** (blocks a
core workflow step, workarounds are impractical) · **Medium** (blocks a secondary workflow) ·
**Low** (cosmetic/account-management, no workflow impact).

---

```
BLOCKER #001

Severity
CRITICAL

Persona
Merchant

Workflow blocked
Merchant onboarding -- entirely. Zero Figma screens exist for Merchant (business profile, KYC,
bank details, product management, order handling -- nothing).

Reason
No approved Figma design for any Merchant screen.

Backend
✓ Complete (merchant.controller.ts, ~30 SDK methods, DB complete)

Owner
Founder

Action
Design Merchant onboarding + management screens in Figma.

Status
Waiting.
```

```
BLOCKER #002

Severity
CRITICAL

Persona
Driver

Workflow blocked
Driver Registration cannot complete. The backend refuses to move status from DRAFT to SUBMITTED
without an emergency contact on file (OnboardingService.submitForReview -- hard validation, not
optional). A driver can register a vehicle and upload KYC documents but can never reach Waiting
Approval, and therefore can never be approved to drive.

Reason
No Figma screen exists for Emergency Contact entry, anywhere among the 13 Driver App screens.

Backend
✓ Complete (POST /driver/onboarding/emergency-contact)

Owner
Founder

Action
Design an Emergency Contact screen in Figma (name + phone -- the only two fields the backend
accepts, DriverProfile.emergencyContactName/emergencyContactPhone).

Status
Waiting.
```

```
BLOCKER #003

Severity
CRITICAL

Persona
Driver

Workflow blocked
Same as #002 -- Driver Registration cannot complete. The backend also hard-requires agreement
acceptance before SUBMITTED (same validation call, same missing-screen problem).

Reason
No Figma screen exists for Driver Agreement Acceptance, anywhere among the 13 Driver App screens.

Backend
✓ Complete (POST /driver/onboarding/agreement)

Owner
Founder

Action
Design a Driver Agreement Acceptance screen in Figma (accept a versioned agreement --
DriverProfile.agreementAcceptedAt/agreementVersion).

Status
Waiting.
```

---

## Customer

No Critical or High blockers found. Register, OTP/Google Sign-In, browse/order Marketplace, book a
Ride, and use the Wallet are all covered by existing Figma screens with live backend/SDK (see the
burn-down table) -- no missing-Figma gap stops a Customer from completing a core workflow today.

## Not a blocker (tracked elsewhere, listed here only to avoid double-counting)

Driver Dashboard and the 6 trip-lifecycle screens (Incoming Request, Nav to Pickup, Verify
Passenger, Trip In Progress, Trip Completed) plus Driver Settings all have real Figma screens
already -- they're integration work still to do, not a Figma gap. They stay in the burn-down
table's "remaining" column, not here.

---

## Summary

| #   | Severity | Persona  | Blocks                       | Owner   | Status  |
| --- | -------- | -------- | ---------------------------- | ------- | ------- |
| 001 | CRITICAL | Merchant | Merchant onboarding entirely | Founder | Waiting |
| 002 | CRITICAL | Driver   | DRAFT -> SUBMITTED           | Founder | Waiting |
| 003 | CRITICAL | Driver   | DRAFT -> SUBMITTED           | Founder | Waiting |

**No High, Medium, or Low blockers identified** as of 2026-08-08 -- everything else outstanding is
either (a) already-designed Figma screens awaiting integration (burn-down table, not this
register), or (b) Figma-exists/backend-missing account-management screens (2FA, trusted devices,
etc. -- Missing Backend Register) that don't block a core business workflow.

**Per founder instruction: integration work is paused pending resolution of #001-#003.** Not
resuming Driver Dashboard or any other new feature group until this register is updated to reflect
approved Figma designs for the blockers above.

---

_Compiled 2026-08-08. Owner: founder. Compiled/maintained by: Claude, per DPX-FIGMA-001._
