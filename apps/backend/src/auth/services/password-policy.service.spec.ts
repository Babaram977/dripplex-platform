import { ValidationDomainException } from '../../common/exceptions/domain.exception';

import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const service = new PasswordPolicyService();

  it('accepts a strong password', () => {
    expect(service.validate('SecurePass1')).toEqual([]);
  });

  it('rejects short passwords', () => {
    expect(service.validate('Ab1')).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PASSWORD_TOO_SHORT' })]),
    );
  });

  it('rejects passwords missing complexity', () => {
    expect(service.validate('alllowercase1')).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PASSWORD_COMPLEXITY' })]),
    );
  });

  it('rejects common passwords', () => {
    expect(service.validate('Password1')).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PASSWORD_COMMON' })]),
    );
  });

  it('throws ValidationDomainException via assertValid', () => {
    expect(() => {
      service.assertValid('weak');
    }).toThrow(ValidationDomainException);
  });

  it('rejects passwords longer than 128 characters', () => {
    const longPassword = `Aa1${'x'.repeat(130)}`;
    expect(service.validate(longPassword)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PASSWORD_TOO_LONG' })]),
    );
  });
});
