# B1 safety gate — Hausa & Nigerian Pidgin lexicon review

**Gate 1 of the PR #363 review. This document is the blocker.**

## What this is, and why you are reading it

DrippleX now screens every support ticket for money and safety problems before
it can be handled automatically. The screen works by looking for certain words
and phrases in what the user actually wrote.

The English word list was written by the engineering team with confidence. The
**Hausa and Nigerian Pidgin lists were not** — they are a starting point, and
they need someone who actually speaks the language to check them.

This matters more than a normal translation review, for one reason:

> When this list misses how a real person describes losing money or being in
> danger, **nothing breaks and nobody is told.** The ticket simply gets treated
> as an ordinary question. There is no error, no alert, and no way to notice
> from the outside.

A word that is missing from this list is a Kano user whose stolen-money
complaint, or whose emergency, quietly goes into the ordinary queue while the
same complaint in English goes straight to a person.

## How to actually do this review

**Use the review page:** <https://claude.ai/code/artifact/46bf008a-be01-47d6-859e-f7a924b03fda>

It is the same 93 terms as this document, built for a phone: one word at a time,
Keep / Remove / Not sure, a box for corrections, and it saves as you go so the
reviewer can stop and come back. It leads with the seven flagged terms.

This document stays the durable record. When the review comes back, the answers
are read out of the page and committed here as
`docs/DPX-SUPPORT-002-B1-LEXICON-REVIEW-RESPONSES.md`, so the judgement lives in
the repository next to the code it changes — not in a chat thread.

## What we need from you

For each term below:

- **Is the meaning right?** We have written what we think each term means.
- **Would a real person actually write this?** Being correct Hausa is not the
  test. The test is whether someone angry, frightened or in a hurry types it
  into a support form on a phone.
- **What are we missing?** This is the most valuable column. Synonyms, slang,
  regional variants, common misspellings, the way people actually type it.
- **Should anything be removed?** Some terms may be so common in ordinary
  support messages that they would send almost everything to a human.

Spelling note: the system already ignores diacritics and hooked letters, so
**kuɗi and kudi are treated as the same word**, as are ƙ/k and ɓ/b. You do not
need to list both spellings. Capitalisation and punctuation are also ignored.

---

# Please look at these first

These are terms the engineering team already suspects are wrong. We have
deliberately **not** changed them, so that you review what actually ships rather
than a list we have already second-guessed.

### 1. "Help" may be over-triggering in Hausa but not in English

In English we deliberately **excluded** the bare word _help_, because almost
every support message contains it — "please help me with my order". We only
included the phrase _help me_.

In Hausa we included **taimako**, **taimaka**, **taimake ni** and **ku taimake
ni** — all forms of "help". In Pidgin we included **abeg help** and **help me
abeg**.

If a Hausa speaker writing "Ina bukatar taimako" about a late delivery is
treated as an emergency, then **every Hausa ticket becomes an emergency**, and
the screen stops meaning anything for Hausa users — while continuing to work
normally for English users. That is worse than not having it.

**Question for you:** is _taimako_ / _taimaka_ generic enough that it should be
removed, keeping only phrases that clearly signal danger?

### 2. "na wa o" is almost certainly wrong

We listed **na wa o** as a Pidgin safety term. On reflection this looks like a
general exclamation of frustration — closer to "oh dear" than to a cry for help.
If so it would route a huge number of ordinary complaints to emergency handling.

**Question for you:** should this be removed outright?

### 3. "kashe" has a money meaning as well as a violent one

We listed **kashe** ("kill") as a safety term. We believe it also means "spend"
(_kashe kudi_) and "switch off" (_kashe wuta_). If so, someone writing "na kashe
kudi" — I spent money — would be treated as reporting a threat to life.

**Question for you:** should the bare word be removed and only phrases like
_zai kashe ni_ kept?

### 4. "ya bata" may be about food, not money

We listed **ya bata** ("it is lost / spoiled") as a money term. On a food
delivery platform, _abincin ya bata_ — the food is spoiled — is a very common
and completely different complaint.

**Question for you:** should this be removed, keeping only _kudina ya bata_?

### 5. "tsaro" may mean account security, not physical safety

We listed **tsaro** ("security") as a safety term. If it is also the ordinary
word for account/password security, it belongs in the account category instead.

### 6. "sace" — DECIDED, no longer a question for you

We had asked whether "an sace kudina" (my money was stolen) should reach the
safety team or the payments team. **Answered by the founder, 2026-09-11:**

> Safety takes precedence over financial classification whenever the user's
> wording indicates theft, coercion, violence, threat, assault, or personal
> danger — even when the object is money.

The reasoning: this gate is a risk-escalation boundary, not a final support-team
classifier. Somebody saying their money was stolen may be describing fraud, a
compromised account, coercion, or a threat to their person. Safety first; the
human team can hand it to Payments afterwards if that is all it turns out to be.

So _an sace kudina_ → SAFETY is **correct** and stays. You do not need to
comment on this one.

### 7. "comot" may just mean logging out

We listed **i wan comot** and **make i comot** as safety terms, thinking of
someone trapped in a vehicle. But "I want to comot" might equally mean "I want
to leave / log out / delete my account".

**Question for you:** are these safe to keep, or do they need the vehicle
context spelled out?

### 8. The English list breaks the rule we just made

The decision above is not a Hausa question — it is a general rule, and the
English list does not currently follow it. Run against the shipping gate:

| Sentence                                               | Goes to | Because of | Should be |
| ------------------------------------------------------ | ------- | ---------- | --------- |
| `Someone stole my money`                               | PAYMENT | `money`    | SAFETY    |
| `Someone has stolen my money`                          | PAYMENT | `stolen`   | SAFETY    |
| `Someone took money from my wallet without permission` | PAYMENT | `money`    | SAFETY    |
| `The driver robbed me`                                 | SAFETY  | `robbed`   | SAFETY    |
| `My wallet was charged twice`                          | PAYMENT | `wallet`   | PAYMENT   |
| `An cire kudi daga account dina`                       | PAYMENT | `kudi`     | PAYMENT   |

Two separate problems, both ours and neither yours to solve:

1. **stolen, theft, thief, fraud, scam, cheated and duped are all filed under
   money.** Under the rule above, the theft and coercion ones belong under
   safety.
2. **The word "stole" is not in the list at all.** "Someone stole my money"
   only matched because it contains the word _money_ — the theft itself went
   unnoticed. The past tense of the commonest theft verb in English is missing.

Recorded here rather than fixed immediately, because the corrections all land in
one reviewed commit after you have been through the list. But note what it
means: **the English list was not as safe as we said it was**, and it took
writing this document for us to see it.

### What these flags actually do, run against the shipping code

Not predictions. This is the current behaviour, observed by feeding each
sentence through the real gate:

| Sentence                              | Meaning                              | Routed to | Because of    | Should be       |
| ------------------------------------- | ------------------------------------ | --------- | ------------- | --------------- |
| `Ina bukatar taimako da odar na`      | I need help with my order            | SAFETY    | `taimako`     | ordinary        |
| `Na wa o, my order is two hours late` | (exclamation) my order is late       | SAFETY    | `na wa o`     | ordinary        |
| `Na kashe kudi da yawa`               | I spent a lot of money               | SAFETY    | `kashe`       | payment at most |
| `Ka kashe wuta`                       | Turn off the light                   | SAFETY    | `kashe`       | ordinary        |
| `Abincin ya bata`                     | The food is spoiled                  | PAYMENT   | `ya bata`     | food order      |
| `Ina son canza tsaro na asusu`        | I want to change my account security | SAFETY    | `tsaro`       | account         |
| `I wan comot for this app`            | I want to leave this app             | SAFETY    | `i wan comot` | ordinary        |
| `An sace kudina`                      | My money was stolen                  | SAFETY    | `sace`        | you tell us     |

And the two controls, which behave correctly:

| Sentence                     | Meaning                            | Routed to  |
| ---------------------------- | ---------------------------------- | ---------- |
| `Direban ya ce zai kashe ni` | The driver said he will kill me    | SAFETY ✅  |
| `An cire kudi daga asusuna`  | Money was deducted from my account | PAYMENT ✅ |

Read together, these say something the English list does not have a problem
with: **an ordinary Hausa message is currently quite likely to be treated as an
emergency.** Over-triggering is the intended bias, but not like this — if most
Hausa tickets are emergencies then none of them are, and the Operations queue
stops being able to tell the difference. That is the single most important
thing for you to fix.

We have deliberately left all of this in place rather than guessing at repairs,
so that you review what actually ships. The pull request is blocked until you
have, so none of it can reach users in the meantime.

---

# Hausa — money and payment terms

Reviewer: mark **Keep**, **Remove**, or write a correction.

| Term            | We think it means           | Example we imagined (please correct)      | Keep? | Your correction / synonyms to add |
| --------------- | --------------------------- | ----------------------------------------- | ----- | --------------------------------- |
| kudi            | money                       | "Ba a mayar min da kudi ba."              |       |                                   |
| kudina          | my money                    | "Ina son kudina."                         |       |                                   |
| kudi na         | my money (spaced)           | "Kudi na ya bace."                        |       |                                   |
| kudinmu         | our money                   | "Kudinmu bai iso ba."                     |       |                                   |
| banki           | bank                        | "Bankin bai karbi kudin ba."              |       |                                   |
| asusu           | account                     | "An cire kudi daga asusuna."              |       |                                   |
| biya            | pay / payment               | "Ban samu biya ba."                       |       |                                   |
| biyan           | payment (construct)         | "Biyan kudin bai yi ba."                  |       |                                   |
| an biya         | it was paid                 | "An biya amma ba a samu ba."              |       |                                   |
| ba a biya ba    | it was not paid             | "Ban gama aiki ba amma ba a biya ba."     |       |                                   |
| ba a biya ni ba | I was not paid              | "Na kammala tafiya amma ba a biya ni ba." |       |                                   |
| an cire         | it was deducted / withdrawn | "An cire kudi ba tare da izina ba."       |       |                                   |
| cire kudi       | withdraw money              | "Ina son cire kudi daga walat dina."      |       |                                   |
| an cire kudi    | money was deducted          | "An cire kudi sau biyu."                  |       |                                   |
| sata            | theft                       | "Sata aka yi min."                        |       |                                   |
| an sace         | it was stolen               | "An sace kudina." (see flag 6)            |       |                                   |
| barawo          | thief                       | "Direban barawo ne."                      |       |                                   |
| damfara         | fraud / swindle             | "Damfara aka yi min."                     |       |                                   |
| ba ni kudina    | give me my money            | "Ba ni kudina yanzu."                     |       |                                   |
| kudina ya bata  | my money is lost            | "Kudina ya bata a cikin walat."           |       |                                   |
| ya bata         | it is lost / spoiled        | (see flag 4)                              |       |                                   |

# Hausa — safety terms

| Term          | We think it means              | Example we imagined (please correct) | Keep? | Your correction / synonyms to add |
| ------------- | ------------------------------ | ------------------------------------ | ----- | --------------------------------- |
| hatsari       | accident / danger              | "Mun yi hatsari a kan hanya."        |       |                                   |
| hadari        | accident / danger (also storm) | "An yi hadari da mota."              |       |                                   |
| taimaka       | help (verb)                    | (see flag 1)                         |       |                                   |
| taimake ni    | help me                        | (see flag 1)                         |       |                                   |
| taimako       | help (noun)                    | (see flag 1)                         |       |                                   |
| ku taimake ni | help me (polite/plural)        | (see flag 1)                         |       |                                   |
| ceto          | rescue                         | "Ina bukatar ceto."                  |       |                                   |
| ina tsoro     | I am afraid                    | "Ina tsoron direban."                |       |                                   |
| tsoro         | fear                           | "Ina jin tsoro."                     |       |                                   |
| tsaro         | security                       | (see flag 5)                         |       |                                   |
| yan sanda     | police                         | "An kira yan sanda."                 |       |                                   |
| asibiti       | hospital                       | "An kai ni asibiti."                 |       |                                   |
| rauni         | injury / wound                 | "Na samu rauni."                     |       |                                   |
| ya ji rauni   | he/she was injured             | "Fasinjan ya ji rauni."              |       |                                   |
| na ji rauni   | I was injured                  | "Na ji rauni a hannu."               |       |                                   |
| bindiga       | gun                            | "Yana da bindiga."                   |       |                                   |
| wuka          | knife                          | "Ya zare wuka."                      |       |                                   |
| fyade         | rape                           | "An yi min fyade."                   |       |                                   |
| garkuwa       | kidnapping / hostage           | "An yi garkuwa da ni."               |       |                                   |
| sace          | abduct / steal                 | (see flag 6)                         |       |                                   |
| an sace ni    | I was abducted                 | "An sace ni a kan hanya."            |       |                                   |
| kashe         | kill                           | (see flag 3)                         |       |                                   |
| zai kashe ni  | he will kill me                | "Direban ya ce zai kashe ni."        |       |                                   |
| suna binni    | they are following me          | "Suna bina tun da jimawa."           |       |                                   |
| mutuwa        | death                          | "Kusan mutuwa na yi."                |       |                                   |

# Nigerian Pidgin — money and payment terms

| Term                     | Example we imagined (please correct)    | Keep? | Your correction / synonyms to add |
| ------------------------ | --------------------------------------- | ----- | --------------------------------- |
| my money                 | "I never see my money since yesterday." |       |                                   |
| our money                | "Dem never send our money."             |       |                                   |
| money no enter           | "I do the transfer but money no enter." |       |                                   |
| e no enter               | "I pay am but e no enter."              |       |                                   |
| no enter my account      | "The refund no enter my account."       |       |                                   |
| money don go             | "My money don go just like that."       |       |                                   |
| money don disappear      | "My balance money don disappear."       |       |                                   |
| dem charge me            | "Dem charge me twice for one trip."     |       |                                   |
| dem don charge me        | "Dem don charge me but I no order."     |       |                                   |
| dem collect my money     | "Dem collect my money and cancel."      |       |                                   |
| dem take my money        | "Dem take my money no service."         |       |                                   |
| dem debit me             | "Dem debit me two times."               |       |                                   |
| dem don debit me         | "Dem don debit me but order fail."      |       |                                   |
| dem thief my money       | "Dem thief my money for wallet."        |       |                                   |
| dem tief my money        | "Dem tief my money."                    |       |                                   |
| dem no pay me            | "I don finish work, dem no pay me."     |       |                                   |
| dem never pay me         | "Dem never pay me since last week."     |       |                                   |
| i never receive          | "I never receive my payout."            |       |                                   |
| i no receive             | "I no receive the refund."              |       |                                   |
| i no see my money        | "I no see my money for account."        |       |                                   |
| e remove my money        | "E remove my money without notice."     |       |                                   |
| wetin happen to my money | "Abeg wetin happen to my money?"        |       |                                   |
| where my money           | "Where my money since Monday?"          |       |                                   |
| give me my money         | "Abeg give me my money."                |       |                                   |
| return my money          | "Make dem return my money."             |       |                                   |
| pay me my money          | "Pay me my money abeg."                 |       |                                   |

# Nigerian Pidgin — safety terms

| Term                   | Example we imagined (please correct)     | Keep? | Your correction / synonyms to add |
| ---------------------- | ---------------------------------------- | ----- | --------------------------------- |
| dem wan kill me        | "Dem wan kill me inside the car."        |       |                                   |
| dem wan harm me        | "Dem wan harm me."                       |       |                                   |
| dem beat me            | "The driver and him friend dem beat me." |       |                                   |
| e beat me              | "E beat me for road."                    |       |                                   |
| i dey fear             | "I dey fear, e no dey stop."             |       |                                   |
| i dey fear for my life | "I dey fear for my life."                |       |                                   |
| e dey threaten me      | "E dey threaten me since."               |       |                                   |
| dem threaten me        | "Dem threaten me for phone."             |       |                                   |
| e wound me             | "E wound me for hand."                   |       |                                   |
| i wound                | "I wound during the accident."           |       |                                   |
| na wa o                | (see flag 2)                             |       |                                   |
| dem carry me go        | "Dem carry me go another place."         |       |                                   |
| dem lock me            | "Dem lock me inside."                    |       |                                   |
| e no gree stop         | "I tell am make e stop, e no gree stop." |       |                                   |
| e no gree make i comot | "E no gree make i comot for car."        |       |                                   |
| make i comot           | (see flag 7)                             |       |                                   |
| i wan comot            | (see flag 7)                             |       |                                   |
| help me abeg           | (see flag 1)                             |       |                                   |
| abeg help              | (see flag 1)                             |       |                                   |
| e dey chase me         | "E dey chase me for street."             |       |                                   |
| dem dey follow me      | "Dem dey follow me since I comot."       |       |                                   |

---

# What we most need you to add

The list above is what we guessed. These are the situations it has to cover.
For each one, please write how people **actually** say it — in Hausa and in
Pidgin, the way it would be typed into a phone, including short and angry
versions:

1. Money taken without permission
2. Payment missing, or the wrong amount
3. Money removed from a wallet
4. Stolen funds
5. Fraud or a scam
6. Someone threatening them
7. Being assaulted
8. Being in danger right now
9. An emergency
10. A road accident
11. Harassment
12. Being forced or coerced into something

Short forms matter most. Someone in trouble does not write full sentences.

# Deliberately excluded, and why

So you can tell a gap from a decision:

- **Bare "help" in English** — every support message contains it.
- **Bare "account"** — "delete my account" is an account matter, not money.
- **Bare "order", "late", "driver"** — ordinary complaints, not money or safety.
- **Very common grammatical words in Hausa and Pidgin** (_na_, _ba_, _dey_,
  _don_, _make_) — they carry no meaning on their own, which is why most Pidgin
  entries are whole phrases rather than single words.
- **Rude or abusive words on their own** — someone swearing is angry, which is
  not the same as being in danger. Tell us if you disagree; anger and fear are
  not always easy to separate in writing.

# A note on getting it wrong in each direction

If this list is **too broad**, some ordinary questions reach a human who did not
need to be involved. That costs time.

If this list is **too narrow**, someone's stolen money or their emergency is
handled as routine. That costs something we cannot get back.

So when you are unsure about a term, **keep it**. We would rather be wrong in
the first direction. The only thing we ask you not to do is leave something out
because it seemed unlikely.

---

# Reviewer sign-off

Gate 1 is not closed until this is filled in.

|                                      |     |
| ------------------------------------ | --- |
| Hausa reviewer (name)                |     |
| First language / where they are from |     |
| Date reviewed                        |     |
| Hausa list confirmed adequate?       |     |
| Pidgin reviewer (name)               |     |
| First language / where they are from |     |
| Date reviewed                        |     |
| Pidgin list confirmed adequate?      |     |
| Terms added                          |     |
| Terms removed                        |     |
| Outstanding concerns                 |     |

Once returned, the corrections go into
`apps/backend/src/support/safety/support-safety-lexicon.ts`, each change gets a
test, and this document records who confirmed it.
