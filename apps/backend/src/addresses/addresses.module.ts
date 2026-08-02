import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigService } from '../config/app-config.service';
import { PrismaModule } from '../prisma/prisma.module';

import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { AdminAddressesController } from './admin-addresses.controller';
import { GoogleReverseGeocoder } from './geocoding/google-reverse-geocoder';
import { NotConfiguredReverseGeocoder } from './geocoding/not-configured-reverse-geocoder';
import { REVERSE_GEOCODER, type ReverseGeocoder } from './geocoding/reverse-geocoder';
import { ADDRESS_REPOSITORY } from './repositories/address.repository';
import { PrismaAddressRepository } from './repositories/prisma-address.repository';
import { DELIVERY_ZONE_SERVICE } from './zones/delivery-zone.service';
import { StubDeliveryZoneService } from './zones/stub-delivery-zone.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AddressController, AdminAddressesController],
  providers: [
    AddressService,
    {
      provide: ADDRESS_REPOSITORY,
      useClass: PrismaAddressRepository,
    },
    {
      provide: DELIVERY_ZONE_SERVICE,
      useClass: StubDeliveryZoneService,
    },
    {
      provide: REVERSE_GEOCODER,
      useFactory: (config: AppConfigService, google: GoogleReverseGeocoder): ReverseGeocoder =>
        config.googleMapsConfigured ? google : new NotConfiguredReverseGeocoder(),
      inject: [AppConfigService, GoogleReverseGeocoder],
    },
    GoogleReverseGeocoder,
  ],
  exports: [AddressService, ADDRESS_REPOSITORY, DELIVERY_ZONE_SERVICE, REVERSE_GEOCODER],
})
export class AddressesModule {}
