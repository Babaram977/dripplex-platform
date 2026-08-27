# DPX-LEGAL-001 — DrippleX Terms of Use (DRAFT)

**Status:** 🚧 **DRAFT — NOT PUBLISHED, NOT LEGALLY REVIEWED.**
**Drafted:** 2026-08-26
**Audience:** founder review, then review by a Nigerian-qualified lawyer.
**Do not publish, deploy, or link this from the app until both reviews are complete.**

---

## How to read this document

This draft has two kinds of content, and the difference matters:

1. **System behaviour.** Sentences describing what the platform actually does are drawn from
   the code, not from assumption. Every one of them is traceable — §21 maps each factual
   claim to the file that implements it. If the founder or counsel changes one of these
   statements, **the code must change too**, or the terms become false.

2. **Commercial and legal decisions.** These are not mine to make. Every place the terms need
   a decision that only the founder can take (an entity name, a fee, a policy, a venue) is
   marked **`[NEEDS FOUNDER INPUT]`** inline and listed together in §22. Nothing has been
   invented to fill a gap.

There is a third category worth naming: **places where the terms would describe behaviour the
platform does not yet have.** Account deletion, an age gate, and a customer-facing dispute
window are all in this class. They are marked **`[GAP — NOT BUILT]`** and collected in §23. A
term that promises something the software cannot do is worse than no term at all.

> ⚠️ **This is not legal advice.** I can state accurately what the software does. I cannot
> judge whether a clause is enforceable in Nigeria, whether it complies with the Nigeria Data
> Protection Act 2023, the Federal Competition and Consumer Protection Act 2018, or NITDA
> guidance, or whether the liability limits below would survive a challenge. A qualified
> Nigerian lawyer must review this before it is published.

---

## 1. Who we are — DrippleX and Afnan Homes Ltd

DrippleX ("DrippleX", "the platform", "we", "us") is a technology platform operating in
Nigeria. It provides an app and website through which customers can order goods from
merchants, book rides, request deliveries, reserve hotel rooms, buy airtime, data and
utility tokens, and hold a DrippleX wallet.

**Resolved by the founder, 2026-08-26 and 2026-08-27.**

DrippleX is a **trading name of Afnan Homes Ltd (RC 9387949)**, unless and until a separate
DrippleX legal entity is established. Afnan Homes Ltd is therefore the counterparty to every
user contract, and every other clause here — liability, payment, dispute, governing law —
attaches to it.

**Where your money sits.** Customer payments, driver, rider and merchant earnings, and
DrippleX wallet balances are all held in **Afnan Homes Ltd's operating account**. Founder
confirmation, 2026-08-26: there is **one operating account and no segregation** — customer
funds are not held in a separate designated or client account, and wallet balances are an
entry in DrippleX's own books rather than money set aside for you elsewhere.

That is stated plainly because it is what the payment architecture actually does. There is
no split-payment arrangement and no sub-account per party anywhere in the code: a single
gateway account receives, and payouts are made manually from it.

> **`[NEEDS COUNSEL]` — the consequences of that arrangement, not the fact of it.**
> The facts above are settled and verified. What is _not_ settled is what Nigerian law
> requires DrippleX to do about them. Specifically, for counsel:
>
> 1. Does holding customer wallet balances in a single unsegregated operating account
>    engage **CBN payment-services regulation**, and if so under which licence category?
> 2. Must the terms disclose the absence of segregation, and in what words?
> 3. What must the terms say about what happens to a wallet balance if the company becomes
>    insolvent — which is the risk unsegregated balances actually create for a user?
> 4. Is any licence or registration held or required that a user must be told about here?
>
> These are questions about exposure, not about drafting. §1 is publishable only once they
> are answered.

**Registered office address is still needed** for publication — a contracting party without
an address is not fully identified.

## 2. What DrippleX is, and what it is not

DrippleX is an **intermediary**. It connects:

- **customers** with **merchants** who sell goods and services;
- **customers** with **drivers** who provide rides;
- **customers and merchants** with **riders** who carry deliveries;
- **guests** with **hotels** that let rooms;
- **customers** with **third-party providers** of airtime, data and utility payments.

Drivers, riders and merchants are **independent** — they are not employees, partners or
agents of DrippleX. They set their own working hours, accept or decline the work offered to
them, and are responsible for the service or goods they supply.

DrippleX is responsible for operating the platform itself honestly: matching fairly, pricing
as published, taking and recording payment correctly, holding wallet balances accurately, and
handling complaints. It is not the provider of the transport, the goods, the room or the
utility token.

The one exception worth stating plainly: **where a customer pays DrippleX online, DrippleX
receives that money and is responsible for passing on the merchant's, driver's or rider's
share.** That responsibility is real and should not be disclaimed away in §15.

## 3. Customer accounts

**Identity.** Your **phone number is your identity** on DrippleX. There are no usernames. You
may add an email address, and a name, but the phone number is what identifies your account
and what we use to reach you. Changing it requires verification by one-time code.

**Verification.** New accounts are verified by a one-time code sent to the phone number
given. An account that has not completed verification cannot transact.

**Account status.** An account is in one of these states: awaiting verification, active,
inactive, suspended, or blocked. Suspension and blocking are described in §12.

**Identity verification (KYC).** Some features require identity verification. A customer's
verification moves through: _not started → in progress → pending review → verified_, or is
returned as _rejected_ or _requires resubmission_ (either of which returns you to _in
progress_ so you can correct and resubmit), or lapses to _expired_ after having been
verified. Where a document has expired or a check has failed, you will be told which, and
what to resubmit.

**Your responsibility.** Give accurate information and keep it current. Keep your account
and any transaction PIN to yourself — **DrippleX staff will never ask you for your PIN or a
one-time code**. You are responsible for what happens on your account. Tell us immediately
if you believe someone else has access to it.

**Age.** `[NEEDS FOUNDER INPUT]` and `[GAP — NOT BUILT]`. The seeded draft terms currently in
the app say a user must be at least 18. **The platform does not collect a date of birth and
does not enforce any age limit anywhere in the code.** Publishing an age requirement the
software does not check is a term we would be breaching from day one. Either:
(a) the founder confirms 18 as the rule and we build the check before publishing, or
(b) the requirement is dropped from the terms, or
(c) it is stated as a rule the user warrants rather than one we verify — which counsel should
weigh against Nigerian consumer-protection expectations, and which still requires a founder
decision on what the minimum age is.

**Closing your account.** `[GAP — NOT BUILT]`. Account deletion is specified in full
(`docs/DPX-ACCOUNT-DELETION-001.md`, founder-locked 2026-08-21) but **no part of it exists in
code**. The locked policy is that a user can initiate deletion in-app; the request is
evaluated against active obligations rather than executed on sight; a positive withdrawable
wallet balance must be settled first; and legally required financial, KYC and fraud records
survive closure. Until it is built, these terms should say that closure is requested through
support, and the deletion clause should be written to match the shipped behaviour — not the
design. **Google Play and Apple both require a working deletion route**, so this is a launch
blocker independently of the terms.

## 4. Merchants and vendors

A merchant sells its own goods and services on DrippleX, on its own account.

**Onboarding.** A merchant must complete business onboarding and verification before it can
trade, supply the business and identity documents we ask for, and keep them current.

**Your obligations as a merchant.**

- Hold and maintain every licence, permit and registration your trade requires — including
  food-safety and hospitality requirements where they apply — and produce proof on request.
- List goods accurately: description, price, availability and any legal warning.
- Honour orders you accept, within your stated preparation time and operating hours.
- Comply with consumer-protection law in your dealings with customers.

**Commission.** DrippleX charges a commission on completed orders. The default rate is
**10%**, and each merchant's effective rate is held as a setting that an administrator can
change; the rate in force at the time of an order is recorded against that order, so a later
change never rewrites what you have already earned. Your current rate is shown in the
Merchant Portal.

**How you get paid, and when you owe us.** Three payment modes exist, and they differ in who
holds the cash:

| Mode                 | Who the customer pays                        | What happens                                                                                                                  |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Online**           | DrippleX (card, transfer or DrippleX wallet) | DrippleX deducts commission and settles the balance to your DrippleX wallet automatically.                                    |
| **Pay to merchant**  | You directly (bank transfer or POS)          | You keep the full amount. The commission is recorded as **owed by you** to DrippleX.                                          |
| **Cash on delivery** | Cash to the rider on delivery                | The rider confirms the cash collected; your share, the rider's earnings and DrippleX's commission are allocated and recorded. |

The money a customer pays you directly or in cash **is yours, not ours** — we do not receive
and redistribute it. What we record is the commission you owe.

**Commission credit limit.** Unsettled commission accumulates on a commission account. Every
merchant has a credit limit; the platform default is **₦50,000**, and an administrator can
set a different limit for an individual merchant. **If your outstanding commission balance
goes above your limit, you stop receiving new orders.** Orders already placed continue to
fulfilment. The block clears the moment the balance falls back to or below the limit —
whether that happens because you paid us, or because commission was deducted automatically
from a later online settlement.

**Two things about the limit that are easy to get wrong, and are true:** it is a threshold on
the _balance_, not on any single order; and the block lifts on the balance coming back under
the limit, not on any separate act of reinstatement.

**Suspension.** We may suspend a merchant store for the reasons in §12, and will say why.

## 5. Riders and drivers

**Drivers** provide rides. **Riders** carry deliveries. Both are independent providers, not
employees.

**Before you can work.**

- Complete driver or rider registration and identity verification, and pass any background
  screening we require.
- Hold a valid driving licence and every permit the law requires for the work and the
  vehicle.
- Have your vehicle inspected and approved where that applies to your vehicle class, and keep
  the approval current.
- Maintain valid insurance for the work you do.

We will ask you to renew documents before they expire. **Work stops when a required document
lapses** — that is not a penalty, it is the condition of being allowed to work at all.

**How you earn.** DrippleX charges a platform commission on completed work. The launch rate
is **10%**, configurable by an administrator, and the rate in force is recorded against each
completed job so a later change never rewrites a settled one. Earnings are credited to your
DrippleX wallet and can be withdrawn to your bank account, subject to the payout process and
your PIN.

**Cash work and what you owe.** When a passenger pays cash, or a customer pays cash on
delivery, **that money is yours (and the merchant's) — DrippleX never receives it.** What we
record is the commission you owe on it. That balance accumulates on your commission account.

**Credit limit.** Every driver and rider has a credit limit on unsettled commission. The
platform default is **₦5,000** — roughly a shift's worth of cash commission — and an
administrator can set a different limit for an individual. **If your outstanding balance goes
above your limit, you cannot go online or accept new work.** A job you have already accepted
continues. The block clears as soon as the balance is back at or below the limit.

**Refund clawbacks.** If a completed trip is later refunded (§9), your earning for it is
reversed. If your wallet does not cover the reversal, the shortfall is recorded as an amount
you owe on your commission account — which counts towards your credit limit like any other
unsettled commission. **Tips are not clawed back.** A tip stays with you.

**You choose when to work.** You are under no obligation to accept any particular job, and
declining work is not a breach of these terms. `[NEEDS FOUNDER INPUT]` — whether acceptance
rates, cancellation rates or ratings carry any consequence (deactivation, reduced offers)
must be stated here if it is real, and must not be stated if it is not.

**Safety.** Do not use the app while driving. Report any accident, incident or safety concern
immediately through the in-app SOS or to support. We may share your information with
emergency services or the authorities where there is a risk to someone's safety.

## 6. Orders, bookings, trips and cancellations

### 6.1 Marketplace orders

Placing an order is an offer to buy. The order is formed when the merchant accepts it. A
merchant may reject an order it cannot fulfil; where you have already paid, the payment is
refunded.

**Cancelling an order.** As things stand, **a customer can cancel an order only while it is
still pending payment.** Once payment is made and the merchant is preparing your order, the
cancel route is closed to you — you would need to contact support or the merchant. Any
reserved stock is released back when a pending order is cancelled.

`[NEEDS FOUNDER INPUT]` — whether a customer should be able to cancel a paid-but-not-yet-
prepared order, and on what terms. There is currently **no cancellation fee anywhere in the
platform**; if the founder wants one, it is a product change first and a terms change second.

**Automatic completion.** Once an order is marked delivered, it **completes automatically
after 24 hours** unless you dispute it in that window. Disputing the order stops the clock.
Completion is what releases settlement, so the 24-hour window is a real consumer protection
and should be stated in the terms in exactly these words.

### 6.2 Rides

A ride can be cancelled by you at any point **before the trip starts** — while it is being
requested, while a driver is being found, after a driver is assigned, and after the driver
has arrived. Once the trip is in progress, the in-app cancel option is gone; Operations can
still cancel a stranded trip on request.

**No money moves on a cancellation.** Settlement runs only when a trip completes, so
cancelling before the trip starts costs nothing and there is **no cancellation fee**. This
is the current, verified behaviour.

`[NEEDS FOUNDER INPUT]` — whether a no-show or late-cancellation fee should exist. Drivers
lose real time to a cancellation after arrival, so it is a reasonable thing to want; it does
not exist today and must not be written into the terms before it is built.

### 6.3 Hotel bookings

A hotel booking is an application, not a reservation. **No money is taken when you apply.**
The hotel has **30 minutes** to accept or decline; a booking it does not answer in that time
expires. If it accepts, you have **24 hours** to pay. If you do not pay in that window, the
booking expires, the rooms go back on sale, and **you are not charged**.

`[NEEDS FOUNDER INPUT]` — the hotel cancellation and no-show policy after a booking is paid:
whose policy governs (DrippleX's or the individual hotel's), and what a guest gets back.

### 6.4 Airtime, data and utility purchases

These are fulfilled by a third-party provider and are, in most cases, **not reversible once
delivered** — an airtime top-up cannot be un-sent. Where a purchase fails after you have been
charged, the amount is returned to your **DrippleX wallet** (see §9).

## 7. Pricing and fees

### 7.1 Ride fares

A ride fare is a **base fare + a distance rate + a time rate**, varying by ride type, with a
**minimum fare of ₦1,500 per trip** applied after the calculation. A trip that prices below
the minimum is charged the minimum; longer trips are unaffected. Some areas carry a
**surcharge**, which is shown to you before you book and itemised on your receipt. The
estimate shown before you book is an estimate; the final fare reflects the actual distance
and time.

**`[NEEDS FOUNDER INPUT]` — the fare table itself.** The per-ride-type base, per-km and
per-minute rates currently in the code are explicitly labelled in the source as _"placeholder
fare constants … not a founder-approved fare table"_, anchored to delivery's per-km pricing
rather than to ride economics. The **₦1,500 minimum is founder-decided (2026-08-16); the
rates underneath it are not.** The terms should not quote unapproved numbers, and the
platform should not charge them. This needs sign-off before launch regardless of what the
terms say.

### 7.2 Delivery fees

A delivery fee is calculated from the distance, at a per-kilometre rate, with a **minimum of
₦500**. The fee is shown before you confirm.

### 7.3 Marketplace prices

Item prices are set by the merchant, not by DrippleX. The delivery fee, any tax and the order
total are shown before you confirm the order.

### 7.4 Customer-facing service fee

`[NEEDS FOUNDER INPUT]`. **There is currently no customer-facing service or booking fee in
the platform** — the platform's revenue is the commission charged to merchants, drivers and
riders (§4, §5), which is taken out of their side of the transaction and is not an extra
charge on the customer. If the founder intends to introduce a customer service fee, it must
be built, shown before confirmation, and itemised on the receipt before it appears in these
terms.

### 7.5 Changes to prices and rates

Fares, delivery rates and commission rates can change. A change applies to transactions from
the time it takes effect; **the rate in force when a transaction settles is recorded against
that transaction and is never rewritten by a later change.**

## 8. Payments

**How you can pay.** DrippleX wallet, card, bank transfer, or cash where cash is offered for
that service. Payment is due on completion of the service unless the service requires payment
up front.

**The DrippleX wallet.** Your wallet holds a balance you can spend on the platform and, for
drivers, riders and merchants, receives your earnings. Every movement is recorded as a ledger
entry. `[NEEDS FOUNDER INPUT]` — whether wallet balances are held in a designated account,
whether they earn interest (they should be stated not to), and what happens to a dormant
balance. Counsel should confirm whether the wallet as operated engages CBN payment-services
regulation.

**Withdrawals.** Earnings can be withdrawn to a bank account you have registered and
verified. Withdrawals require your PIN, and the amount must be **at least ₦100 and no more
than ₦1,000,000** per request (`WALLET_WITHDRAWAL_MIN_AMOUNT` / `WALLET_WITHDRAWAL_MAX_AMOUNT`,
`apps/backend/src/wallet/wallet.constants.ts`).

> **Corrected 2026-08-26.** This paragraph previously said the minimum, the fee and the
> timetable _"[do] not exist as fixed values in the code today"_. The minimum and maximum
> above **do** exist and are enforced on every request, and hotel settlements run on a fixed
> weekly cadence — **every Monday**, settling the seven days before (founder decision
> 2026-08-22, `apps/backend/src/bookings/settlement-week.ts`). Stating the opposite in a
> document whose whole purpose is to describe the software accurately was the sharpest kind
> of error this draft can contain, and it is the reason §21 traces every claim to a file.

Still `[NEEDS FOUNDER INPUT]`: whether a **withdrawal fee** should be charged (none is
charged today), and what payout timeframe to state for driver, rider and merchant earnings.
The Monday cadence above governs _hotel settlements_; it is not a general payout promise, and
the terms must not turn it into one.

**Card details.** Card payments are handled by a licensed payment provider. **DrippleX does
not store your full card details.**

**Failed and unpaid amounts.** Where a payment fails or an amount is left unpaid, we may
recover it from your DrippleX wallet, and may prevent further bookings until it is settled.
For merchants, drivers and riders, an unsettled commission balance is handled through the
credit limit in §4 and §5.

**Cash.** Where you pay cash, the cash goes to the driver, rider or merchant. DrippleX does
not receive it. What DrippleX records is the commission owed on that transaction by the
person who received it.

## 9. Refunds

**Marketplace orders.** Where an order is not delivered, is materially wrong, or is cancelled
before fulfilment, raise it in the app within the 24-hour window (§6.1). We investigate and
refund where the complaint is upheld.

**Rides.** Ride refunds are **initiated by DrippleX Operations, not self-service** — there is
no customer-facing refund button, by design. Only a trip that has been paid can be refunded,
and **only in full**; partial ride refunds do not exist. When a ride is refunded, the
driver's earning for it is reversed (§5) and the platform's commission is reversed.

**Where a refund goes.** This one needs to be stated bluntly, because it is the term users
are most likely to be surprised by:

- Paid by DrippleX wallet → refunded to your **DrippleX wallet**.
- Paid by **card or bank transfer through the payment gateway** → refunded to your **DrippleX
  wallet, not back to your card**. DrippleX does not currently reverse payments at the
  gateway; the refund reaches you as wallet credit you can spend or withdraw.
- Paid in **cash** → there is no digital refund, because DrippleX never received the money.
  A cash dispute is resolved between you, the driver or merchant, and DrippleX support.
- A **failed utility or airtime purchase** → returned to your **DrippleX wallet**.

`[NEEDS FOUNDER INPUT]` — counsel must confirm that refunding a card payment to a wallet
balance rather than to the card is permissible under Nigerian consumer-protection law, and
whether a customer must be offered the choice of a bank payout instead. This is the single
highest-risk clause in the document. It is an accurate description of what the software does;
whether it is lawful is not something I can determine.

**Tips.** A tip is never reversed by a refund. It stays with the driver.

## 10. Delivery responsibility

**Who does what.**

- The **merchant** is responsible for what is in the package: the goods, their quality, their
  quantity, their packaging, and their safety and legality.
- The **rider** is responsible for carrying the package from the merchant to the delivery
  address, and for handing it over.
- **You** are responsible for the accuracy of the delivery address, and for being reachable
  and available to receive the delivery.
- **DrippleX** is responsible for assigning the delivery, tracking it, and recording the
  payment correctly.

**Cash on delivery.** Where you pay cash, you pay the rider the amount shown. The rider
confirms the amount collected in the app. Do not pay a different amount, and do not pay
anyone other than the rider assigned to your order.

**Failed delivery.** `[NEEDS FOUNDER INPUT]` — what happens when a delivery cannot be
completed because the customer is unreachable or the address is wrong: whether the goods
return to the merchant, who bears the delivery fee, and whether the order is refunded. This
is a commercial policy decision, and there is no default in the code to describe.

**Prohibited items.** Do not send anything illegal, dangerous, perishable in a way that
requires handling we do not offer, or otherwise restricted, through DrippleX delivery. A
rider may refuse a package, and we may cancel a delivery, where this rule is broken. See §11.

## 11. Prohibited activities

You must not:

- Use DrippleX for anything unlawful, or to carry, sell or deliver anything illegal.
- Impersonate anyone, or create an account using someone else's identity or documents.
- Defraud the platform, a merchant, a driver, a rider or another customer — including
  manufacturing orders or trips to extract promotions, referral rewards or commission
  advantages.
- Manipulate referral or promotional schemes, including creating accounts for the purpose of
  claiming referral rewards.
- Interfere with how the platform works: probing, scanning or testing its security,
  attempting unauthorised access to any system or account, circumventing rate limits or
  authentication, or scraping the platform.
- Reverse-engineer, decompile or copy the app, or build a competing service from data taken
  from it.
- Use automated means to place orders, accept jobs, or interact with the platform.
- Post false reviews, or reviews for a transaction that did not happen.
- Carry a passenger or a package in a way that breaches the law or your insurance.
- Harass, threaten, discriminate against or abuse anyone you encounter through DrippleX —
  including on grounds of ethnicity, religion, gender, disability or origin.

## 12. Suspension and termination

**We may suspend or close an account** where we reasonably believe one of the following is
true:

- The information given is false, or the identity behind it cannot be verified.
- A required licence, permit, insurance or vehicle approval has lapsed or been withdrawn.
- These terms have been broken, in particular §11.
- There is fraud, or a credible fraud signal.
- There is a safety risk to a customer, driver, rider, merchant or member of the public.
- The law or a regulator requires it.

**A commission credit-limit block is not a suspension.** It stops new work until the balance
clears (§4, §5) and lifts automatically. It is not a decision against you and does not need
an appeal.

**We will tell you why**, unless telling you would compromise a fraud or safety
investigation, or the law prevents it.

`[NEEDS FOUNDER INPUT]` — the **appeal route**. A driver, rider or merchant whose livelihood
stops needs a way to contest a suspension, and a timeframe in which they will get an answer.
Counsel should also advise whether Nigerian law requires notice before termination for gig
providers.

**Money on suspension.** `[NEEDS FOUNDER INPUT]` — whether a suspended account can still
withdraw a positive wallet balance, and what happens to earnings accrued before suspension.
The safe and probably correct answer is that **money already earned remains payable**, with
withdrawal held only where it is the subject of a live fraud investigation — but that is a
founder decision, not mine.

**You may stop using DrippleX at any time.** Closing your account is dealt with in §3, with
the gap noted there.

## 13. Intellectual property

The DrippleX name, logo, app, website, designs and software are owned by DrippleX
`[NEEDS FOUNDER INPUT — the owning entity, per §1]` and are protected by intellectual
property law. You may use them only as needed to use the service.

You may not copy, modify, distribute, sell or licence any part of the platform, or use the
DrippleX brand without written permission.

**Content you provide.** Merchants own the product content and images they upload; customers
own the reviews and photographs they post. By providing content you grant DrippleX a
non-exclusive, royalty-free licence to host, display and use it for the purpose of operating
and promoting the platform. You are responsible for having the rights to whatever you upload.

`[NEEDS FOUNDER INPUT]` — whether the promotional use of merchant content (marketing
campaigns, social media) should be called out separately, and whether the licence should
survive a merchant leaving the platform.

## 14. Availability of the platform

We work to keep DrippleX available, but we do not promise that it will be available without
interruption. The service can be unavailable because of maintenance, a fault, a failure at a
third party we depend on (payment providers, mapping, messaging, utility providers), a
network outage, or something outside our control.

We may change, suspend or withdraw features. Where a change is material and affects money or
access, we will give notice in the app.

`[NEEDS FOUNDER INPUT]` — whether DrippleX offers any availability commitment to merchants
(a commercial SLA). Today there is none, and the terms should not imply one.

## 15. Limitation of liability

Counsel must draft this clause. What follows sets out the **factual position** it needs to
reflect, and the boundaries the founder should not cross.

**What DrippleX should accept responsibility for**, because it is genuinely ours:

- Failures of the platform itself — mispricing against the published rates, taking payment
  incorrectly, losing or misrecording a wallet balance or a ledger entry, failing to pass on
  money we received on someone's behalf.
- The security of the data we hold, to the standard in §18.

**What DrippleX is not the provider of**, and should not carry primary liability for:

- The driving, conduct or acts of an independent driver or rider.
- The goods a merchant sells, their quality, safety or legality.
- The room a hotel provides.
- The delivery of a third-party utility or airtime product by that provider.

**What cannot be excluded, in any draft.** Nothing in these terms should purport to exclude
or limit liability for death or personal injury caused by negligence, for fraud or fraudulent
misrepresentation, or for anything else that cannot lawfully be limited under Nigerian law.
A clause that tries to will likely be struck down and may taint the rest.

`[NEEDS FOUNDER INPUT]` — whether the founder wants a **monetary cap** on DrippleX's
liability and at what level (a common shape is the greater of the value of the transaction
complained of, or a fixed sum). Counsel must advise on enforceability against consumers under
the FCCPA 2018 — a cap that is enforceable against a merchant may not be enforceable against
a consumer.

`[NEEDS FOUNDER INPUT]` — whether DrippleX carries, or requires drivers and riders to carry,
insurance covering passengers and goods, and what a user should be told about it. **This
materially changes what §15 can fairly say**: a platform that has arranged cover can limit its
own liability far more comfortably than one that has not.

## 16. Complaints and disputes

**Raise it with us first.** Most problems are resolved by support. Contact details are in
§19.

**Orders.** You can dispute a delivered order in the app within **24 hours** of delivery.
Disputing stops the order completing automatically and brings it to Operations.

**Rides and everything else.** `[GAP — NOT BUILT]` — there is **no customer-facing dispute
mechanism for rides, hotel bookings or utility purchases**. Those complaints go to support,
and Operations acts on them (including issuing a ride refund, §9). The terms should describe
that route honestly rather than implying an in-app process that does not exist.

`[NEEDS FOUNDER INPUT]` — the **response commitment**: how long DrippleX takes to acknowledge
a complaint and how long to resolve it. Any figure stated here becomes a promise, so it should
be one Operations can actually meet.

`[NEEDS FOUNDER INPUT]` — whether disputes go to **arbitration** or to the courts, and
whether the founder wants to name a specific arbitral forum. Counsel should advise, including
on whether an arbitration clause is enforceable against consumers here.

**Regulators.** Counsel should confirm whether the terms must inform consumers of their right
to complain to the FCCPC, and whether a similar signpost is needed for payment complaints.

## 17. Governing law

`[NEEDS FOUNDER INPUT]`. These terms should be governed by the laws of the **Federal Republic
of Nigeria** — that much follows from where the business operates — but the founder must
choose the **venue**: which state's courts have jurisdiction (Kano, given the pilot? Lagos?
Abuja?). Counsel should confirm the choice is enforceable and sensible for a business
operating across states.

## 18. Privacy and your data

How DrippleX collects, uses and shares personal information is set out in the **DrippleX
Privacy Policy**, which forms part of your agreement with us. In summary, and consistently
with what the platform actually does:

- Your **phone number is your identity**; there are no usernames.
- **Location** is collected while you are using a service that needs it — booking or taking a
  trip, or making or delivering an order — and while a driver or rider is online. You can turn
  location off in your device settings, but rides, orders and deliveries will not work
  without it.
- **Drivers and riders do not see a customer's phone number.** They see a first name, the
  pickup and drop-off points, and the job details.
- **Payment providers** process card and transfer payments; DrippleX does not store full card
  details.
- **We do not sell personal information.**
- Financial, transaction, KYC and fraud-prevention records are retained where the law
  requires, including after an account closes.

`[NEEDS FOUNDER INPUT]` and `[GAP]` — the Privacy Policy is itself a **draft pending legal
review** (seeded into the CMS on 2026-08-18 with that warning attached). It must be checked
against the **Nigeria Data Protection Act 2023**, and a **Data Protection Officer / contact
address** must be named. The two documents should be reviewed together, since §18 here and the
policy must not contradict each other.

## 19. Contact

`[NEEDS FOUNDER INPUT]` — confirm which of these are live and monitored before publication.
The addresses below appear in the product today:

- **Support:** support@dripplex.com, and WhatsApp on **+234 906 161 6116** (the number seeded
  into the in-app privacy and terms pages — confirm it is correct and monitored).
- **Legal:** legal@dripplex.com
- **Privacy:** privacy@dripplex.com

`[NEEDS FOUNDER INPUT]` — a **registered postal address** for the contracting entity. Terms
of use for a Nigerian company should carry a physical address for service, not only email.

## 20. Changes to these terms, and when they take effect

We may change these terms. Where a change is material — particularly one affecting money,
liability or your data — we will notify you in the app before it takes effect. Continuing to
use DrippleX after a change takes effect means you accept it.

**Effective date:** `[NEEDS FOUNDER INPUT — set on publication, after legal review]`
**Last updated:** `[NEEDS FOUNDER INPUT — set on publication]`

Both dates must appear at the top of the published page. The in-app terms are served from the
content system and can be revised by Operations without a deploy — **which means the version
and date must be updated in the same edit**, or users will be shown a stale date against new
text.

---

## 21. Where each factual claim comes from

Every statement of system behaviour above is traceable to code. Counsel and the founder should
treat this table as the audit trail: if a term is changed, the corresponding code must change,
and vice versa.

| Claim in the terms                                                                                                 | Source                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone is identity; no usernames                                                                                    | `CLAUDE.md` founder decisions; `apps/backend/src/auth/dto/*`                                                                                          |
| Account statuses (pending verification / active / inactive / suspended / blocked)                                  | `docs/DPX-ACCOUNT-DELETION-001.md` §3; Prisma `UserStatus`                                                                                            |
| Customer KYC lifecycle                                                                                             | `apps/backend/prisma/schema.prisma` — `enum CustomerKycStatus`                                                                                        |
| Platform commission 10%, Ops-configurable, snapshotted per transaction                                             | `apps/backend/src/commercial/commercial.constants.ts:52`; `platform-commission-settings.service.ts`; `apps/backend/src/rides/ride.constants.ts:56-62` |
| Merchant commission 10% default, per-merchant setting                                                              | `apps/backend/src/orders/order.constants.ts:41`; `merchant-commission-settings.service.ts`                                                            |
| Merchant credit limit ₦50,000; driver/rider ₦5,000                                                                 | `apps/backend/src/commercial/commercial.constants.ts:72-73` (founder decisions 2026-08-17, 2026-08-25)                                                |
| Credit limit blocks new orders / going online; clears on balance falling back under the limit                      | `docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §0.2, §1.3                                                                              |
| Three merchant payment modes; cash belongs to merchant/driver, not DrippleX                                        | Same doc, §1.1, §1.2                                                                                                                                  |
| Ride minimum fare ₦1,500                                                                                           | `apps/backend/src/rides/ride.constants.ts:271` (founder decision 2026-08-16)                                                                          |
| Ride fare rates are placeholders, not founder-approved                                                             | `apps/backend/src/rides/ride.constants.ts:255-268` — source comment says so explicitly                                                                |
| Delivery fee: minimum ₦500, ₦150/km                                                                                | `apps/backend/src/delivery/delivery.constants.ts:78-79`; `delivery-fee.service.ts:37`                                                                 |
| Order auto-completes 24h after delivery unless disputed                                                            | `apps/backend/src/orders/order.constants.ts:60`; `order-completion-sweep.service.ts`                                                                  |
| Customer can cancel only a PENDING (unpaid) order                                                                  | `apps/backend/src/orders/checkout.service.ts:320-333`                                                                                                 |
| Ride cancellable before trip start; Operations may also cancel in-progress                                         | `apps/backend/src/rides/ride.constants.ts:192-218`                                                                                                    |
| No money moves on ride cancellation                                                                                | `apps/backend/src/rides/rides.service.ts:563`                                                                                                         |
| No cancellation fee exists anywhere                                                                                | Verified absent — no `cancellationFee` constant or field in `apps/backend/src`                                                                        |
| Ride refunds: admin-initiated, PAID only, full only                                                                | `docs/DPX-D4-RIDE-REFUND-POLICY.md` locked decisions 1-2                                                                                              |
| Gateway-paid refunds go to the DrippleX wallet, not the card                                                       | Same doc, decision 3; `apps/backend/src/utilities/utilities.service.ts:552-564` for the utility case                                                  |
| Driver earning clawed back; shortfall becomes a recorded liability that counts to the credit limit                 | Same doc, decision 4 and final ruling 1                                                                                                               |
| Cash rides: no digital customer refund                                                                             | Same doc, decision 6                                                                                                                                  |
| Tips never reversed                                                                                                | Same doc, final ruling 3                                                                                                                              |
| Hotel booking: no money at application; 30-min accept window; 24-hour pay window; expiry releases rooms, no charge | `apps/backend/src/bookings/bookings.constants.ts:34,50`; `bookings.service.ts` (founder decision 2026-08-22)                                          |
| Drivers/riders don't see customer phone numbers; location use; no sale of data                                     | Seeded privacy policy, `apps/backend/prisma/migrations/20260818060000_legal_pages_seed/migration.sql`                                                 |
| Loyalty points expire after 365 days                                                                               | `apps/backend/src/loyalty/loyalty.constants.ts:26`                                                                                                    |
| Account deletion designed but not built                                                                            | `docs/DPX-ACCOUNT-DELETION-001.md` — "Nothing in this document exists in code today"                                                                  |

## 22. Founder decisions required before this can go to counsel

Grouped by how much they block. **A blocked item stops the document; a shaping item changes
what a clause says but not whether it can be drafted.**

### Resolved (2026-08-26 / 2026-08-27)

| #   | Item                        | Decision                                                                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **§1** contracting entity   | ✅ DrippleX is a trading name of **Afnan Homes Ltd, RC 9387949**. Funds sit in its **single unsegregated operating account**. Drafted in §1. The _consequences_ remain `[NEEDS COUNSEL]`; the facts do not.                                                                                                                                                        |
| 5   | **§7.1** fare table         | ✅ Rates approved (Dx Ride ₦350/₦110/₦15/₦1,500 · Comfort ₦450/₦135/₦18/₦1,500 · XL ₦600/₦165/₦22/₦1,700 · Tricycle ₦150/₦75/₦8/₦500). **Not yet applied to production** — blocked only on capturing the four live cards from the Operations Console first, so an operator edit made since the 2026-08-18 seed is not silently overwritten. See `DPX-PRICING-001`. |
| 11  | **§8** withdrawal limits    | ✅ Settled and now stated: **₦100 minimum, ₦1,000,000 maximum**, enforced in code.                                                                                                                                                                                                                                                                                 |
| —   | **§23** implementation gaps | ✅ All four to be built rather than written around — see §23.                                                                                                                                                                                                                                                                                                      |

**Still blocking — the terms cannot be finalised without these**

1. **§1** — the **registered office address**. Everything else in §1 is resolved; a contracting
   party without an address is not fully identified.
2. **§17** — governing law and venue (which state's courts).
3. **§19** — registered postal address; confirmation that the support email addresses and the
   WhatsApp number are live and monitored.
4. **§20** — effective date and last-updated date (set at publication).
5. **§8** — whether a **withdrawal fee** should be charged (none is today), and what payout
   timeframe to state for driver, rider and merchant earnings. The Monday cadence in code
   governs _hotel settlements_ and must not be published as a general payout promise.

**Shaping — a clause depends on the answer**

6. **§3** — minimum age, and whether we build the check (see §23).
7. **§5** — whether acceptance rate, cancellation rate or rating carries any consequence for a
   driver or rider.
8. **§6.1** — whether a customer may cancel a paid order, and whether any cancellation fee
   should exist (marketplace or ride).
9. **§6.3** — hotel cancellation and no-show policy after payment; whose policy governs.
10. **§7.4** — whether a customer-facing service fee will exist.
11. **§8** — withdrawal fee (none today) and the payout timetable for earnings. The
    withdrawal **minimum and maximum are settled**: ₦100 and ₦1,000,000, enforced in code.
    Also: how wallet balances are
    held; dormant-balance treatment.
12. **§10** — failed-delivery policy: who bears the fee, what happens to the goods, refund or
    not.
13. **§12** — suspension appeal route and timeframe; whether a suspended account can withdraw
    earned money.
14. **§13** — scope of the content licence, and whether it survives a merchant leaving.
15. **§14** — whether any availability commitment is offered to merchants.
16. **§15** — whether a liability cap is wanted and at what level; what insurance exists for
    passengers and goods.
17. **§16** — complaint response commitment; arbitration versus courts.

**For counsel specifically**

18. **§9** — is refunding a card payment to a wallet balance lawful under Nigerian consumer
    law, and must a bank payout be offered as an alternative? _(highest-risk clause in the
    document)_
19. **§15** — enforceability of any cap against consumers under the FCCPA 2018.
20. **§16** — whether the terms must signpost the FCCPC, and any payment-complaints
    equivalent.
21. **§18** — the Privacy Policy against the NDPA 2023; naming a Data Protection Officer.
22. **§8** — whether the DrippleX wallet as operated engages CBN payment-services regulation.
23. **§12** — whether notice is required before terminating a gig provider.

## 23. Gaps between these terms and the software

Each of these is a place where the natural wording of a term would describe something the
platform cannot currently do. **Each must be either built or written around before
publication** — writing it in and hoping is how a platform breaches its own terms on day one.

> **Founder decision, 2026-08-27: all four implementation gaps are to be BUILT, not written
> around.** Account deletion, the age mechanism, customer dispute routes for rides/hotels/
> utilities, and the checkout Terms link. Each ships as its own PR; the table below tracks
> them. Once they land, the corresponding clauses can be written as promises rather than
> hedges — which is the whole point of resolving them before publication rather than after.
>
> **Account deletion carries an external deadline the others do not.** Google Play requires
> an in-app deletion path _and_ a public web deletion URL for any app with accounts. It is a
> store-listing requirement, so it can block or pull a submission — including the API 36
> submission due before **2026-08-31**. A design already exists at
> `docs/DPX-ACCOUNT-DELETION-001.md`, whose own summary is that _"nothing in this document
> exists in code today."_

| Gap                                                                        | Consequence if published as-is                                                                                                                                  | Also blocks                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Account deletion not built** — 🔨 building                               | A deletion clause would be unfulfillable; a user cannot exercise the right the terms give them                                                                  | Google Play and Apple store submission |
| **No age verification** — 🔨 building                                      | An "18+" term is breached the moment anyone under 18 signs up, and we would have no way to know                                                                 | —                                      |
| **No customer dispute route for rides, hotels or utilities** — 🔨 building | A term describing an in-app dispute process would be inaccurate for three of five service lines                                                                 | —                                      |
| ~~**Ride fare rates unapproved**~~ — ✅ approved 2026-08-26                | Rates are decided; applying them to production is blocked only on capturing the four live Operations Console cards first (`DPX-PRICING-001`)                    | Launch pricing                         |
| **No cancellation fee mechanism**                                          | Any cancellation-fee term would be unenforceable in practice — nothing charges it                                                                               | —                                      |
| **Privacy Policy itself unreviewed**                                       | §18 incorporates a document that carries its own "not reviewed by a lawyer" warning                                                                             | NDPA compliance                        |
| **Withdrawal fee / earnings payout timetable undecided**                   | A stated payout timeframe would be a promise nothing enforces. The withdrawal minimum (₦100) and maximum (₦1,000,000) ARE enforced in code and are stated in §8 | `wallet.constants.ts`                  |
| **Checkout's "Terms of Service" text is not a link** (§24.4) — 🔨 building | Agreement is collected at every checkout to a document the customer cannot open from that screen                                                                | —                                      |

## 24. What happens to the published pages

Nothing in this draft has been published. Three surfaces will need updating **after** legal
review, and they should be updated together so they cannot drift:

1. **`apps/customer-web/src/app/(public)/terms/page.tsx`** — currently a three-bullet
   placeholder ending _"Final contractual terms will accompany production launch."_
2. **The CMS `terms-of-service` page** — seeded 2026-08-18, served to the driver and rider
   settings screens, and editable by Operations without a deploy. Because it is
   Ops-editable, whatever counsel approves must be entered here, and the version and date
   bumped in the same edit.
3. **The CMS `privacy-policy` page** — reviewed alongside, per §18.

And one more, which turned up while checking the above and is a defect in its own right:

4. **`packages/ui/src/components/super-app/CheckoutTermsCheckbox.tsx`** — the checkout screen
   asks the customer to tick _"I have reviewed my order and agree to the merchant terms and
   DrippleX Terms of Service."_ **"DrippleX Terms of Service" is styled to look like a link
   but is not one** — it is a `<span>` inside the button that toggles the checkbox, with no
   href and no handler. Tapping it ticks the box instead of opening the terms.

   So today **every checkout collects agreement to a document the customer has no way to
   open from that screen**, and the document it would open is the three-bullet placeholder.
   Whether an agreement collected that way binds anyone is a question for counsel; either
   way the link should work before the real terms are published. This is a small, isolated
   UI fix and is not part of this document — it needs its own change.
