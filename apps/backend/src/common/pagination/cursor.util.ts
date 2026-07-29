interface DecodedCursor {
  sort: string;
  offset: number;
}

/**
 * Opaque cursor: base64url-encoded {sort, offset}. Offset-backed rather than
 * true keyset pagination — simple and correct for catalog sizes at this
 * stage, upgradeable later without an API shape change since the token is
 * opaque to clients. See docs/reality-stage/R1.3-*.md for the trade-off.
 */
export function encodeCursor(sort: string, offset: number): string {
  return Buffer.from(JSON.stringify({ sort, offset } satisfies DecodedCursor), 'utf8').toString(
    'base64url',
  );
}

export function decodeCursorOffset(cursor: string | undefined, expectedSort: string): number {
  if (!cursor) {
    return 0;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sort' in parsed &&
      'offset' in parsed &&
      (parsed as DecodedCursor).sort === expectedSort &&
      typeof (parsed as DecodedCursor).offset === 'number' &&
      (parsed as DecodedCursor).offset >= 0
    ) {
      return (parsed as DecodedCursor).offset;
    }
    return 0;
  } catch {
    return 0;
  }
}
