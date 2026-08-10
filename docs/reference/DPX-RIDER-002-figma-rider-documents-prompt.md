# Figma Make prompt — Rider "Upload Documents" screen (DPX-RIDER-002)

Paste the block below into **Figma Make** (the DrippleX super-app file,
`rsHHFRxHVE3OKv81p7m3K1`). It adds a rider documents screen that reuses the
existing driver **Upload Docs** design verbatim, so the design file stays the
visual source of truth for what already shipped in code (PR #97).

Do **not** paste a file path — Figma Make is sandboxed and can't read the repo.
Paste the prompt text itself.

---

## Prompt

Add a new **Rider Documents** screen to `onboardingScreen.tsx`, placed right
after `DriverDocumentsScreen` (Screen 5). It must reuse the **exact same design
system** as `DriverDocumentsScreen` — do not invent new styles, colours, or
components. Reuse the existing `StatusBar`, `BackBtn`, `Ambient`,
`SectionDivider`, `DocumentCard`, `FieldGroup`, `GreenBtn`, `ArrowIcon`, and the
existing `BG`, `NAVY_CARD`, `NAVY_SURFACE`, `BORDER`, `MUTED`, `PP`, `IT`, `G2`,
`G3` tokens. Same dark navy gradient background, same `fade-up` animations, same
spacing and radii as the driver screen.

Name the component `RiderDocumentsScreen({ onBack, onSubmit })`.

Layout, top to bottom (identical shell to `DriverDocumentsScreen`):

1. `Ambient` + `StatusBar`, then `BackBtn` (calls `onBack`) in the top-left,
   `px-6 pt-3`.
2. Scrollable body `px-5 pb-10`. Header block (`px-2 mb-6`):
   - `h1` "Upload your documents" — Poppins, 24px, white, `letterSpacing:-0.02em`.
   - subtitle "We verify these to ensure everyone's safety" — Inter, 14px, `MUTED`.
3. `SectionDivider label="Required documents"`.
4. A `flex flex-col gap-3.5 mb-6` group with **two** `DocumentCard`s (NOT three,
   and NO vehicle section):
   - `icon="🪪"  title="Government ID"   docKey="id"`
   - `icon="🧑‍⚖️" title="Guarantor ID"    docKey="gur"`
     Each keeps the standard `DocumentCard` internals: icon bubble, title, the
     `StatusPill` (default "pending"), a "Document number" `TextInput`, and the
     "Upload file" / "Take photo" button row — same as the driver cards.
5. `SectionDivider label="Company"`.
6. A `flex flex-col gap-4 mb-8` group with **one** `FieldGroup`:
   - `label="Company name"  id="companyName"  placeholder="e.g. Jumia Logistics"`
   - helper text below it: "The company you deliver for (optional)".
7. `GreenBtn label="Submit for review"` (with `ArrowIcon`), disabled until both
   document numbers are filled; calls `onSubmit`.
8. Footer line, centred, 12px, `rgba(255,255,255,.24)`:
   "Our team typically reviews applications within 24–48 hours".

Rider accent colour is green (`G2`/`G3`), matching the existing rider sign-up
badge (🚴 "Rider") — do not use the driver's blue.

Wire it into the app flow so the **rider** persona goes:
Rider sign-up → email OTP → **Rider Documents** → Pending Review
(the driver already follows the equivalent path through `DriverDocumentsScreen`).

Optionally update `RIDER_STEPS` in the Pending Review screen from
`["Application submitted", "Under review"]` to
`["Documents submitted", "Under review", "Account approved"]` so the rider
checklist reflects the new document step. Keep it a static design checklist —
do not wire live status.

Do **not** add a vehicle section, a Year field, or any ride-category dropdown —
those are driver-only. The rider screen is just: two ID documents + one company
name field.

---

## Why this exists

The shipped code (`apps/super-app/.../onboardingScreen.tsx`, PR #97) already
implements this exact screen, adapted from the driver Upload Docs design because
**Figma has no rider documents frame**. This prompt brings the Figma file up to
parity so design remains the source of truth. See
`docs/reference/DPX-FIGMA-DIFF-REGISTER.md` (DPX-RIDER-002 section) for the
logged deviation.
