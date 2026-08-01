import { CANCELLABLE_RIDE_STATUSES, RIDE_PERMISSIONS } from './ride.constants';

describe('RIDE_PERMISSIONS', () => {
  it('defines the customer ride self-service permission', () => {
    expect(RIDE_PERMISSIONS.MANAGE).toBe('customer:ride:manage');
  });
});

describe('CANCELLABLE_RIDE_STATUSES', () => {
  it('allows cancellation before a trip is in progress', () => {
    expect(CANCELLABLE_RIDE_STATUSES).toEqual(
      expect.arrayContaining(['REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'ARRIVED']),
    );
  });

  it('does not allow cancellation once a trip is in progress or finished', () => {
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('IN_PROGRESS');
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('COMPLETED');
    expect(CANCELLABLE_RIDE_STATUSES).not.toContain('CANCELLED');
  });
});
