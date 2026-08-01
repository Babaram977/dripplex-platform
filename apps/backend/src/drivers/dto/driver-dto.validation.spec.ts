import { KycDocumentType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RejectDriverDto, RejectDriverKycDto, SuspendDriverDto } from './admin-driver-actions.dto';
import { SubmitDriverKycDto } from './submit-driver-kyc.dto';

describe('Driver DTO validation', () => {
  it('accepts a valid KYC submission', async () => {
    const dto = plainToInstance(SubmitDriverKycDto, {
      documentType: KycDocumentType.VEHICLE_REGISTRATION,
      documentNumber: 'VR-1234',
      frontImage: 'https://example.com/vehicle-reg.jpg',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a KYC submission with an unknown document type', async () => {
    const dto = plainToInstance(SubmitDriverKycDto, {
      documentType: 'NOT_A_REAL_TYPE',
      documentNumber: 'X1',
      frontImage: 'https://example.com/x.jpg',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'documentType')).toBe(true);
  });

  it('rejects a reject-driver reason shorter than 5 characters', async () => {
    const dto = plainToInstance(RejectDriverDto, { reason: 'no' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts a valid suspend-driver reason', async () => {
    const dto = plainToInstance(SuspendDriverDto, { reason: 'Multiple customer complaints' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires remarks when rejecting a KYC document', async () => {
    const dto = plainToInstance(RejectDriverKycDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'remarks')).toBe(true);
  });
});
