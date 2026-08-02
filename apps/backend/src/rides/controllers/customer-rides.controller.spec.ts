import { RideType } from '@prisma/client';

import { CustomerRidesController } from './customer-rides.controller';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { RidePaymentService } from '../ride-payment.service';
import type { RideProblemReportService } from '../ride-problem-report.service';
import type { RideRatingService } from '../ride-rating.service';
import type { RideReceiptService } from '../ride-receipt.service';
import type { RidesService } from '../rides.service';

describe('CustomerRidesController — estimateFare', () => {
  it('delegates to RidesService.estimateFare() and returns it wrapped', async () => {
    const estimate = {
      distanceMeters: 1200,
      durationSeconds: 300,
      baseFare: 300,
      distanceFare: 144,
      timeFare: 100,
      totalFare: 544,
      promotionId: null,
      promoDiscount: 0,
      finalFare: 544,
    };
    const ridesService = {
      estimateFare: jest.fn().mockResolvedValue(estimate),
    } as unknown as RidesService;

    const controller = new CustomerRidesController(
      ridesService,
      {} as RidePaymentService,
      {} as RideRatingService,
      {} as RideReceiptService,
      {} as RideProblemReportService,
    );

    const user = { id: 'customer-1' } as AuthenticatedUser;
    const result = await controller.estimateFare(user, {
      rideType: RideType.ECONOMY,
      pickupLatitude: 6.6018,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.62,
      dropoffLongitude: 3.36,
    });

    expect(result).toEqual({ success: true, data: estimate });
    expect(ridesService.estimateFare).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({ rideType: RideType.ECONOMY }),
    );
  });
});
