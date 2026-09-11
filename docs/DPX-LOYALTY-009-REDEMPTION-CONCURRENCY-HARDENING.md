# DPX-LOYALTY-009 — make the points deduction an explicit invariant

**Status: open follow-up. Not a defect today — a dependency on behaviour nothing declares.**

Raised in the pre-merge review of PR #356 (2026-09-11) and accepted by architecture review the same
day: _"Make DX Points redemption's atomic balance deduction an explicit invariant rather than
depending on the locking behavior of `upsert`."_ Explicitly **not** a blocker for that merge, given
the empirical result below.

## What the code does

`LoyaltyService.redeemPoints` (`apps/backend/src/loyalty/loyalty.service.ts:424`) runs, inside a
default `READ COMMITTED` transaction:

1. `tx.loyaltyAccount.upsert({ where: { userId }, update: { deletedAt: null }, create: { userId } })`
2. `if (existing.pointsBalance < points) throw new ValidationDomainException(...)`
3. `tx.loyaltyAccount.update({ data: { pointsBalance: { decrement: points } } })`

That is the shape of a check-then-act race, on a balance that converts to **real wallet money**. A
lost update here does not lose points — it mints cash.

## Why it is nonetheless safe today

Tested rather than reasoned about, against a real Postgres 16, two concurrent sessions redeeming the
whole balance:

- Prisma's `upsert` compiles to `INSERT … ON CONFLICT DO UPDATE … RETURNING`.
- The `DO UPDATE` takes a **row-level exclusive lock**, so the second transaction blocks.
- Under `READ COMMITTED`, the blocked statement re-reads the row after the first commits, and
  `RETURNING` yields the **post-decrement** value.

Observed directly: the second session's upsert returned `0`, not the original balance. Step 2 then
refuses it with "Insufficient loyalty points". The invariant holds.

(An earlier probe of the same race appeared to show a balance of −100. That probe was wrong: it
omitted step 2, the check the service actually performs. Recorded because the false positive is more
instructive than the finding — a probe has to model the code, not a summary of it.)

## Why it should still change

Nothing in the code says any of that. The correctness of a money path rests on three implementation
details, none of them stated and none of them tested:

- that `upsert` performs a write rather than a read,
- that the write takes a row lock,
- that `RETURNING` re-reads under this isolation level.

Any of these can go without a test failing, because the race needs concurrency to appear and no test
exercises it:

- refactoring to `findFirst`-then-`create` removes the lock entirely;
- an `update: {}` that Prisma optimises to a no-op removes it;
- moving the read before the upsert removes it;
- switching the redemption to `findUnique` for a "cheaper" read removes it.

Each of those is an ordinary, reasonable-looking change.

## The change

Put the guard in the statement that moves the balance, so the invariant is enforced where it is
relied upon:

```ts
const debited = await tx.loyaltyAccount.updateMany({
  where: { id: existing.id, pointsBalance: { gte: points } },
  data: { pointsBalance: { decrement: points } },
});
if (debited.count === 0) {
  throw new ValidationDomainException('Insufficient loyalty points');
}
```

The `WHERE` and the decrement are then one atomic statement, correct under any isolation level and
independent of what `upsert` does.

## Acceptance

- The guarded `updateMany` replaces the read-check-decrement sequence.
- A concurrency test: two simultaneous redemptions of a balance that only covers one, asserting
  exactly one succeeds and the balance never goes below zero.
- Mutation check: removing the `pointsBalance: { gte: points }` clause must redden that test.

## Scope note

`redeemPoints` is the path examined. Any other site that reads a points balance and then writes a
derived value wants the same treatment; that survey is part of this item, not assumed done.
