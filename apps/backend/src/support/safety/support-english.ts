/**
 * DPX-SUPPORT-002 §4 — "is this message confidently English?"
 *
 * Founder decision 2026-09-11: the gate is English only, and **a message that
 * is not confidently English goes to a human rather than being guessed at.**
 *
 * That second half is what makes the first half safe. Without it, English-only
 * would mean a Hausa speaker writing "An sace kudina" — my money was stolen —
 * getting no safety routing and being handed to automation. With it, the
 * platform's answer to a language it does not read is "a person will look at
 * this", which is the correct answer and an honest one.
 *
 * Deterministic, and no model involved. The test is not "which language is
 * this" — that is a hard problem and the wrong question. The question is only
 * "does this look like English the gate can be trusted on", and the answer is
 * allowed to be no.
 *
 * Biased toward "not English", like everything else here: saying no sends a
 * resolvable question to a person, saying yes wrongly lets automation near a
 * message nobody understood.
 */

/**
 * Words that mark a sentence as English.
 *
 * Function words carry the grammar and appear in almost any real English
 * sentence, so they are the bulk of this list. Nigerian Pidgin shares most of
 * them, which is deliberate and correct: Pidgin is read as English here, and its
 * money and safety vocabulary overlaps English closely enough that the main
 * lexicon catches it — "dem charge me" hits `charge`, "dem wan kill me" hits
 * `kill me`.
 *
 * The support nouns matter for short messages. "App crashes constantly" has no
 * function word in it at all, and is obviously English; without `app` it would
 * be sent to a human as unreadable.
 */
const ENGLISH_MARKERS: ReadonlySet<string> = new Set([
  // Function words.
  //
  // 'a', 'an' and 'in' are deliberately absent. Each is also a very common
  // Hausa word — "an" marks the perfective, "a" is a preposition, "in" means
  // "if" — so including them made "An sace kudina" read as English and skip the
  // deferral. Dropping them costs nothing measurable: an English sentence long
  // enough to be judged at all carries other markers ("I", "the", "my", "is"),
  // and the test below proves it.
  'the',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'mine',
  'we',
  'our',
  'us',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'it',
  'its',
  'is',
  'am',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'doing',
  'done',
  'have',
  'has',
  'had',
  'having',
  'can',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'to',
  'of',
  'on',
  'at',
  'by',
  'for',
  'with',
  'from',
  'into',
  'about',
  'and',
  'or',
  'but',
  'so',
  'if',
  'then',
  'than',
  'because',
  'when',
  'while',
  'not',
  'no',
  'yes',
  'never',
  'always',
  'still',
  'just',
  'also',
  'very',
  'what',
  'why',
  'how',
  'who',
  'which',
  'where',
  'there',
  'here',
  'now',
  'today',
  'yesterday',
  'again',
  'please',
  'thanks',
  'thank',
  'hello',
  'hi',
  'sorry',
  'get',
  'got',
  'give',
  'take',
  'want',
  'need',
  'see',
  'know',
  'go',
  'going',
  'make',
  'made',
  'use',
  'used',
  'try',
  'tried',
  'tell',
  'said',
  'say',

  // Support nouns and verbs, for short messages that carry no function word.
  'app',
  'application',
  'order',
  'orders',
  'ride',
  'rides',
  'trip',
  'trips',
  'driver',
  'rider',
  'merchant',
  'restaurant',
  'food',
  'delivery',
  'deliver',
  'account',
  'profile',
  'password',
  'login',
  'log',
  'signup',
  'phone',
  'number',
  'address',
  'location',
  'map',
  'time',
  'late',
  'early',
  'wrong',
  'missing',
  'cancel',
  'cancelled',
  'canceled',
  'problem',
  'issue',
  'error',
  'bug',
  'crash',
  'crashes',
  'crashed',
  'slow',
  'fix',
  'help',
  'support',
  'work',
  'working',
  'works',
  'open',
  'close',
  'update',
  'version',
  'screen',
  'page',
  'complaint',
  'question',
  'change',
  'update',
  'delete',
  'remove',
  'add',
]);

/**
 * Letters that do not occur in English.
 *
 * The Hausa hooked consonants are the decisive case — a message containing ɗ, ƙ
 * or ɓ is not English, whatever else is in it. Anything outside the basic Latin
 * range is caught by the script test below instead.
 */
const NON_ENGLISH_LETTERS = /[ɗƊƙƘɓƁƴƳ]/u;

/** Any letter outside basic Latin: Arabic, CJK, Cyrillic, Greek, and so on. */
const NON_LATIN_LETTER = /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{M}\p{S}\r\n]/u;

/**
 * Below this many words there is too little signal to judge, so the message is
 * treated as English and left to the lexicon. "Refund" and "help me" are one
 * and two words and both already match terms; calling them unreadable would
 * send half the short English tickets to a person for no reason.
 */
const MIN_WORDS_TO_JUDGE = 3;

/**
 * True when the gate should not be trusted to read this message.
 *
 * Takes the already-normalised text (lower-cased, punctuation flattened) plus
 * the raw text, because normalisation folds ɗ to d and the hooked letters are
 * evidence.
 */
export function isNotConfidentlyEnglish(raw: string, normalised: string): boolean {
  if (NON_ENGLISH_LETTERS.test(raw) || NON_LATIN_LETTER.test(raw)) {
    return true;
  }

  const words = normalised.split(' ').filter((word) => word.length > 0);
  if (words.length < MIN_WORDS_TO_JUDGE) {
    return false;
  }

  return !words.some((word) => ENGLISH_MARKERS.has(word));
}
