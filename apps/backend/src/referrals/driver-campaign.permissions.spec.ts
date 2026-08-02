import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminDriverCampaignController } from './admin-driver-campaign.controller';
import { DRIVER_CAMPAIGN_PERMISSIONS } from './driver-campaign.constants';
import { DriverCampaignController } from './driver-campaign.controller';

describe('DRIVER_CAMPAIGN_PERMISSIONS', () => {
  it('defines requested driver campaign permissions', () => {
    expect(DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE).toBe('driver:referral_campaign:use');
    expect(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE).toBe('admin:referral_campaigns:manage');
  });

  it('protects the driver code endpoint', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DriverCampaignController.prototype.getMyCode),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE]);
  });

  it('protects the driver dashboard endpoint', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DriverCampaignController.prototype.getDashboard),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE]);
  });

  it('protects the driver leaderboard endpoint', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DriverCampaignController.prototype.getLeaderboard),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE]);
  });

  it('protects admin campaign creation', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminDriverCampaignController.prototype.create),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE]);
  });

  it('protects admin reward approval', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminDriverCampaignController.prototype.approveReward),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE]);
  });

  it('protects admin reward payment', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminDriverCampaignController.prototype.payReward),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE]);
  });

  it('protects admin fraud check review', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminDriverCampaignController.prototype.reviewFraudCheck,
      ),
    ).toEqual([DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE]);
  });
});
