import { RideType } from '@prisma/client';

import { RideFareService } from '../ride-fare.service';

import { CustomerRidesController } from './customer-rides.controller';

import type { RidePaymentService } from '../ride-payment.service';
import type { RideProblemReportService } from '../ride-problem-report.service';
import type { RideRatingService } from '../ride-rating.service';
import type { RideReceiptService } from '../ride-receipt.service';
import type { RidesService } from '../rides.service';

describe('CustomerRidesController — estimateFare', () => {
  it('reuses RideFareService.estimate() and returns it wrapped, without persisting anything', () => {
    const controller = new CustomerRidesController(
      {} as RidesService,
      {} as RidePaymentService,
      {} as RideRatingService,
      {} as RideReceiptService,
      {} as RideProblemReportService,
      new RideFareService(),
    );

    const result = controller.estimateFare({
      rideType: RideType.ECONOMY,
      pickupLatitude: 6.6018,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.62,
      dropoffLongitude: 3.36,
    });

    expect(result.success).toBe(true);
    expect(result.data.totalFare).toBe(
      result.data.baseFare + result.data.distanceFare + result.data.timeFare,
    );
    expect(result.data.distanceMeters).toBeGreaterThan(0);
  });
});
