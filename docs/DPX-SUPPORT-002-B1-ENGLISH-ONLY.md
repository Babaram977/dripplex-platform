# B1 safety gate — English only

**Founder decision 2026-09-11. Amends §4 of the Phase 2 record, which required
Hausa and Nigerian Pidgin coverage as part of the deliverable.**

> The Phase 2 record lives on the `dpx-support-002-phase-2-spec` branch, not
> here, so this document cannot edit it. **§4 of that file still says the gate
> must be language-aware and that Hausa and Pidgin coverage is part of the
> deliverable — that requirement is withdrawn by this decision and the file
> needs the same note applied when the two branches next meet.** Everything else
> in §4 stands: deterministic, no LLM in the first gate, tuned toward
> over-triggering, never re-tuned for deflection rate.

## The decision

The deterministic money/safety gate reads **English only**, and:

> A message that is not confidently English goes to a human rather than being
> guessed at.

```
English, confidently read
        ↓
  Deterministic gate
        ↓
  PAYMENT / WALLET / SAFETY  →  HUMAN
  everything else            →  Drip AI

Not confidently English
        ↓
      HUMAN
```

The second half is what makes the first half safe. English-only on its own would
mean somebody writing "An sace kudina" — my money was stolen — getting no safety
routing and being handed to automation. With the deferral, the platform's answer
to a language it cannot read is "a person will look at this", which is both
correct and honest.

## Why the multilingual lexicon was withdrawn

A 93-term Hausa and Nigerian Pidgin lexicon was written and then removed before
merge. It was not good enough to be trusted with the job, and testing it against
the real gate is what showed that:

| Message                               | Meaning                        | Was routed to |
| ------------------------------------- | ------------------------------ | ------------- |
| `Ina bukatar taimako da odar na`      | I need help with my order      | SAFETY        |
| `Na kashe kudi da yawa`               | I spent a lot of money         | SAFETY        |
| `Ka kashe wuta`                       | Turn off the light             | SAFETY        |
| `Abincin ya bata`                     | The food is spoiled            | PAYMENT       |
| `Ina son canza tsaro na asusu`        | Change my account security     | SAFETY        |
| `Na wa o, my order is two hours late` | (exclamation) my order is late | SAFETY        |

The pattern mattered more than any single term. Bare "help" was excluded from
English because every support message contains it, then `taimako`, `taimaka` and
`taimake ni` were included in Hausa — so an ordinary Hausa message was likely to
be classified as an emergency while the same message in English was not. If most
Hausa tickets are emergencies then none of them are, and the queue loses the
ability to tell which is which.

A word list nobody qualified has checked is not safety work. Deferring to a human
is.

## What this costs, and when it starts costing

Today it costs nothing. Phase 1 sends **every** support ticket to a human
regardless — the gate decides which queue, not whether a person sees it.

It starts costing the moment Drip AI can answer a ticket without a person. At
that moment an unreviewed language would mean a Hausa speaker's stolen-money
report handled by a bot while an English speaker's reaches a person. The deferral
rule is what prevents that: a message the gate cannot read never reaches Drip AI
at all.

## Prerequisite recorded

Hausa and Nigerian Pidgin coverage, reviewed by native speakers with its own
tests, is a **prerequisite for Drip AI going live** — not for this gate shipping.
It is a separate, deliberate language expansion once Drip AI is proven in
production, not a rush item folded into a first version.

That sequencing is the whole reason English-only is safe now.

## How "not confidently English" is decided

Deterministic, no model. The test is not "which language is this" — that is a
hard problem and the wrong question. It is only "does this look like English the
gate can be trusted on", and the answer is allowed to be no.

A message defers to a human when it contains a letter English does not use
(the Hausa hooked consonants ɗ ƙ ɓ, or any non-Latin script), **or** when it runs
to three words or more and contains none of a list of English marker words —
function words plus the support nouns that carry short messages like "App crashes
constantly".

Three English function words are deliberately **not** markers: `a`, `an` and
`in`. Each is also a common Hausa word — `an` marks the perfective — and
including them made "An sace kudina" read as English. An English sentence long
enough to judge carries other markers, and a test proves it.

Nigerian Pidgin is read as English on purpose. It shares the function words, and
its money and safety vocabulary overlaps English closely enough that the main
lexicon catches what matters: "dem charge me" hits `charge`, "dem wan kill me"
hits `kill me`.

Messages under three words are not judged at all — too little signal, and the
lexicon already catches the ones that matter ("Refund").

## Withdrawn work, kept as history

`docs/DPX-SUPPORT-002-B1-LEXICON-REVIEW.md` and the phone-first reviewer page
were built to get the Hausa and Pidgin lists checked by native speakers. Both are
superseded and the document is removed from the tree; the work survives in the
history at `5fe45109` and `4fac1876`, and is the starting point for the language
expansion when it happens.

No native-speaker dependency remains on the critical path.
