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

## 4. Open — needs a founder decision

**The Payout Information card hardcodes "Commission 10% (set by Operations)" and "Net to merchant
90% of order value"** (`merchantScreen.tsx`). Commission is resolved per merchant —
`CommissionRateResolverService` takes a `merchantId`, and campaign rates apply — so any merchant on
a negotiated or campaign rate is being shown a number that is not theirs.

Left as-is rather than guessed at. It needs a decision on whether merchants should see their actual
effective rate, and there is no read endpoint exposing it to a merchant today; building one is the
dependency, not something to invent here.

**The customer add-bank form has the same shape** (`apps/super-app/src/app/walletScreen.tsx:1880`):
free-text bank name, and `bankCode: addForm.bankCode || '000'` — a placeholder code standing in for
a real one. The customer backend is more lenient than the merchant one (verification is optional
there), so this is not the same live payout risk, but it is the same pattern and wants the same
treatment. Not in scope for this change.
