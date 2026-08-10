import { RIDER_PERMISSIONS } from './rider.constants';

describe('RIDER_PERMISSIONS', () => {
  it('mirrors the admin:riders:* permission family granted in seed-rbac', () => {
    expect(RIDER_PERMISSIONS).toEqual({
      REVIEW: 'admin:riders:review',
      APPROVE: 'admin:riders:approve',
      REJECT: 'admin:riders:reject',
      SUSPEND: 'admin:riders:suspend',
      REACTIVATE: 'admin:riders:reactivate',
    });
  });
});
