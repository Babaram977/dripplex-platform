import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { AdminAddressesController } from './admin-addresses.controller';
import { NotConfiguredReverseGeocoder } from './geocoding/not-configured-reverse-geocoder';
import { REVERSE_GEOCODER } from './geocoding/reverse-geocoder';
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
      useClass: NotConfiguredReverseGeocoder,
    },
  ],
  exports: [AddressService, DELIVERY_ZONE_SERVICE, REVERSE_GEOCODER],
})
export class AddressesModule {}
