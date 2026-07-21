import { Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';

/** DPX-013 §3.1 password policy */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

/** Local denylist approximating common breached passwords (full HIBP deferred). */
const COMMON_PASSWORDS = new Set(
  [
    'password',
    'password1',
    'password123',
    '12345678',
    '123456789',
    'qwerty123',
    'letmein1',
    'welcome1',
    'admin123',
    'iloveyou1',
    'abc12345',
    'passw0rd',
    'changeme1',
    'dripplex1',
  ].map((value) => value.toLowerCase()),
);

export interface PasswordPolicyViolation {
  code: string;
  message: string;
}

@Injectable()
export class PasswordPolicyService {
  public assertValid(password: string): void {
    const violations = this.validate(password);
    if (violations.length > 0) {
      throw new ValidationDomainException('Password does not meet policy requirements', {
        violations,
      });
    }
  }

  public validate(password: string): PasswordPolicyViolation[] {
    const violations: PasswordPolicyViolation[] = [];

    if (password.length < PASSWORD_MIN_LENGTH) {
      violations.push({
        code: 'PASSWORD_TOO_SHORT',
        message: `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`,
      });
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      violations.push({
        code: 'PASSWORD_TOO_LONG',
        message: `Password must be at most ${String(PASSWORD_MAX_LENGTH)} characters`,
      });
    }

    if (!PASSWORD_COMPLEXITY.test(password)) {
      violations.push({
        code: 'PASSWORD_COMPLEXITY',
        message: 'Password must include upper, lower, and numeric characters',
      });
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      violations.push({
        code: 'PASSWORD_COMMON',
        message: 'Password is too common; choose a stronger password',
      });
    }

    return violations;
  }
}
