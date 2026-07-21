import { BusinessType, KycDocumentType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RejectMerchantDto } from './admin-actions.dto';
import { CreateBankAccountDto } from './create-bank-account.dto';
import { CreateBusinessDto } from './create-business.dto';
import { ListMerchantsQueryDto } from './list-merchants-query.dto';
import { SubmitKycDto } from './submit-kyc.dto';

describe('Merchant DTO validation', () => {
  it('accepts a valid create business payload', async () => {
    const dto = plainToInstance(CreateBusinessDto, {
      businessName: 'Ada Foods',
      businessType: BusinessType.SOLE_PROPRIETORSHIP,
      registrationNumber: 'RC123456',
      email: 'biz@dripplex.test',
      phone: '+2348012345678',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Ikeja',
      address: '12 Allen Avenue',
      latitude: '6.6018',
      longitude: '3.3515',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.latitude).toBeCloseTo(6.6018);
  });

  it('rejects short business names', async () => {
    const dto = plainToInstance(CreateBusinessDto, {
      businessName: 'Ab',
      businessType: BusinessType.OTHER,
      registrationNumber: 'RC1',
      email: 'biz@dripplex.test',
      phone: '+2348012345678',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Ikeja',
      address: '12 Allen Avenue',
      latitude: 6.6,
      longitude: 3.3,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'businessName')).toBe(true);
  });

  it('rejects out-of-range coordinates', async () => {
    const dto = plainToInstance(CreateBusinessDto, {
      businessName: 'Ada Foods',
      businessType: BusinessType.OTHER,
      registrationNumber: 'RC123',
      email: 'biz@dripplex.test',
      phone: '+2348012345678',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Ikeja',
      address: '12 Allen Avenue',
      latitude: 95,
      longitude: 3.3,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('validates KYC document type', async () => {
    const dto = plainToInstance(SubmitKycDto, {
      documentType: KycDocumentType.NATIONAL_ID,
      documentNumber: 'NIN123456',
      frontImage: 'https://cdn.example/front.jpg',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects short bank account numbers', async () => {
    const dto = plainToInstance(CreateBankAccountDto, {
      bankName: 'Access',
      accountName: 'Ada',
      accountNumber: '123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'accountNumber')).toBe(true);
  });

  it('rejects non-digit bank account numbers', async () => {
    const dto = plainToInstance(CreateBankAccountDto, {
      bankName: 'Access',
      accountName: 'Ada',
      accountNumber: 'ABCDEFGHIJ',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'accountNumber')).toBe(true);
  });

  it('requires rejection reason', async () => {
    const dto = plainToInstance(RejectMerchantDto, { reason: 'no' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('parses list merchants pagination defaults', async () => {
    const dto = plainToInstance(ListMerchantsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });
});
