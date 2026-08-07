import { describe, expect, it } from 'vitest';

import { customerRegistrationSchema, merchantRegistrationSchema } from './auth.js';

describe('customerRegistrationSchema', () => {
  const base = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    password: 'Password1',
  };

  it('accepts email only', () => {
    const result = customerRegistrationSchema.safeParse({ ...base, email: 'ada@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts phone only', () => {
    const result = customerRegistrationSchema.safeParse({ ...base, phone: '+2348012345678' });
    expect(result.success).toBe(true);
  });

  it('accepts both email and phone', () => {
    const result = customerRegistrationSchema.safeParse({
      ...base,
      email: 'ada@example.com',
      phone: '+2348012345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects neither email nor phone', () => {
    const result = customerRegistrationSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});

describe('merchantRegistrationSchema', () => {
  const base = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    password: 'Password1',
  };

  it('accepts phone only', () => {
    const result = merchantRegistrationSchema.safeParse({ ...base, phone: '+2348012345678' });
    expect(result.success).toBe(true);
  });

  it('rejects neither email nor phone', () => {
    const result = merchantRegistrationSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});
