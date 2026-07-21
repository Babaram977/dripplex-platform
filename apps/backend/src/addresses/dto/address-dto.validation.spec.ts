import { AddressLabel } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAddressDto } from './create-address.dto';
import { UpdateAddressDto } from './update-address.dto';

describe('Address DTO validation', () => {
  it('accepts a valid create address payload', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: AddressLabel.HOME,
      recipientName: 'Ada Customer',
      phone: '+2348012345678',
      addressLine1: '12 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      latitude: '6.6018',
      longitude: '3.3515',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.latitude).toBeCloseTo(6.6018);
  });

  it('requires recipient name and address line', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: AddressLabel.WORK,
      recipientName: '',
      phone: '+2348012345678',
      addressLine1: 'ab',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      latitude: 6.6,
      longitude: 3.3,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'recipientName')).toBe(true);
    expect(errors.some((e) => e.property === 'addressLine1')).toBe(true);
  });

  it('requires city and state', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: AddressLabel.OTHER,
      recipientName: 'Ada',
      phone: '+2348012345678',
      addressLine1: '12 Allen Avenue',
      city: '',
      state: '',
      country: 'Nigeria',
      latitude: 6.6,
      longitude: 3.3,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'city')).toBe(true);
    expect(errors.some((e) => e.property === 'state')).toBe(true);
  });

  it('validates phone format', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: AddressLabel.HOME,
      recipientName: 'Ada',
      phone: 'not-a-phone',
      addressLine1: '12 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      latitude: 6.6,
      longitude: 3.3,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects out-of-range coordinates', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: AddressLabel.HOME,
      recipientName: 'Ada',
      phone: '+2348012345678',
      addressLine1: '12 Allen Avenue',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
      latitude: 95,
      longitude: 200,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('allows partial update payloads', async () => {
    const dto = plainToInstance(UpdateAddressDto, { city: 'Yaba' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
