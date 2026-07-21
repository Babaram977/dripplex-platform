import { PAYMENT_AUDIT_ACTIONS, PAYMENT_PERMISSIONS } from './payment.constants';

describe('payment constants', () => {
  it('defines audit actions', () => {
    expect(PAYMENT_AUDIT_ACTIONS.INITIALIZED).toBe('payment.initialized');
    expect(PAYMENT_AUDIT_ACTIONS.VERIFIED).toBe('payment.verified');
    expect(PAYMENT_AUDIT_ACTIONS.FAILED).toBe('payment.failed');
    expect(PAYMENT_AUDIT_ACTIONS.WEBHOOK_RECEIVED).toBe('payment.webhook.received');
    expect(PAYMENT_AUDIT_ACTIONS.WEBHOOK_REJECTED).toBe('payment.webhook.rejected');
  });

  it('reuses customer:orders for payment endpoints', () => {
    expect(PAYMENT_PERMISSIONS.PAY).toBe('customer:orders');
  });
});
