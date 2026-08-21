/**
 * Splitting one "Full Name" box into the firstName/lastName the backend wants.
 *
 * `PATCH /auth/me` takes the two separately, but showing a customer two boxes
 * for something they think of as one thing is worse than splitting it here.
 *
 * The rule: everything before the first run of whitespace is the first name,
 * everything after it is the surname. "Abdullahi Musa" → Abdullahi / Musa.
 * "Lawan Sadiq Bello" → Lawan / "Sadiq Bello", because a middle name belongs
 * with the surname rather than being silently dropped. A single word gives a
 * first name and no surname, which is what the backend's optional lastName is
 * for — a one-name customer is not an error.
 */
export interface SplitName {
  firstName: string;
  lastName?: string;
}

export function splitFullName(input: string): SplitName | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? trimmed;
  const lastName = parts.slice(1).join(' ');

  return lastName === '' ? { firstName } : { firstName, lastName };
}
