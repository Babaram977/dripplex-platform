# DPX-MERCHANT-015 — The super-app settlement account form

Raised by the founder from a live device screenshot, 2026-09-11: _"Old fashion account system on
merchant."_

## 1. What was wrong

`BankAccountPage` in `apps/super-app/src/app/merchantScreen.tsx` asked for the settlement
destination as three free-text fields — type your bank, type an account number of 8–20 digits, type
the account holder name "exactly as at the bank".

The platform had moved on without it. `POST /merchant/bank-account`
(`apps/backend/src/merchants/merchant-bank-settlement.service.ts:54`) has required name enquiry for
some time, and the merchant portal
(`apps/merchant-portal/src/app/(dashboard)/wallet/page.tsx:1306`) already did it properly. Only the
super-app screen was left behind, and a stale comment in `apps/super-app/src/lib/api.ts` said why:
_"the backend has no NUBAN resolution service yet"_. It did.

So each field was not merely dated — it was contradicted by the server it posted to:

| The form said                        | What the backend does                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type your bank name                  | `requireBank()` matches the payment provider's list, or throws "Choose a valid Nigerian bank" — an instruction the form gave no way to follow, offering no list |
| Account number, 8–20 digits          | `/^\d{10}$/` or reject. The form accepted, and let the merchant submit, lengths the server always refused                                                       |
| Type the account holder name         | The typed name is **discarded**; `create` stores `resolved.accountName` from name enquiry. The field asked for care it then threw away                          |
| "Pending verification by Operations" | `create` sets `verifiedAt` on success. No operator is coming; that state is unreachable for anything added here                                                 |

The last row is the one that costs money. `settleOrder` begins
`if (!bank?.verifiedAt) return true;` — bank settlement **skips** any account without
`verifiedAt`. The label the screen showed is the flag that decides whether the merchant is ever
paid, and the screen described it wrongly.

## 2. What it does now

What the backend has required all along, and what the merchant portal already does: choose the bank
from the provider's own list, enter ten digits, confirm the name the bank returns. `bankCode` is
sent with it, so the settlement path never re-derives a bank from a display name at the moment it
moves money.

Nothing is saved until the bank has answered. A transposed digit is a valid-looking number belonging
to somebody else, and name enquiry is the only step that catches it.

When the bank list cannot be fetched the form says so and offers nothing. A free-text fallback would
be a form that always fails, because `create` refuses outright when no resolver is configured.

## 3. Verification

Seven tests in `apps/super-app/src/app/merchantBankAccount.test.tsx`, driving the real screen and
asserting on what is actually sent — the failure mode is invisible in the UI, since a wrong or
unverified destination looks saved and simply never pays out.

All seven guards are mutation-proven. One is worth recording: setting `canSave = true` alone left
the suite **green**, because `handleSave` independently re-checks `resolved === null`. The guard is
doubled on purpose, and the test only proves its worth when both halves are removed — which does
redden it. A mutation that reports green is not evidence the test is weak until you have checked the
mutation actually changed the behaviour.

Full super-app suite green (16 files, 181 tests), typecheck clean, production `vite build` clean.

## 4. Both open items, closed

Founder direction, 2026-09-11: _"1 - connect to negotiated approved value from ops console. 2 - why
verification should be optional, all bank inputs should be verified by the payout provider NUBAN
list authenticate account number to bring the real details which ops as the backend can pick and
approve payout."_ Both were right, and both are now done.

### 4.1 The commission rate comes from the platform

`GET /merchant/settlements/commission` returns the rate resolved **for that merchant**, and the
card renders it. The number a merchant reads is now the number they are charged.

It is resolved through the same path `settleOrder` uses, with the same identifiers — notably the
merchant **profile** id, which is what `OrderSettlement.merchantId` holds and what settlement passes
as both `userId` and `merchantId`. Passing the user id instead looks identical while no campaign is
running, which is exactly how the display would drift back out of step; a test with a campaign
targeting the merchant pins it.

There is no per-merchant negotiated _rate_ column — `negotiatedRate` exists on `Fleet` only. For a
merchant, "the Ops-approved value" is the standing rate in `MerchantCommissionSetting` (edited from
the console via `AdminMerchantCommissionSettingsController`) as overridden by a commission campaign,
which can target named merchants through `rules.eligibleMerchantIds`. That is how an individually
agreed merchant rate is expressed today, so the endpoint reports it rather than inventing a second
mechanism.

One stated limit: a campaign conditioned on **payment method** cannot be resolved without an order
to ask about. The resolver fails such a rule closed and reports the standing rate, so this can
understate a discount on some orders and never overstates what is owed. The standing rate is also
returned beside the effective one, so a merchant can see a cut is a campaign rather than their new
normal. When the rate cannot be read at all the card shows "—"; falling back to "10%" would be the
original bug with extra steps.

### 4.2 Verification is mandatory for every persona

`BankAccountsService.add` — which backs **customers, riders and drivers** — used to store the
person's own typing with `accountNameVerifiedAt: null` whenever no resolver was configured. The port
documented this as deliberate: _"an unconfigured environment degrades to the previous self-attested
behaviour rather than refusing every account."_ That reasoning does not survive contact with the
payout path. `PayoutFulfillment.destination()` returns null for any account with
`accountNameVerifiedAt === null`, so such a row was never a working destination — it was a
withdrawal that failed late, or one an operator paid by hand to a name nobody had checked.

Now: no resolver, no account. Ten digits exactly (the DTO accepted 6–20, which let a client submit
numbers name enquiry could never resolve). The stored bank, code and account name are all the bank's
answer; a typed `accountName` is accepted for older clients and discarded. Merchant and fleet were
already strict — these three were the last self-attested path.

**Deployment consequence, stated plainly:** where `PAYSTACK_SECRET_KEY` is unset, customers, riders
and drivers can no longer link a bank account — as merchants and fleets already could not. That is
the intended behaviour: an environment that cannot verify a payout destination should not be
collecting them. It does mean this change makes an unconfigured environment visibly fail where it
previously failed quietly and later.

### 4.3 What was found on the way: a mock in the customer wallet

The customer add-bank form's "Verify account" button was a **stub that shipped**. It ran a 1.2
second `setTimeout` and wrote the literal string `'DRIPPLEX USER'` into the account name, then
displayed it in a green confirmation box. No bank was ever asked. The typed bank name was posted
with `bankCode: '000'` — a placeholder standing in for a real routing code.

So a customer saw a verification that had not happened, for a destination nobody had checked. It is
now a bank picker, ten digits, and a real call to `resolveBankAccount`, with the confirmed name and
bank shown in that same box — and six tests, because a convincing green box is precisely the thing
that cannot be caught by looking.

The rider and driver panel (`payoutPanel.tsx`) was already correct and needed no change.
