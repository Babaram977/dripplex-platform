# DPX-SUPPORT-002 B2 — support conversations and handoff

**Architecture for review. No implementation. No schema, no code, no migration.**

Branch reset from merged B1 at `043f2847`.

## Scope

```
SupportTicket
   └── SupportConversation        (one live at a time; carries handoff state)
          └── SupportMessage      (append-only)
```

Plus the handoff state machine. Nothing else: no model, no provider, no AI
tools, no wallet/payment/settlement access, no NDPR implementation.

The job of B2 is to build the room the AI will later be allowed into, and to
fit the locks before anyone is standing in the doorway.

---

# 1. The invariant everything else serves

> **A ticket whose `requiresHumanHandling` is true can never have a conversation
> in `AI_HANDLING`.**

B1 decides that flag — from the declared category, from the money/safety
lexicon, or because the message was not confidently English. B2's only job with
respect to it is to make it impossible to lose.

Enforced in three places, deliberately redundant:

- at conversation creation, which refuses to open in `AI_HANDLING`;
- at every transition into `AI_HANDLING`, which re-reads the ticket rather than
  trusting a value carried in memory;
- by a database constraint, so a future writer that bypasses the service still
  cannot do it (see §11).

If only one of those survives review, it should be the constraint.

---

# 2. Why a conversation layer, and when it earns its place

A middle table between ticket and message is only worth its cost if a ticket can
have more than one conversation. It can, in exactly one case: **a resolved
ticket that is reopened.**

Reopening must not resume the old thread. The handoff state, the AI's prior
turns and the operator who closed it are the record of what happened last time;
continuing to append to them would rewrite that record. So reopening opens a
**new** conversation, and the previous one becomes immutable history.

That is the whole justification. If founder review decides a ticket is never
reopened, this layer should collapse into the ticket and B2 becomes
`SupportTicket → SupportMessage` with the state machine on the ticket. **That is
a real question and I would rather have it answered than assume.**

Only one conversation per ticket may be live at a time — enforced by a partial
unique index, not by application care.

---

# 3. Message authorship

`authorType`: `USER` · `ASSISTANT` · `HUMAN_AGENT` · `SYSTEM`

| authorType    | `authorId`               | Written by                                |
| ------------- | ------------------------ | ----------------------------------------- |
| `USER`        | the ticket owner, always | the persona-facing route                  |
| `HUMAN_AGENT` | the operator             | the Operations route                      |
| `ASSISTANT`   | `null`                   | the server's own orchestrator, in-process |
| `SYSTEM`      | `null`                   | the server, for state transitions         |

`authorId` is never taken from the request body. For `USER` it is the session's
user and must equal the ticket owner; for `HUMAN_AGENT` it is the authenticated
operator. A caller cannot name the author of their own message, for the same
reason they cannot name their own persona in B1.

**`SYSTEM` messages are part of the transcript, not a side channel.** "Escalated
to a person", "Amina took over" — the user sees these, because a conversation
that silently changes hands is worse than one that says so.

---

# 4. Append-only, and how far that actually holds

No update. No delete. A correction is a new message; a retraction is a new
message.

The service will expose no update or delete method, and that is the primary
control. Two stronger controls are proposed and **both need verifying before
they are relied on**:

- a database `REVOKE UPDATE, DELETE` on the message table for the application
  role, so a future writer cannot do it even by mistake;
- failing that, a trigger that raises on UPDATE/DELETE.

The honest caveat: neither is expressible in `schema.prisma`. I do not yet know
whether `prisma migrate diff` reports a trigger or a revoked grant as drift —
if it does, the whole migration-parity check we rely on everywhere becomes
noisy, which is too high a price. **I will test this before proposing it as the
mechanism rather than assert it now.**

---

# 5. Conversation lifecycle and the handoff state machine

```
                    ┌──────────────┐
  ticket created ──▶│ AWAITING_HUMAN│◀── requiresHumanHandling, always
                    └──────┬───────┘
                           │ operator claims
                           ▼
                    ┌──────────────┐
                    │HUMAN_HANDLING│
                    └──────┬───────┘
                           │ resolve
                           ▼
                    ┌──────────────┐        reopen
                    │   RESOLVED   │────────────────▶ new conversation
                    └──────┬───────┘
                           │ close (no reopen)
                           ▼
                       ┌────────┐
                       │ CLOSED │
                       └────────┘

  eligible ticket ──▶ AI_HANDLING ──┬── escalate ──▶ AWAITING_HUMAN
                                     └── resolve ───▶ RESOLVED
```

| From             | To               | Who                                        |
| ---------------- | ---------------- | ------------------------------------------ |
| `AI_HANDLING`    | `AWAITING_HUMAN` | server (deterministic escalation triggers) |
| `AI_HANDLING`    | `RESOLVED`       | server, only for AI-eligible tickets       |
| `AWAITING_HUMAN` | `HUMAN_HANDLING` | operator claiming                          |
| `HUMAN_HANDLING` | `RESOLVED`       | operator                                   |
| `HUMAN_HANDLING` | `AI_HANDLING`    | **operator, explicitly — never automatic** |
| `RESOLVED`       | `CLOSED`         | operator or sweep                          |
| any              | `AI_HANDLING`    | **refused** when `requiresHumanHandling`   |

Every other transition is refused. Transitions are recorded as `SYSTEM` messages
and as audit entries.

## Human takeover, and returning to the AI

Once an operator takes over, **the AI stops**. Not "is discouraged" — there is no
state in which both may append. Returning a conversation to `AI_HANDLING` is an
explicit operator action with its own permission, never a timeout, never a sweep,
and never available on a ticket that requires human handling.

Open for review: **which role may return a conversation to the AI?** My
suggestion is that it should not be the same grant as answering tickets —
handing a live conversation back to automation is a different decision from
replying to it.

---

# 6. Concurrency and ordering

Three races, each with a mechanism rather than a hope:

**Two operators claiming at once.** The claim is a conditional update — "set
`HUMAN_HANDLING` where state is `AWAITING_HUMAN`" — and the loser gets zero rows
and a clear refusal. Never read-then-write.

**Message ordering.** `createdAt` is not an ordering: two messages can share a
millisecond. Each message carries a monotonic `seq` from a database sequence.
Global rather than per-conversation, deliberately: a per-conversation counter
needs read-modify-write and races, and contiguity buys nothing.

**AI and human appending together.** Cannot happen, because the state machine has
no state where both may write — the mechanism is §5, not locking.

---

# 7. Idempotency

A phone on a bad connection retries. Every append takes a caller-supplied
`clientMessageId`, unique per conversation: a retry returns the existing message
rather than posting twice.

Escalation is idempotent for the same reason — escalating an already-escalated
conversation is a no-op, not an error and not a second `SYSTEM` message.

---

# 8. Audit

`support.conversation.opened` · `.message.appended` · `.escalated` ·
`.claimed` · `.returned_to_ai` · `.resolved` · `.closed`

Through the existing `AuditService`, as B1 and Phase 1 do. `.returned_to_ai`
matters most: it is the only way a conversation goes back to automation, and it
should be easy to ask "who did that, and when".

---

# 9. Authorization, across all five personas

A conversation is reachable by exactly two parties: the user who owns the ticket
— whatever persona — and Operations holding the queue permission. This reuses
B1's `requireOwnedTicket`, so the isolation is the same code path already
mutation-proven, not a second implementation of the same idea.

Tests mirror Phase 1's: every persona can reach their own; no persona can reach
another's; Operations can reach all; an unauthenticated caller reaches none.
Cross-persona and cross-user isolation are each their own test, not one test with
two assertions.

---

# 10. Support reference linkage

Conversations hang off the ticket by foreign key, and the ticket is the unit
Operations already sees. The human-readable `DPX-000001` reference remains
deferred — it belongs with this work, and when it lands it must come from a
Postgres sequence, never `count(*) + 1`.

---

# 11. Migration safety

Two new tables and one new enum; nothing existing is altered and no row is
rewritten. Two constraints do real work rather than documenting intent:

- a partial unique index giving one live conversation per ticket;
- a check constraint that `state <> 'AI_HANDLING'` whenever the ticket requires
  human handling. This one needs the flag reachable from the conversation row —
  either denormalised onto it (with the cost of keeping it true) or enforced by
  trigger. **Which, is a review question**; the denormalised copy is simpler to
  reason about and the trigger avoids a second source of truth.

---

# 12. The provider boundary — the part most worth reviewing

Review asked that B2 must not accidentally create an API shape that makes the
eventual provider look like a trusted internal service. Concretely, that mistake
would be a `postAssistantMessage(conversationId, text)` that any internal caller
can reach. Three rules prevent it:

**The provider is a callee, never a caller.** It holds no credential, has no
route, and cannot reach the database. The server decides to ask, asks, validates
what comes back, and appends it. Nothing about that flow is reversible.

**There is no route that creates an `ASSISTANT` message.** The persona route
creates `USER` messages only; the Operations route creates `HUMAN_AGENT`
messages only; `authorType` is never a request field. Assistant messages are
created in-process by the orchestrator, in reply to a specific user message.

**Assistant output is data, never authority.** It cannot change conversation
state, resolve a ticket, clear `requiresHumanHandling`, name its own author, or
cause a tool call by saying so. `generatedBy` (provider, model, version) is
recorded for audit and **confers no trust**.

The import-boundary test from the Phase 2 record applies here too, one gate
early: the conversation module must not import wallet, payment, settlement,
payout, ledger, commission or bank-account services — nor any provider SDK,
of which there is currently none. Better to have the wall standing before there
is anything to test it against.

---

# 13. Tests

Ownership and cross-persona isolation · every legal transition · every illegal
one refused · `requiresHumanHandling` never reaching `AI_HANDLING` (the
constraint tested directly, not only through the service) · append-only ·
ordering under concurrent appends · idempotent retry · idempotent escalation ·
two operators claiming at once · audit entries · import boundary · fresh-database
migration. Every guard mutation-proven, as in B1.

---

# Open for founder decision, before implementation

1. **Is a ticket ever reopened?** If not, the conversation layer collapses into
   the ticket (§2) and B2 gets materially simpler.
2. **Who may return a conversation from a human to the AI?** (§5)
3. **Trigger or denormalised flag** for the never-AI constraint (§11).
4. **Message retention.** Transcripts are PII and will eventually be sent to a
   provider. Retention and deletion belong in the NDPR decision, and the schema
   should be designed knowing the answer rather than retrofitted.
5. **Are `SYSTEM` messages visible to the user?** I have assumed yes (§3).
