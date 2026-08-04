# DPX-UX-001 — Simplicity First

Established by the founder during the Wallet module's DPX-100 build, as a
permanent engineering principle — not scoped to one module or one slice.
It applies to every screen, flow, and backend decision from here on,
alongside the DPX-100 methodology and the
[Module Completion Gate](./DPX-100-MODULE-COMPLETION-GATE.md).

## The question every screen must answer

> Can the user complete this task in fewer steps without sacrificing
> security or clarity?

## The rules

1. **One primary action per screen.** Every screen should have one
   obvious action (Wallet → Send Money, Ride → Book Ride, Marketplace →
   Buy Now). Avoid competing CTAs.
2. **Reduce taps.** Always ask whether a flow can be one tap instead of
   two, or two screens instead of four. Example: a wallet transfer should
   be recipient → amount → reference → continue, not a multi-step
   bank-picker wizard.
3. **Smart defaults.** Remember user preferences — last payment method,
   favourite ride type, Home/Work addresses, default bank account,
   preferred delivery address — instead of asking every time.
4. **Don't ask twice.** If the backend already has the information (name,
   phone, email, saved address, vehicle preference), don't re-collect it
   in a form.
5. **Progressive disclosure.** Advanced options stay hidden until the
   user needs them; don't front-load every setting on every screen.
6. **Minimize forms.** Prefer pickers, toggles, chips, search, and
   autofill over long free-text forms wherever the data allows it.
7. **Fast confirmations, except where it matters.** Skip confirmation
   dialogs for reversible/non-destructive actions (add to cart, save
   address, bookmark). Require them for money movement and destructive
   actions (withdraw, delete account, send money, cancel ride, place
   order).
8. **Shallow navigation.** No workflow should normally exceed 3-4 screens
   (e.g. Wallet Transfer: recipient+amount → PIN/biometric → success).
9. **Backend does the assembly.** APIs should return data that's ready to
   render; don't make the frontend stitch together multiple responses to
   paint one screen.
10. **Every new step must justify itself.** Before adding a screen,
    dialog, or field, ask: does it reduce user effort, or is it required
    by security/compliance/business rules? If neither, don't add it.

## How this interacts with the DPX-100 methodology

DPX-UX-001 does not relax pixel parity with the locked Figma export or
the Module Completion Gate's ten items — it's an additional filter
applied on top of them, at two points:

- **When a flow's step count isn't fully pinned by Figma** (e.g. how many
  taps a backend-driven confirmation takes), prefer the shallower path
  that still satisfies security/compliance requirements.
- **When a genuine simplification is found that doesn't reduce
  functionality or safety**, implement it and note it explicitly in the
  module's slice notes (`MATURITY.md`) or production audit — don't let it
  pass silently, since it's a deliberate deviation from a literal 1:1
  port and future readers should know why.

Money-movement and destructive-action confirmations (rule 7) are never
something to simplify away for the sake of fewer taps — that boundary is
fixed regardless of how this principle is applied elsewhere.
