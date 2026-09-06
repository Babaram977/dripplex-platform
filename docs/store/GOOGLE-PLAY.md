# Google Play — store listing (draft)

Use this draft when creating the Play Console listing. Replace placeholders before public release.

## Developer account — legal entity

**Founder decision 2026-08-30: DrippleX publishes under an _organization_ Play
developer account**, in the name of AFNAN HOMES LTD — not an individual account.
That is what makes the D-U-N-S below required rather than optional.

These are the values the Play Console asks for on an organization account. They
must match the Dun & Bradstreet record exactly, character for character — Google
verifies against it.

| Field               | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Legal entity        | **AFNAN HOMES LTD** — not "DrippleX", which is its trading name             |
| RC number           | RC 9387949                                                                  |
| Entity type         | Private Limited Liability Company                                           |
| **D-U-N-S number**  | **352296291**                                                               |
| Registered address  | No. 58–60 UDB Road, By Tarauni Primary, Nasarawa, Kano, Kano State, Nigeria |
| Telephone of record | +234 803 973 9780                                                           |

The D-U-N-S was issued by Dun & Bradstreet on **2026-08-28 10:09 UTC** (case
10859055, tracking 10797660, request key BVD5Z3B3P9) and verified through the
national registry. D&B says the record becomes visible **2–3 business working
days** after resolution — so from **2026-09-02**. Do not start verification
before then: a lookup against a record that has not propagated returns nothing,
which stalls the application rather than queuing it.

⚠️ **One consequence to check at enrolment.** Google publishes a verified
developer's contact details on the store listing, which for an organization
account means the legal name and, depending on the current policy, the
registered address and a contact email are shown to anyone viewing the app on
Play. If that address being public is not wanted, the time to raise it is before
verification, not after. This paragraph is a prompt to check the Console's
current requirements — it is not authority on them, and no Play policy text is
quoted anywhere in this repo.

The internal-testing track in `docs/mobile/BETA-DISTRIBUTION.md` runs on whatever
account is already in use and is **not** blocked by any of this.

### Account email — `play@dripplex.com`

The Play developer account is held by **`play@dripplex.com`**, a role address on the
company's own mail server (`mail.dripplex.com`), **not** a personal Gmail.

A Google account does not have to be a `@gmail.com` address — "use my current email
address instead" at signup creates one against an address you already own. That mattered
practically (Gmail signup was failing: SMS verification codes never arrived, the usual
symptom of a phone number that has hit Google's per-number account cap), but it is the
right choice regardless of that:

- **It survives people.** A developer account on an individual's Gmail dies with that
  person's access — and takes the app, the signing key and the ability to ship updates
  with it. That is not quickly recoverable through Google support.
- Access can be reset through DrippleX's own mail server rather than depending on someone's
  personal phone.
- It matches AFNAN HOMES LTD as the account holder rather than an individual.

Keep the mailbox alive and monitored. Everything Google sends about this account — policy
warnings, review rejections, suspension notices — goes there and nowhere else.

### Console signup — values entered

| Console field        | Value                                     |
| -------------------- | ----------------------------------------- |
| Organization size    | 1–10                                      |
| Organization website | `https://www.dripplex.com` — **verified** |
| Organization phone   | `+2347038888300` (app support line)       |

**Organization website is `https://www.dripplex.com`**, not `app.dripplex.com`.
`www` serves the marketing site (customer-web); `app` serves the application shell and is
`noindex, nofollow`, which is not an organization's website.

**The two phone numbers are both correct and serve different purposes** (founder,
2026-09-02): `+2347038888300` is the **app support line** and is what the Play Console
carries; `+234 803 973 9780` in the identity table above is the **founder's direct
contact**. They were briefly flagged here as a possible Dun & Bradstreet mismatch — they
are not one. Do not "reconcile" them to a single value.

### Website ownership verified — 2026-09-02

Verified as a Search Console **Domain property** on `dripplex.com`, using Google's
Cloudflare DNS integration. A domain property was chosen over URL-prefix because it covers
the apex and **every** subdomain in one verification, and because the file and meta-tag
methods would each have required a code change and a Railway deploy to customer-web
(`apps/customer-web/public/` carries no verification file, and no `google-site-verification`
meta tag exists anywhere in the app).

The token written to the apex:

```
google-site-verification=Ngyh9dOP2JKN1zJN6SHCDWDpaP0O45bgCkUg1ILjunk
```

> ⛔ **Do not delete this TXT record.** Removing it un-verifies the domain in Search
> Console, and the Play developer account's website verification lapses with it.

**Confirmed by external DNS lookup after the integration ran**, because a tool writing to
a live zone is exactly when to check rather than assume. The apex went from one TXT record
to two — Google's token was **added alongside** the SPF, not in place of it — and `_dmarc`,
`send.dripplex.com`, the MX and `mail.dripplex.com` were all unchanged. Had the integration
replaced the apex TXT instead, every transactional email would have started failing SPF
silently, and it would have surfaced days later as bounced verification mail rather than as
an error anyone could see.

**Follow-up if not already done:** the Search Console property must list
`play@dripplex.com` as an **Owner** (Settings → Users and permissions). Play sends the
website-verification request to the property's registered owner, so if the property was
verified under a personal Google account, the developer account's verification depends on
that personal account remaining accessible.

### D-U-N-S propagation window has passed

The record resolved 2026-08-28 and D&B quoted 2–3 business days to become visible, so
**2026-09-02 is the earliest date a Google lookup can succeed**. That date has arrived.
Starting verification earlier would have stalled the application rather than queuing it.

### 2026-09-05 — the account was locked out for two days, and the app was deleted

**This supersedes the transfer/conversion reasoning in the section below.** Both routes
described there assumed two things that are no longer true: that an account could reach
the Console, and that there was an app to move.

> **Appeal accepted 2026-09-05.** Access to the organization account is restored, so the
> access half of this section is history. What follows is kept as the record of what
> happened and why it must not happen again. The organization account is **`dx_tech`,
> account ID 8449411381684511998** — a different account from the personal `dX_hub` that
> held the deleted app. Its identity was verified 2026-09-03 and its website ownership
> 2026-09-04, both via `play@dripplex.com`.

**The organization account exists, is paid for, and is D-U-N-S verified — and was for two
days unreachable.** It was created under **`play@dripplex.com`**, and Google **disabled that
Google account on 2026-09-04**, with:

> It looks like this account was created or used with multiple other accounts to violate
> Google's policies. The account might have been created by a computer program or bot.

Founder's account of the cause, 2026-09-05: repeated sign-in attempts from changing
networks while travelling. That is a false positive rather than a real violation, which is
the kind of case an appeal is for — but it is Google's automated judgement that has to be
reversed, and until it is, the paid organization account cannot be opened by anybody.

- **Appeal submitted 2026-09-05.** Google quotes ~2 business days; it was submitted on a
  Saturday, so **2026-09-08/09** is the realistic window.
- The account is scheduled to be **considered for deletion from 2027-07-31** if never
  restored. That is the outer bound, not the deadline that matters.
- **No AAB was ever uploaded to the organization account.** Nothing is half-migrated there:
  a successful appeal returns a clean, paid, verified account.

**And the app is gone from the account that held it.** `com.dripplex.customer` lived on
the personal account **`dX_hub` (account ID 8299498816806668700)** as a Draft on the
internal testing track with 0 installed audience — and the founder **deleted it** from
that account. So there is no app to transfer and nothing to convert.

#### Resolved 2026-09-05: the package name IS spent

Confirmed in the Console. Creating the app on the organization account with
`com.dripplex.customer` is refused:

> This package name is already in use. Use a different package name.

So the rename is not a contingency any more — it is required. `com.dripplex.app` replaces
it; see `claude/android-application-id`. The reasoning that follows is kept because it is
the explanation, and because the same trap applies to the new name: **once
`com.dripplex.app` has a bundle uploaded, deleting that app spends it too.**

#### Why it was spent

Play does not let a deleted app's package name be reused. `com.dripplex.customer` had a
bundle uploaded before deletion — `versionCode 1000100`, internal testing 2026-08-27 — so
the name was used, not merely reserved.

> **Unverified, and it decides whether there is code work.** Play's behaviour for a draft
> that was uploaded but never _publicly published_ is not quoted anywhere in this repo and
> no agent session can read the Console. Do not plan around either answer until it is
> tested.

**Tested 2026-09-05 on the organization account: Play rejected the name.** That settles
it — `claude/android-application-id` is required, not contingent.

**Do not test by uploading to `dX_hub`.** Uploading binds whichever package name is used
to that personal account, which recreates the transfer problem this section exists to
describe.

#### While the appeal is open

- **Do not create another Google account, and do not enrol a second developer account.**
  Play treats a second developer account opened while the first is suspended or under
  appeal as evasion, and it can terminate the new one too — this time with the company's
  name and D-U-N-S attached to a termination.
- **Do not upload anything to `dX_hub`**, for the reason above.
- **Distribute by sideloading.** The signed APK needs no Console: it installs from a link
  and is enough for the Kano tester cohort and for the Gate C device pass.
- **Keep the evidence** — the card charge for the developer fee, the D&B resolution email,
  the disable screenshot and the appeal confirmation. A second-stage appeal goes better
  with dates and receipts.

---

### ⚠️ `com.dripplex.customer` is already claimed — settle this before creating anything

> **Superseded 2026-09-05 by the section above.** The app has since been deleted from the
> account that held it, so neither the transfer route nor the conversion route below is
> available. Kept because the reasoning about `applicationId` being permanently bound
> still explains why the package name may now be unusable.

**A new organization account cannot publish the existing app.** On Play an
`applicationId` is globally unique and permanently bound to the account that first
published it, and `com.dripplex.customer` has already been published: `versionCode`
`1000100` reached internal testing on 2026-08-27 (recorded in
`scripts/mobile/build-android.sh`). A brand-new account is a different account.

So the signed AAB built for submission — `versionCode 29805597`, run 33606040775 — can
only be uploaded from **the account that already holds the app**, unless one of the
routes below is taken first.

**Check this before creating a second account:** whether the existing developer account
can simply be **converted** to an organization account. If Google allows it, that is
strictly better than everything below — the package name, the Play App Signing key, the
internal testing track and the built AAB all survive untouched, with no transfer and no
rebuild. Look under the account's identity/verification settings in the Console.

> Not verified here. Play's account-identity policy is not quoted anywhere in this repo,
> it changes, and no agent session can read the Console. Treat this as the first thing to
> check, not as an assurance that it is available.

**If conversion is not available**, order matters:

1. Create the organization account with the identity values above.
2. **Complete verification first.** Do not transfer into an unverified account.
3. Transfer `com.dripplex.customer` to it via Google's app-transfer process.
4. Only then upload `versionCode 29805597`.

**Do not create a second app under a new `applicationId`** unless transfer is genuinely
closed off. It costs the internal testing track, the Play App Signing key and any install
base, it starts a fresh listing with no history, and it invalidates the current AAB —
`applicationId` is compiled in, so it needs a code change and a rebuild.

### Which account held the app — answered 2026-09-05

The gap this section recorded is closed, and the answer is part of the problem.

`com.dripplex.customer` was held by the **personal** account **`dX_hub`, account ID
8299498816806668700** — confirmed from the Console on 2026-08-31, showing one app,
`com.dripplex.customer`, status Draft / Internal testing, 0 installed audience. The
founder has since **deleted** that app.

The organization account under `play@dripplex.com` is a _different_ account and never held
it.

## App details

| Field                            | Value                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- |
| **Title**                        | DrippleX                                                                   |
| **Short description** (80 chars) | Book rides, order from local shops, pay bills and send money — one wallet. |
| **Full description**             | See below                                                                  |
| **Category**                     | Travel & Local (founder-selected 2026-09-06)                               |
| **Tags / keywords**              | marketplace, food delivery, Nigeria, wallet, rides, pharmacy, airtime      |
| **Privacy Policy URL**           | `https://www.dripplex.com/privacy`                                         |
| **Account deletion URL**         | `https://www.dripplex.com/account-deletion`                                |
| **Support URL**                  | `https://www.dripplex.com/contact`                                         |
| **Email**                        | support@dripplex.com                                                       |

**Title casing is `DrippleX`** (founder-confirmed 2026-09-06), matching
`android/app/src/main/res/values/strings.xml` and `capacitor.config.ts`.

`parcel` left the keyword list with the copy below: nothing in the codebase
sends a standalone parcel. `DeliveryJob` exists, but it delivers a
marketplace `Order` — there is no customer-facing "send a package" flow.

**Category resolved 2026-09-06: Travel & Local.** `Shopping` was chosen when
the listing was a marketplace draft; the founder changed it in the Console
once rides led the product. `Finance` was the other candidate and was not
taken — it carries extra Play scrutiny for no listing benefit.

Listing URLs use **www**, because the bare apex 308-redirects to it
(`apps/customer-web/next.config.ts`). The apex forms still resolve — Google
follows the redirect — but pointing the Console straight at the destination
avoids a needless hop and keeps the value stable if the redirect is ever
tightened.

### Full description — final copy (2026-09-06)

Replaces the earlier template, which was written before the app was built
and described two things that do not exist: **parcels** (no standalone
send-a-package flow) and **home services** (`MerchantCategory` has
`SERVICES`, but it is a merchant listing category, not a booking product).
Every line below was checked against the code on 2026-09-06 — see the
verification note after the block.

2,032 of 4,000 characters.

```
DrippleX brings the things you do every day into one app: getting around, getting things delivered, paying bills, and moving money.

ONE WALLET FOR EVERYTHING
Top up your DrippleX Wallet with your bank card or a bank transfer, then use the same balance across the whole app. Send money to another DrippleX user with just their phone number or email address. Withdraw to any Nigerian bank account. Every transfer gets its own reference and receipt, so you always have a record.

Your wallet is protected by a PIN you set yourself, and you can view or download a statement for any month.

RIDES
Book Economy, Comfort, XL or Tricycle. You see the fare before you book, not after. Track your driver on the map, share your live trip with someone you trust, and pay with your wallet, cash or card. Rate your driver at the end, add a tip if you want to, and keep the receipt.

Emergency SOS is built into every trip. If something feels wrong, hold the SOS button and DrippleX Operations is alerted immediately with your trip details and your location.

SHOP AND GET IT DELIVERED
Browse supermarkets, restaurants, pharmacies, electronics stores, fashion, beauty, hardware, furniture and wholesalers near you. Add to your cart, check out with your wallet, and follow your order from the shop to your door.

HOTELS
Find and book rooms directly in the app.

BILLS AND TOP-UPS
Buy airtime and data for any network. Pay for electricity and get your token. Renew cable TV. Buy exam result-checker PINs. All from your wallet balance.

REWARDS
Earn loyalty points as you use the app, and get rewarded when friends you invite join DrippleX.

STAY IN TOUCH
Call or message your driver or delivery rider inside the app, without sharing your personal phone number.

EARN WITH DRIPPLEX
The same app is where you drive, deliver, or sell. Sign up as a driver, a delivery rider, or a merchant and start earning.

BUILT FOR NIGERIA
Prices in naira. Payouts to Nigerian banks. Support that understands where you are.

DrippleX is operated by AFNAN HOMES LTD.
```

#### What each claim rests on

| Claim                                            | Code                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Wallet top-up / withdraw / send                  | `wallet/customer-wallet-funding.controller.ts`, `wallet/withdrawal.service.ts`, `POST /customer/wallet/transfer` |
| Send by phone **or email**                       | `wallet/wallet-recipients.service.ts` (`findByPhone` / `findByEmail`)                                            |
| Reference + receipt per transfer                 | `WALLET_TRANSFER_REFERENCE_TYPE`, `WalletTransferReceiptDto`                                                     |
| Wallet PIN, monthly statement                    | `wallet/wallet-pin.service.ts`, `GET /customer/wallet/statement`                                                 |
| Economy / Comfort / XL / Tricycle                | `enum RideType` (schema.prisma)                                                                                  |
| Fare before booking                              | `POST /customer/rides/estimate`                                                                                  |
| Share live trip                                  | `POST /customer/rides/:id/share` → `ShareTripScreen`                                                             |
| **Emergency SOS**                                | `POST /customer/sos-alerts` — DPX-SAFETY-001, shipped 2026-09-06                                                 |
| Merchant categories listed                       | `enum MerchantCategory` (12 values; the 9 named are real)                                                        |
| Order → delivery tracking                        | `model Order`, `model DeliveryJob`, `model DeliveryTracking`                                                     |
| Hotels                                           | `model Booking`, `apps/super-app/src/app/hotelBookingScreens.tsx`                                                |
| Airtime / data / electricity / cable / exam PINs | `enum UtilityServiceType`                                                                                        |
| Loyalty points, referrals                        | `model LoyaltyAccount`, `model Referral`                                                                         |
| In-app call / message                            | DPX-MOBILE-002 (LiveKit), ride chat                                                                              |

#### Deliberate omission — betting top-ups

`UtilityServiceType.BETTING` (funding a bookmaker account) is live and is
**not** named in the listing. Google Play's real-money gambling policy is
country-gated and strictly enforced, and advertising bookmaker funding
invites a reviewer to apply it. Nigerian VTU platforms treat this as an
ordinary bill payment, and DrippleX is not a gambling operator — so the
feature ships, it is simply not marketed. **Founder confirmation wanted**
before that changes.

#### Do not publish this listing before the SOS build ships

The Emergency SOS paragraph became true on 2026-09-06 (DPX-SAFETY-001).
Any APK/AAB built before that commit has an inert SOS screen, so shipping
this copy against an older artifact would describe a safety feature the
installed app does not have.

## Graphics (required)

| Asset                   | Spec               | Status                                                                        |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------- |
| App icon                | 512×512 PNG        | ✅ `resources/play-store-icon-512.png`                                        |
| Feature graphic         | 1024×500           | ✅ `resources/play-feature-graphic-1024x500.png`                              |
| Phone screenshots       | 2–8, min 1080×1920 | ⚠️ `resources/play-screenshots/` — 5 captured, **1 that sells**, 3 uploadable |
| 7-inch / 10-inch tablet | Optional           | ⏳                                                                            |

The icon and the feature graphic are generated from `resources/dripplex-dx-mark.png`
— the approved dX artwork — not drawn by hand. Regenerate with
`node scripts/generate-icons.mjs` and check with `node scripts/verify-icons.mjs`
from `apps/customer-mobile`. A dirty git tree after a regenerate means someone
edited a PNG directly.

Screenshots are different: they photograph live production data through the
real app (`node scripts/capture-screenshots.mjs`), so they are **not** byte
reproducible and CI does not check them. `resources/play-screenshots/README.md`
grades each one and says why.

**Regraded 2026-09-06.** This page used to say "home and marketplace are
listing quality". Home is not: its largest card reads "Ask Drip — Coming
soon" / "Our AI assistant isn't available yet", and two Quick Actions carry
SOON badges. Advertising absent functionality in a store screenshot is a Play
metadata-policy risk and, policy aside, is the worst possible first
impression. Only `02-marketplace` actively sells anything; `03-ride` and
`04-wallet` are uploadable but thin, and `05-orders` should not ship.

Upload `02-marketplace` + `03-ride` + `04-wallet` to clear the minimum of
two. The account is a testing account (founder-confirmed 2026-09-06), so the
first name visible in three frames is not customer PII — and funding that
wallet and placing orders through the app, then recapturing, is the intended
way to make the thin frames strong. Four or more at 1080px also unlocks
promotion eligibility.

The feature graphic's type no longer depends on the machine: Poppins and Inter
are vendored in `resources/fonts/` and the generator points fontconfig there, so
it renders identically everywhere. (This page previously said to install them —
that stopped being true once they were pinned.) The verifier still checks the
text actually drew, because a missing face fails silently rather than loudly.

## Content rating

Complete IARC questionnaire — expect **Everyone** / low maturity (shopping, no user-generated public content in shell).

## Data safety

**`DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` is the source of truth.** Declare
from it, not from this page, and keep it in step with
`ios/App/App/PrivacyInfo.xcprivacy` — Play requires the declaration to match what
the app actually collects.

The seven Play categories below cover the same collection the Apple manifest
describes in its eleven types. They are **not** row-for-row: Play splits
government ID and date of birth out of "Other data" and has an App activity
category Apple has no equivalent for, so match on substance, not on count.

This table used to claim ten types and omit **Audio** entirely — the app
declares `RECORD_AUDIO` for in-app voice calls, so a Data Safety form filled in
from the old table under-declared a dangerous permission:

| Play category       | Type                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| Personal info       | Name, Email address, Phone number, Address, Government ID, Other (date of birth) |
| Location            | Precise location                                                                 |
| Photos and videos   | Photos — profile, store listings, KYC documents                                  |
| Audio               | Voice or sound recordings — live in-app calls only, never recorded or stored     |
| Financial info      | Purchase history, Other (bank account for merchant payouts)                      |
| App activity        | Other actions — order and in-app activity                                        |
| Device or other IDs | Device ID (push token)                                                           |

**On Audio.** Nothing is recorded and nothing is stored. The microphone track
exists only while a call is joined, LiveKit relays it, and the backend holds who
called whom, when and for how long — never the audio. Declare it as collected,
not shared, in-app functionality. It is declared rather than treated as
transient because the honest answer survives a reviewer's second look and
"transient, therefore not collected" does not.

**Do not declare crash logs or performance data.** An earlier version of this
page said to, and it was wrong: Sentry's hook returns early unless `SENTRY_DSN`
is set, that variable is absent from the production backend, and the super-app
has no Sentry at all. The Apple manifest documents the same reasoning. If a DSN
is ever set, both declarations change together.

**No tracking.** No advertising, attribution or analytics SDK is in the
dependency tree.

**Service providers, not sharing.** Payments, SMS, email, push, object storage,
geocoding and call relay all run through processors acting on our instructions
under contract — Paystack, Flutterwave and Peyflex, Termii, Resend, Firebase,
Cloudflare R2, Google Maps and LiveKit. Play distinguishes that from sharing;
declare them as service providers. `DPX-MOBILE-003` §3 carries the full list.

Card numbers are never collected — Paystack and Flutterwave hold them, and the
schema has no `cardNumber`/`cvv`/`pan`. "Payment info" above is the merchant
bank account used for payouts.

## App signing and App Links

Play App Signing was enabled on 2026-09-06, at the first publish to an open
track. **That choice is permanent** — Google holds the app signing key and
re-signs every bundle; DrippleX holds only the upload key, which can be reset
from the Console if it is ever lost. Bringing our own key would have made a
lost key unrecoverable and the listing unupdatable.

The key is **Quantum-ready (beta)**, so it publishes four fingerprints —
classical and post-quantum, each SHA-256 and SHA-1 — and one rotated previous
key is already listed (first used 2026-09-06 02:57, 0% install base).

`assetlinks.json` therefore carries the **app signing** SHA-256, not the
upload key's. The distinction is not cosmetic: the upload certificate never
reaches a device, so an assetlinks file built from it fails verification
while every visible symptom stays normal — the intent filter still matches,
links just stop opening in the app. The committed file is Google's own
generated snippet, copied verbatim from App integrity → App signing →
Digital Asset Links JSON.

| Field        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Hosted at    | `https://app.dripplex.com/.well-known/assetlinks.json` |
| Source       | `apps/super-app/public/.well-known/assetlinks.json`    |
| package_name | `com.dripplex.app`                                     |
| SHA-256      | `BF:CA:67:…:EB:21` (app signing key, 32 octets)        |

Verified before commit by building the super-app and serving `dist` with the
same `serve -s dist --config serve.json` the container runs: the path answers
`200` with `Content-Type: application/json`. That check matters because the
SPA rewrite (`"**"` → `/index.html`) makes any missing file answer `200` with
HTML rather than `404` — a silent failure with no error anywhere.

Re-copy the snippet and re-commit whenever the app signing key rotates.

## Publishing controls — founder decisions 2026-09-06

- **Managed publishing: ON.** An approved release parks until it is published
  by hand, rather than going live unattended during the review window.
- **Countries: worldwide** (156 named plus "rest of world"). Recorded as the
  founder's call. The standing engineering note against it: everything in the
  product is Nigeria-specific — naira pricing, Paystack payouts to Nigerian
  banks, Nigerian merchants and networks, emergency number 112 — so installs
  outside Nigeria reach an app where nothing works, and early one-star
  ratings are weighted heavily and hard to recover from. Narrowing later is a
  Console change; a damaged rating average is not.

## Release

Upload AAB from `mobile-build` workflow artifact → Production / Closed / Internal track per `BETA-DISTRIBUTION.md`.
