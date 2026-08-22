import {
  BOOKING_PIN_LENGTH,
  bookingPinsMatch,
  generateBookingPin,
  isBookingPinShaped,
  normalizeBookingPin,
} from './booking-pin';

describe('booking PIN', () => {
  it('is five characters, as the founder specified', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateBookingPin()).toHaveLength(BOOKING_PIN_LENGTH);
    }
  });

  /**
   * The whole reason the alphabet is restricted. A guest reads this aloud in a
   * lobby and a receptionist types what they heard; 0/O, 1/I/L and 5/S are the
   * pairs that go wrong, every time.
   */
  it('never contains a character that is misread when spoken', () => {
    const forbidden = ['0', 'O', '1', 'I', 'L', '5', 'S'];
    for (let i = 0; i < 500; i += 1) {
      const pin = generateBookingPin();
      for (const character of forbidden) {
        expect(pin).not.toContain(character);
      }
    }
  });

  it('is uppercase alphanumeric and nothing else', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateBookingPin()).toMatch(/^[A-Z0-9]{5}$/);
    }
  });

  /** Not proof of randomness — a guard against a generator that returns a
   *  constant, which would hand every guest the same code. */
  it('does not hand out the same code every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(generateBookingPin());
    expect(seen.size).toBeGreaterThan(150);
  });

  describe('matching what the desk typed', () => {
    it('ignores case, because nobody reads case aloud', () => {
      expect(bookingPinsMatch('B7X9K', 'b7x9k')).toBe(true);
    });

    it('ignores spaces, rather than turning a real guest away over one', () => {
      expect(bookingPinsMatch('B7X9K', 'B7 X9K')).toBe(true);
      expect(bookingPinsMatch('B7X9K', ' b7x9k ')).toBe(true);
    });

    it('still refuses a code that is actually different', () => {
      expect(bookingPinsMatch('B7X9K', 'B7X9J')).toBe(false);
      expect(bookingPinsMatch('B7X9K', '')).toBe(false);
    });
  });

  describe('isBookingPinShaped', () => {
    it('accepts a generated PIN, in any case', () => {
      const pin = generateBookingPin();
      expect(isBookingPinShaped(pin)).toBe(true);
      expect(isBookingPinShaped(pin.toLowerCase())).toBe(true);
    });

    it('refuses the wrong length', () => {
      expect(isBookingPinShaped('B7X9')).toBe(false);
      expect(isBookingPinShaped('B7X9KK')).toBe(false);
    });

    it('refuses the characters deliberately left out of the alphabet', () => {
      expect(isBookingPinShaped('B7X9O')).toBe(false);
      expect(isBookingPinShaped('B7X91')).toBe(false);
      expect(isBookingPinShaped('B7X9S')).toBe(false);
    });
  });

  it('normalizes the way both callers expect', () => {
    expect(normalizeBookingPin(' b7 x9k ')).toBe('B7X9K');
  });
});
