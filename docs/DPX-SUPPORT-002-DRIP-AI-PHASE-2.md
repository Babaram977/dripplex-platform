# DPX-SUPPORT-002 — Drip AI Support Phase 2

**Status:** SPECIFICATION LOCKED — IMPLEMENTATION NOT AUTHORIZED

**Phase:** 2 of Universal Support

**Predecessor:** DPX-SUPPORT-001 — Universal Support Tickets

## 1. Purpose

Phase 2 extends the authenticated universal support flow with Drip AI as a first-line support assistant for eligible support conversations.

Target flow:

```text
Authenticated User
    ↓
Universal Support Ticket
    ↓
Server-side persona + safety/money routing
    ↓
Drip AI for eligible conversations
    ↓
Resolved OR Operations Cases
    ↓
Human Support
```

Drip AI is an assistant, not an authority over financial, safety, authorization, settlement, or account-control operations.

## 2. Locked scope

Phase 2 covers:

- authenticated users only;
- the existing universal `SupportTicket` architecture;
- Drip AI for approved informational/support use cases;
- controlled knowledge retrieval;
- deterministic human escalation;
- Operations Cases handoff;
- conversation history and auditability;
- strict tool/import boundaries;
- cross-persona ownership isolation;
- rate limiting and abuse controls.

Phase 2 does **not** authorize:

- guest support;
- autonomous payment operations;
- wallet operations;
- refunds;
- payouts;
- settlement operations;
- ledger mutation;
- commission changes;
- bank-account changes;
- DX Points mutation;
- referral reward mutation;
- KYC decisions;
- fraud decisions;
- safety decisions;
- unrestricted database access;
- unrestricted API/tool access;
- autonomous external communications;
- AI replacement of Operations.

## 3. B1 — Category authority: LOCKED

The client-supplied support category is **advisory metadata only**. It is never trusted as the AI safety-routing authority.

The existing Phase 1 `CreateSupportTicketDto.category` value is validated against the ten-category enum, but it arrives from the caller. Phase 2 must therefore independently determine whether a conversation requires human handling.

The authoritative routing rule is:

> **Server-side deterministic money/safety detection may widen a conversation into a human-handled category, but no classifier or client value may narrow a human-handled conversation into AI handling.**

A user selecting `TECHNICAL` cannot prevent a payment or safety issue from being routed to a human.

## 4. First safety/money gate — LOCKED

No LLM participates in the first safety/money gate.

The first gate is deterministic and server-controlled. It must identify payment, wallet, and safety signals before any AI processing is permitted.

The gate must be language-aware. DrippleX operates in Nigeria, so coverage must include at minimum English, Hausa, and Nigerian Pidgin expressions relevant to money/payment/wallet/safety problems. Language coverage is part of the deliverable, not an optional refinement.

The gate is intentionally asymmetric:

- false positive → a resolvable conversation reaches a human;
- false negative → automation can approach a user's money or safety.

The system must therefore be tuned toward **over-triggering**, not deflection rate, AI containment, or cost-per-ticket optimisation. The false-positive asymmetry may not be weakened to improve automation metrics.

## 5. Human-only categories — LOCKED

`PAYMENT`, `WALLET`, and `SAFETY` are mandatory human-handled categories.

If deterministic detection identifies one of these subjects, the conversation is escalated to Operations regardless of the category supplied by the client and regardless of any model confidence.

For `SAFETY`, the first response must be a fixed, server-controlled, non-generated template followed by immediate human escalation. A person reporting danger must not have to interact with an LLM before reaching human support.

For `PAYMENT` and `WALLET`, AI must not perform financial resolution or mutation. A fixed acknowledgement may be used where appropriate, but the conversation remains human-handled.

## 6. AI classification — LOCKED

After the deterministic gate, AI classification may operate only on conversations not already forced to human handling.

AI classification may **widen** routing into a human category. It may never narrow a conversation that has already been identified as human-handled.

The model's self-reported confidence is **telemetry only**. It is not an authorization or routing decision.

## 7. Deterministic escalation triggers — LOCKED

At minimum, escalation occurs when any of the following applies:

1. no approved knowledge match;
2. an AI tool is unavailable or denied;
3. the conversation exceeds the configured unsuccessful-turn limit;
4. the user explicitly requests a human;
5. a sensitive subject is detected;
6. the request is unsupported;
7. a policy requires human review;
8. the AI/provider fails, times out, or returns an unusable result.

Additional deterministic triggers may be added only through a reviewed specification change.

## 8. Knowledge layer

Drip AI must answer from an approved DrippleX knowledge layer rather than unrestricted repository/database access.

The knowledge layer must contain approved, human-authored policy and support content such as:

- ride procedures;
- cancellation policy;
- delivery procedures;
- food/order procedures;
- merchant procedures;
- account procedures;
- technical troubleshooting;
- approved support FAQs;
- escalation procedures;
- applicable service information.

Policy content is a DrippleX business decision and must be authored/approved by DrippleX. Code implementation must not invent company policy.

## 9. User context and data minimisation

The AI may receive only the minimum authenticated context necessary for the support task, such as:

- authenticated user identifier;
- server-derived persona;
- relevant support ticket;
- relevant order identifier;
- relevant ride identifier;
- relevant app/platform version;
- permitted status/context data.

The AI must not receive unrestricted access to another user's records, the complete database, financial ledgers, bank credentials, or unrelated historical data.

## 10. Financial and safety authority boundary — LOCKED

Drip AI must have no authority to:

- move wallet money;
- issue refunds;
- initiate payouts;
- change bank accounts;
- change merchant settlement rates;
- change commission rates;
- alter settlement records;
- approve transactions;
- alter ledgers;
- modify driver earnings;
- modify fleet receivables;
- modify DX Points balances;
- approve referral rewards;
- make KYC/fraud/safety decisions.

These are not merely prompt-level prohibitions. The AI tool interface must not expose mutation capabilities for these operations.

## 11. AI tool import boundary — LOCKED ACCEPTANCE GATE

The AI tool module must not import wallet, payment, settlement, payout, ledger, commission, bank-account, DX Points, or referral-financial services.

An automated import-boundary test is required to prove this property at build/test time.

The desired security model is therefore:

```text
AI
 ↓
Approved read-only/support tools

NOT

AI
 ↓
Financial mutation services
```

A future financial or operational AI capability requires a separate explicit product and security authorization; it is not implied by Phase 2.

## 12. Conversation model

Phase 2 should introduce persistent support conversation messages associated with `SupportTicket` rather than embedding the entire conversation in the ticket record.

Messages should record, as applicable:

- ticket ID;
- sender type;
- authenticated user;
- AI or human origin;
- timestamp;
- content;
- tool/action metadata where relevant;
- escalation events.

Human takeover must preserve the complete conversation context.

Once human takeover occurs, automated AI replies must stop unless a future explicitly authorized workflow re-enables them.

## 13. AI audit trail

The system must record auditable events including, where applicable:

- `AI_RESPONSE_GENERATED`;
- `AI_ESCALATED`;
- `AI_KNOWLEDGE_LOOKUP`;
- `AI_TOOL_REQUESTED`;
- `AI_TOOL_EXECUTED`;
- `AI_TOOL_DENIED`;
- `HUMAN_HANDOFF`.

Audit records must not become a covert channel for storing unnecessary sensitive information.

## 14. Human-readable support reference

The internal `SupportTicket.id` remains the UUID primary key.

Phase 2 should add a unique customer/Operations-facing reference such as:

`DPX-000001`

The reference must be generated by a PostgreSQL sequence or an equally concurrency-safe database mechanism.

It must **not** use `count(*) + 1`, timestamps alone, or other collision-prone application logic.

## 15. Operations handoff

When AI cannot safely resolve a conversation, the existing Operations Cases queue remains the human destination.

Operations should receive:

- support reference;
- full conversation;
- authenticated user/persona;
- category and server-side routing result;
- escalation reason;
- relevant order/ride context;
- concise AI-generated handoff summary where safe;
- complete audit/history.

AI must not fabricate case facts in the handoff summary. Unsupported information must be clearly absent/unknown.

## 16. Prompt-injection resistance

User text is never authority.

Requests such as:

- pretending to be an administrator;
- asking for another user's information;
- instructing the model to ignore system rules;
- requesting financial mutations;
- requesting hidden/internal information;

must not change backend authorization or tool availability.

Authorization remains server-side:

```text
Authentication
    ↓
Backend authorization
    ↓
Resource ownership
    ↓
Allowed AI operation
```

not:

```text
User request
    ↓
AI decides whether the user is authorized
```

## 17. Rate limiting and abuse controls

AI usage must have explicit controls separate from ordinary support-ticket limits, including appropriate limits for:

- requests per minute/user;
- messages per ticket;
- concurrent conversations;
- input size;
- output size;
- repeated/abusive requests.

Provider failure or exhaustion must degrade safely to human support rather than silently failing or bypassing safety routing.

## 18. NDPR / third-party model decision — REQUIRED BEFORE PRODUCTION AI

Before production AI is enabled, DrippleX must document and approve the privacy/data-processing decision covering:

- what user data leaves DrippleX;
- which third-party model/provider receives it;
- provider retention;
- whether provider training/use of submitted data is permitted;
- data minimisation;
- sensitive information handling;
- deletion and retention periods;
- applicable Nigerian NDPR/privacy requirements;
- applicable cross-border data-transfer considerations;
- contractual/data-processing protections where required.

No third-party LLM integration is production-authorized until this decision is documented.

## 19. Required acceptance gates

### Security

- authenticated users only;
- server-derived persona;
- ownership isolation;
- cross-persona authorization tests;
- prompt-injection tests;
- tool authorization tests;
- no cross-user data leakage;
- AI import-boundary test passes.

### Safety

- deterministic money/safety gate executes before LLM processing;
- English/Hausa/Nigerian Pidgin coverage is tested;
- PAYMENT always human;
- WALLET always human;
- SAFETY always human;
- safety uses a fixed non-generated acknowledgement;
- classification may widen but never narrow human routing.

### Financial isolation

- zero AI payment mutations;
- zero AI wallet mutations;
- zero AI settlement mutations;
- zero AI payout mutations;
- zero AI ledger mutations;
- zero AI commission mutations;
- zero AI bank-account mutations;
- zero AI DX Points/referral-financial mutations.

### Reliability

- provider timeout handling;
- provider failure handling;
- deterministic escalation;
- idempotent human handoff;
- duplicate-message protection;
- rate limiting.

### Operations

- complete conversation visible;
- human takeover;
- AI handoff summary;
- audit trail;
- customer-visible support reference.

### Data/privacy

- NDPR/data-processing decision documented;
- data minimisation verified;
- provider retention/training posture documented;
- cross-border handling reviewed where applicable.

### Database

- migration from a fresh database succeeds;
- migration/schema parity verified;
- support reference uniqueness proven under concurrency;
- no production migration-state manipulation during development/testing.

## 20. Explicit implementation boundary

**This document authorizes specification only. It does not authorize implementation.**

Implementation requires an explicit Phase 2 go-ahead after this record is reviewed and the NDPR/provider decision is resolved to the required standard.

## 21. Phase relationship

### Phase 1 — DPX-SUPPORT-001

```text
Authenticated persona
    ↓
Universal Support Ticket
    ↓
Operations Cases
    ↓
Human support
```

### Phase 2 — DPX-SUPPORT-002

```text
Authenticated persona
    ↓
Universal Support Ticket
    ↓
Deterministic money/safety gate
    ├── PAYMENT/WALLET/SAFETY → Human
    └── Eligible → Drip AI
                    ├── resolved
                    └── escalation → Operations → Human
```

The Phase 1 scope remains unchanged by this record.
