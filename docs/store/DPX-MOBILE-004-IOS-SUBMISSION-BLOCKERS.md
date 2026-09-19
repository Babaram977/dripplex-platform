# DPX-MOBILE-004 — iOS Submission Blockers

Opened 2026-09-19, at founder request, immediately after build **1.0.0 (1000101)**
was accepted by App Store Connect at 14:20 UTC.

**What this register is for.** Build 1000101 is uploaded and can go to internal
TestFlight today. Nothing below blocks that. Everything below stands between that
build and a public App Store release, and every item lives in App Store Connect
or in a human decision — none of it is code, which is exactly why it goes stale
in conversation and needs writing down.

**What it is not.** `DPX-BLOCKERS-REGISTER.md` catalogues Figma and workflow gaps
that stop a persona completing a business workflow. This one is narrower: the
submission form itself.

**Verification standard.** Each row says how its state was established. Anything
that can only be read from App Store Connect is marked as such rather than
guessed at — CLAUDE.md §1 treats a report as a claim and the code as ground
truth, and App Store Connect is neither, so it is named as unverifiable from
here.

---

## Status at a glance

| #   | Blocker                       | Where              | Verified how                 | State                       |
| --- | ----------------------------- | ------------------ | ---------------------------- | --------------------------- |
| B1  | iPhone screenshots            | App Store Connect  | repository scan              | **None exist**              |
| B2  | Demo account for the reviewer | Review notes → ASC | placeholders present in repo | **Not provided**            |
| B3  | EU DSA trader status          | App Store Connect  | not establishable from repo  | **Unanswered**              |
| B4  | Age rating questionnaire      | App Store Connect  | not establishable from repo  | Ruling made, form not known |
| B5  | Category assignment           | App Store Connect  | ruling in repo               | Ruled, not confirmed set    |
| B6  | Privacy nutrition labels      | App Store Connect  | manifest read from repo      | 11 types ready to enter     |
| B7  | Description, keywords, URLs   | App Store Connect  | template in repo             | Template only               |
| B8  | iPad support decision         | `project.pbxproj`  | read from the project        | **Open decision**           |

---

## B1 — iPhone screenshots do not exist

**Required:** iPhone 6.7" at 1290×2796 and 6.5" at 1284×2778, three to ten each.
Both sizes are mandatory; a submission cannot proceed without them.

**Verified:** the only screenshots in the repository are five Play Store images
at `apps/customer-mobile/resources/play-screenshots/`, every one of them
**1080×1920**. That is Android's 16:9. iOS wants roughly 19.5:9. They cannot be
reused, and padding or upscaling them produces artwork Apple rejects and
customers distrust.

**How they get made:** `apps/customer-mobile/scripts/capture-screenshots.mjs`,
which signs in as a real customer against the real backend and photographs what
that account actually holds. Nothing is mocked or seeded, which is why the shots
are honest and why they need live credentials.

**Constraint:** those credentials are a real customer's. They do not go in a
chat, a CI log, or this repository.

## B2 — The reviewer has no way in

**The hardest blocker here, and the easiest to overlook.**

DrippleX has **no guest mode**. The first screen offers Get Started, Sign In and
Partner, and nothing else. A reviewer without credentials sees a login wall and
rejects on Guideline 2.1.

**Verified:** `docs/store/APP-STORE.md` still contains two
`[FOUNDER/APPLE ACTION]` placeholders where the demo email and password belong.

**It must be pre-verified.** Registration sends an OTP to a Nigerian number,
which Apple's reviewer cannot receive. Sign-in against an already-verified
account needs no OTP, so a pre-verified account is sufficient and a fresh one is
not.

Use the same account prepared for Google Play App access.

## B3 — EU Digital Services Act trader status

Asked of the founder on 2026-09-18 and still unanswered. App Store Connect will
not accept a submission until it is declared. It is a legal declaration about
whether AFNAN HOMES LTD trades in the EU, not a technical setting, so it cannot
be resolved from this repository or by anyone but the founder.

## B4 — Age rating questionnaire

**Ruled 16+** by the founder on 2026-09-18, on the basis that DrippleX does not
sell bets: the customer funds an account they already hold with a licensed
operator, and that operator carries the regulatory obligation.

The ruling settles DrippleX's position. It does not settle how Apple's
questionnaire classifies it, because that is Apple's judgement. Answer from what
the code does: `apps/super-app/src/app/utilitiesScreen.tsx:60` reads
`{ type: 'BETTING', label: 'Betting', icon: 'betting', blurb: 'Fund your account' }`,
sitting in the same list as airtime, data, electricity, cable TV and exam pins; the flow verifies the
named account with the operator and funds it. No odds shown, no bet placed, no
wager settled, no winnings paid inside DrippleX.

## B5 — Category

Travel primary, Utilities secondary — founder ruling, 2026-09-18.

`INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.travel"` is set
in both build configurations. Note that the category shown on the store listing
comes from App Store Connect, not from that key, so setting it in the project
does not set it on the listing.

## B6 — Privacy nutrition labels

Eleven collected data types, verified by reading
`ios/App/App/PrivacyInfo.xcprivacy` — 11 `NSPrivacyCollectedDataType` entries,
each backed by a field in `prisma/schema.prisma` and catalogued in
DPX-MOBILE-003. Tracking is declared false.

The manifest ships in the binary as of build 1000101. The nutrition labels are a
separate form in App Store Connect and must be filled by hand to match it. A
discrepancy between the two is a rejection.

## B7 — Description, keywords, URLs

Template in `APP-STORE.md`. The three URLs were re-probed 2026-09-19 and all
answer `200`: `https://www.dripplex.com/privacy`,
`https://www.dripplex.com/contact`, `https://www.dripplex.com`. Use the `www`
form — the apex answers 308 and bounces.

The description still needs writing as marketing copy rather than a feature list.

One gap rides along here: the privacy policy page still carries a placeholder
registered-office address in its source (DPX-LEGAL-001 §1/§22) and Nigerian legal
review is not complete. The URL resolves, so it does not block submission, but
Apple links customers to a page that is not finished.

## B8 — iPad support is still undecided

`TARGETED_DEVICE_FAMILY = "1,2"` declares iPad support, so Apple **will** review
on iPad and **will** expect iPad screenshots at 2048×2732.

Changing it to `"1"` is a one-line edit that removes an entire review surface and
an entire screenshot set. Tracked as D6 in the iOS preflight. Founder decision,
not taken. It is cheaper to decide before submission than after a rejection.

---

## Not blockers

- **Push notifications.** The APNs key is uploaded to Firebase for both
  environments, and build 1000101 is the first to contain the AppDelegate
  callbacks and FirebaseMessaging. Push working or not does not gate the
  submission; it gates the feature, which is worse to discover after launch.
- **Export compliance.** `ITSAppUsesNonExemptEncryption = false` is in
  `Info.plist`, so App Store Connect does not ask.
- **Account deletion.** In-app from Settings, `DELETE /auth/me`, verified live.
- **Build number.** 1000100 and 1000101 are spent. The project is at 1000102 and
  `verify-config.mjs` fails any archive at or below the last uploaded build.
