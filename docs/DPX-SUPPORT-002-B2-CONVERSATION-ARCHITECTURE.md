# DPX-SUPPORT-002 B2 — support conversations and handoff

**Architecture, amended after review. No implementation. No schema, no code, no
migration.** Branch reset from merged B1 at `043f2847`.

Amendments from the review of `ba35d214` are folded in throughout: the ticket
owns handling state, reopening reuses the conversation, returning to the AI needs
its own permission, and retention is designed for rather than decided.

---

# 1. Shape

```
SupportTicket          ← authority: safety, handling state, lifecycle
   │
   └── SupportConversation   (exactly one, for the life of the ticket)
          │
          └── SupportMessage[]   ← immutable history
```

**Ticket is authority. Conversation is history. Message is communication. The
future Drip AI is a controlled participant, never an authority.**

That separation is the point of the amendment. The earlier draft put handling
state on the conversation, which made the conversation responsible for an
authorization property that belongs to the ticket — and, as review noted, put
the safety invariant out of reach of a normal PostgreSQL `CHECK`, because a check
constraint cannot look into another table.

## Reopening reuses the conversation

A ticket may be reopened. It does **not** get a second conversation.

```
OPEN → AI_HANDLING → HUMAN_HANDLING → RESOLVED
                                         │
                                      REOPENED
                                         │
                          HUMAN_HANDLING / AI_HANDLING → RESOLVED
```

One ticket, one conversation, one chronological transcript for its whole life.
`Ticket → Conversation 1, 2, 3` would have added a join and a "which one is
live" question for no gain: the transcript is already ordered and already
immutable, so reopening has nothing to protect itself from.

This is a 1:1 relation and is enforced as one — unique on `ticketId`.

---

# 2. The invariant, and where it now lives

> **`requiresHumanHandling = true` ⇒ `handlingState` can never be
> `AI_HANDLING`.**

With handling state on the ticket, both columns are on the same row, so
PostgreSQL can enforce this directly:

```
CHECK (NOT ("requires_human_handling" AND "handling_state" = 'AI_HANDLING'))
```

Row-local, no trigger, no denormalised copy, no second source of truth. This was
the review's preferred option and it is right: the database stays the final
safety boundary, and the service-layer re-read becomes defence in depth rather
than the only defence.

## It holds against everything

`AI_HANDLING` is refused on such a ticket even when:

- a human previously handled it;
- the human handling it wants the AI to continue;
- the user asks for it;
- a provider claims it can handle it;
- a future admin UI attempts it;
- an internal service attempts it.

The only route to AI handling is the authoritative B1 gate saying the ticket is
eligible in the first place.

## B2 never clears `requiresHumanHandling`

That flag belongs to the deterministic gate layer. Conversation management may
read it and must never write it. No B2 service method, route, admin action or
migration touches the column — and a test asserts that the only writer remains
B1's create path.

---

# 3. Handling state

On the ticket: `OPEN` · `AI_HANDLING` · `HUMAN_HANDLING` · `RESOLVED` ·
`REOPENED` · `CLOSED`.

| From                             | To               | Who                                                            |
| -------------------------------- | ---------------- | -------------------------------------------------------------- |
| `OPEN`                           | `AI_HANDLING`    | server, **only** if the B1 gate says eligible                  |
| `OPEN`                           | `HUMAN_HANDLING` | operator claiming                                              |
| `AI_HANDLING`                    | `HUMAN_HANDLING` | server (escalation) or operator claiming                       |
| `AI_HANDLING` / `HUMAN_HANDLING` | `RESOLVED`       | operator; server only for AI-eligible                          |
| `RESOLVED`                       | `REOPENED`       | user or operator                                               |
| `REOPENED`                       | `HUMAN_HANDLING` | operator claiming                                              |
| `REOPENED`                       | `AI_HANDLING`    | server, **only** if still eligible — re-read, never remembered |
| `HUMAN_HANDLING`                 | `AI_HANDLING`    | operator, with the dedicated permission (§4)                   |
| `RESOLVED`                       | `CLOSED`         | operator or sweep                                              |

Everything else is refused. Transitions are recorded as `SYSTEM` messages and as
audit entries.

Note the re-read on `REOPENED → AI_HANDLING`: eligibility is a fact about the
ticket now, not a fact remembered from when it was first filed.

---

# 4. Returning a conversation from a human to the AI

A dedicated capability, separate from answering tickets. Conceptually:

```
support:tickets:use            file and read your own
admin:support:tickets:manage   answer anyone's
support:tickets:ai-handoff     hand a live conversation to automation
```

`ai-handoff`, not `ai-return`: the permission names the capability, not one
direction through the lifecycle. It authorises `HUMAN_HANDLING → AI_HANDLING`
and stays distinct from using or managing tickets. Handing a live conversation back to a machine is a different kind of
act from replying to it, and should not ride along with the grant every
Operations responder already holds.

**Granted to nobody by default**, including ordinary support responders. It is
assigned explicitly to the appropriate Operations role once the operational
policy exists — not as part of this work. A seeded-but-ungranted permission is
the correct end state for B2, and a test asserts no persona role holds it.

**A user cannot cause a transition by writing one.** "Let the AI handle this" is
a message, and messages are text. They may ask; the server decides. This is the
same rule as B1's persona derivation, applied to state.

---

# 5. Messages

`authorType`: `USER` · `ASSISTANT` · `HUMAN_AGENT` · `SYSTEM`

| authorType    | `authorId`               | Written by                                 |
| ------------- | ------------------------ | ------------------------------------------ |
| `USER`        | the ticket owner, always | the persona-facing route                   |
| `HUMAN_AGENT` | the operator             | the Operations route                       |
| `ASSISTANT`   | `null`                   | the server's orchestrator, in-process only |
| `SYSTEM`      | `null`                   | the server, on state transitions           |

`authorId` is never read from the request body.

## Visibility is its own field, not an inference from `authorType`

`SYSTEM` covers two different things, and conflating them would leak the second:

```
SYSTEM message
   ├── user-visible event        "Your request has been transferred to a
   │                              support specialist."  ·  "Reopened."
   └── internal audit / control   operational metadata, never shown
```

So every message carries an explicit `visibility` classification. Deriving it
from `authorType` would mean that the day a `SYSTEM` event needs to carry
operational detail, it becomes visible to the user by default — a leak caused by
an omission rather than a decision.

A conversation that silently changes hands is worse than one that says so, which
is why the transition events are user-visible. That is a choice made per message,
not a property of being a `SYSTEM` message.

## Append-only, and how it will be enforced

Immutable after creation. A correction is a new message; a retraction is a new
message.

The review asked for the Prisma parity experiment before committing to a
mechanism. **It has been run, and the answer is clean:**

| Step                                             | Result                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Fresh database, all migrations applied           | `No difference detected`                                          |
| `CREATE TRIGGER … BEFORE UPDATE OR DELETE` added | trigger confirmed present in `pg_trigger`                         |
| `REVOKE UPDATE, DELETE … FROM dripplex` added    | grants reduced to `INSERT, SELECT, TRUNCATE, REFERENCES, TRIGGER` |
| `prisma migrate diff` re-run                     | **`No difference detected`**                                      |

So a trigger does **not** break migration parity, and the normal verification we
rely on everywhere stays quiet.

**But it is silent in both directions, and that is the part to design around.**
Prisma cannot see the trigger, so it will never report it missing either. A
database rebuilt from `schema.prisma` rather than from the migrations would have
no protection at all and no check would complain. Therefore:

- **the trigger is the mechanism.** `INSERT` allowed, `UPDATE` rejected, `DELETE`
  rejected. It binds even the table owner until explicitly dropped;
- **`REVOKE` is defence in depth, not the security boundary.** The owner can
  re-grant themselves in one statement, so it guards against accident, not
  intent;
- **CI asserts both, separately**: that the trigger exists, and that an attempted
  `UPDATE` and an attempted `DELETE` are actually rejected. Existence and
  behaviour are different claims and one does not imply the other.

### Operational invariant — read this before rebuilding a database

> **Any database recreation must apply the migrations. Reconstructing a database
> from `schema.prisma` alone produces a table with no immutability protection,
> and `prisma migrate diff` will report "No difference detected" anyway.**

This is written down because the failure is silent and the reassuring message is
the trap: a future engineer seeing "No difference detected" could reasonably
conclude the schema is fully verified. For this control it proves nothing.
`migrate diff` is not evidence that the immutability boundary exists — the CI
test above is.

## Ordering

`createdAt` is not an ordering — two messages can share a millisecond. Each
message carries a monotonic `seq` from a database sequence. Global rather than
per-conversation: a per-conversation counter needs read-modify-write and races,
and contiguity buys nothing.

---

# 6. Concurrency and idempotency

**Two operators claiming at once.** A conditional update — set `HUMAN_HANDLING`
where state is the one we read — so the loser gets zero rows and a clear refusal.
Never read-then-write.

**AI and human appending together.** Impossible by construction: no state permits
both. The mechanism is the state machine, not a lock.

**Retries.** Every append carries a caller-supplied `clientMessageId`, unique per
conversation; a retry returns the existing message rather than posting twice.
Escalation is idempotent for the same reason — escalating an already-escalated
ticket is a no-op, not an error and not a second `SYSTEM` message.

---

# 7. Retention — designed for, not decided

No retention period is chosen here. That belongs to the NDPR/provider decision,
and picking a number now would be inventing policy.

What B2 does decide is that the schema can express whatever that policy turns out
to be: `createdAt`, a retention/deletion state, and a redaction state, on
messages and on the conversation — so the answer is applied rather than
retrofitted.

## Our retention is not the provider's retention

This belongs in the record now, while the provider is still hypothetical.

```
delete from our PostgreSQL   ≠   deleted at the provider
```

Once a transcript has been sent to an external model provider, removing it from
our database says nothing about their copy, their logs, their retention window,
or whether it was trained on. B2 must not be designed as though "we can delete it
later" is a complete answer to a retention question — it is only an answer about
our own half.

The policy decision must therefore establish, at minimum: data minimisation; the
categories of support data sent externally; the provider and model; the
processing location; cross-border transfer; the provider's own retention;
whether submitted data is used for training; sensitive-information handling; the
deletion and erasure process; our retention period; the provider's deletion
guarantees; and incident and audit requirements.

## Hard architectural gate

> **No production transcript may be sent to an AI provider until that decision
> exists and is approved.**

This is a gate in the architecture, not a note in a plan. It binds regardless of
schedule pressure, regardless of a provider being wired up and working, and
regardless of anyone judging the risk acceptable in the moment. The decision is
the precondition; nothing else substitutes for it.

## Immutability is not the opposite of redaction

The trigger makes the original message unchangeable. That must not be read as
"redaction is impossible", because a retention or NDPR obligation may later
require content to stop being shown or stop being served.

```
Original message
   ├── immutable historical record        ← the trigger protects this
   └── controlled visibility / redaction metadata   ← alongside, not instead
```

Redaction is expressed as state beside the message, never by mutating it. The
exact legal mechanism can wait for the policy; what B2 must not do is ship a
design that implies the only way to satisfy a redaction requirement is to break
immutability — because at that point somebody drops the trigger.

---

# 8. Authorization, across all five personas

Reachable by exactly two parties: the user who owns the ticket — whatever persona
— and Operations holding the queue permission. This reuses B1's
`requireOwnedTicket`, so the isolation is the code path already mutation-proven,
not a second implementation of the same idea.

Tests mirror Phase 1's: every persona reaches their own; no persona reaches
another's; Operations reaches all; an unauthenticated caller reaches none.
Cross-persona and cross-user isolation are separate tests.

---

# 9. The provider boundary

Approved at review, unchanged, and restated because it is the point of doing B2
before B3.

**The provider is a callee, never a caller.** No credential, no route, no
database reach. The server decides to ask, asks, validates what comes back, and
appends it.

**There is no route that creates an `ASSISTANT` message.** The persona route
creates `USER` messages only; the Operations route creates `HUMAN_AGENT` only;
`authorType` is never a request field. `{"authorType": "ASSISTANT"}` is
structurally impossible through the public API.

**Assistant output is data, never authority.** Text saying "Refund the customer"
is text. It cannot refund, pay out, move a wallet, change a bank account, alter
commission or settlement, award points, approve a referral, change a fleet
receivable, resolve itself, change its own author, or bypass human handling.
`generatedBy` (provider, model, version) is audit metadata and confers no trust.

This boundary is independent of which provider is eventually chosen.

The import-boundary test is pulled a gate early: the conversation module must not
import wallet, payment, settlement, payout, ledger, commission or bank-account
services, nor any provider SDK — of which there is currently none. Better the
wall stands before there is anything to test it against.

---

# 10. Migration safety

One new table (`support_conversations`), one new table
(`support_messages`), one new enum for handling state, and one new column plus
one check constraint on `support_tickets`. Nothing existing is altered
destructively and no row is rewritten; the handling-state column is defaulted so
existing tickets are valid on arrival.

Constraints doing real work rather than documenting intent: the row-local `CHECK`
of §2, a unique `ticketId` on the conversation, a unique
`(conversationId, clientMessageId)` for idempotency, and the append-only trigger
of §5.

---

# 11. Tests

Ownership and cross-persona isolation · every legal transition · every illegal
one refused · the `CHECK` tested **directly against the database**, not only
through the service · `requiresHumanHandling` never written by B2 · the trigger
proven present · an attempted `UPDATE` proven rejected · an attempted `DELETE`
proven rejected · internal `SYSTEM` messages proven absent from the user-facing
transcript · `support:tickets:ai-handoff` held by no persona role ·
ordering under concurrent appends · idempotent retry · idempotent escalation ·
two operators claiming at once · audit entries · import boundary ·
fresh-database migration and parity.

Every guard mutation-proven, as in B1.

---

# Still open

**One item, and it is not B2's to invent: the retention and provider policy**
(§7). The schema is designed to accept whatever that decision says. Until it
exists and is approved, no production transcript reaches a provider.

Everything else raised at review is now decided and recorded above: reopening
reuses the conversation · the ticket owns handling state and the constraint is
row-local · B2 never clears `requiresHumanHandling` · the trigger is the
immutability boundary and `migrate diff` is not evidence of it · visibility is an
explicit field · `support:tickets:ai-handoff` is the capability, granted to
nobody by default · immutability and redaction are separate concerns.

No provider, no model, no AI route, no AI message writer, and no financial
capability anywhere in B2.
