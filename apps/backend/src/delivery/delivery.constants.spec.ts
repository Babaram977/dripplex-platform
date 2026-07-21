import { DELIVERY_AUDIT_ACTIONS, DELIVERY_PERMISSIONS } from './delivery.constants';

describe('delivery constants', () => {
  it('defines delivery permissions', () => {
    expect(DELIVERY_PERMISSIONS.CUSTOMER_READ).toBe('customer:delivery:read');
    expect(DELIVERY_PERMISSIONS.RIDER_MANAGE).toBe('rider:delivery:manage');
    expect(DELIVERY_PERMISSIONS.ADMIN_MANAGE).toBe('admin:delivery:manage');
  });

  it('defines audit action strings', () => {
    expect(DELIVERY_AUDIT_ACTIONS.ASSIGNED).toBe('delivery.assigned');
    expect(DELIVERY_AUDIT_ACTIONS.ACCEPTED).toBe('delivery.accepted');
    expect(DELIVERY_AUDIT_ACTIONS.PICKED_UP).toBe('delivery.picked_up');
    expect(DELIVERY_AUDIT_ACTIONS.ARRIVED).toBe('delivery.arrived');
    expect(DELIVERY_AUDIT_ACTIONS.COMPLETED).toBe('delivery.completed');
    expect(DELIVERY_AUDIT_ACTIONS.CANCELLED).toBe('delivery.cancelled');
    expect(DELIVERY_AUDIT_ACTIONS.RETURNED).toBe('delivery.returned');
    expect(DELIVERY_AUDIT_ACTIONS.FAILED).toBe('delivery.failed');
    expect(DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED).toBe('delivery.location_updated');
    expect(DELIVERY_AUDIT_ACTIONS.REJECTED).toBe('delivery.rejected');
  });
});
