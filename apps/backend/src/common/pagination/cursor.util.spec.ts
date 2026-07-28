import { decodeCursorOffset, encodeCursor } from './cursor.util';

describe('cursor.util', () => {
  it('round-trips an offset for a given sort', () => {
    const cursor = encodeCursor('newest', 40);
    expect(decodeCursorOffset(cursor, 'newest')).toBe(40);
  });

  it('resets to zero when no cursor is given', () => {
    expect(decodeCursorOffset(undefined, 'newest')).toBe(0);
  });

  it('resets to zero when the sort mode changed since the cursor was issued', () => {
    const cursor = encodeCursor('newest', 40);
    expect(decodeCursorOffset(cursor, 'price_asc')).toBe(0);
  });

  it('resets to zero for a malformed cursor', () => {
    expect(decodeCursorOffset('not-a-real-cursor', 'newest')).toBe(0);
    expect(decodeCursorOffset(Buffer.from('{}').toString('base64url'), 'newest')).toBe(0);
    expect(
      decodeCursorOffset(
        Buffer.from(JSON.stringify({ sort: 'newest', offset: -5 })).toString('base64url'),
        'newest',
      ),
    ).toBe(0);
  });

  it('produces an opaque, URL-safe token', () => {
    const cursor = encodeCursor('rating_desc', 100);
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
    expect(cursor).not.toContain('=');
  });
});
