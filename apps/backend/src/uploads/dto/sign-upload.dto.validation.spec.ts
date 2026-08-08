import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UPLOAD_MAX_BYTES } from '../uploads.constants';

import { SignUploadDto } from './sign-upload.dto';

/**
 * DPX-STORAGE-001 (C) — API-boundary security validation for signed uploads:
 * only allow-listed content types and folders, and a required, capped byte
 * length (which is then bound into the signature).
 */
describe('SignUploadDto validation', () => {
  const valid = {
    contentType: 'application/pdf',
    folder: 'kyc-documents',
    contentLength: 1024,
  };

  it('accepts an allow-listed content type, folder, and in-range length', async () => {
    const errors = await validate(plainToInstance(SignUploadDto, valid));
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-allow-listed content type', async () => {
    const errors = await validate(
      plainToInstance(SignUploadDto, { ...valid, contentType: 'application/zip' }),
    );
    expect(errors.some((e) => e.property === 'contentType')).toBe(true);
  });

  it('rejects an arbitrary folder outside the allow-list', async () => {
    const errors = await validate(plainToInstance(SignUploadDto, { ...valid, folder: 'secrets' }));
    expect(errors.some((e) => e.property === 'folder')).toBe(true);
  });

  it('requires contentLength (no longer optional)', async () => {
    const { contentLength: _omitted, ...withoutLength } = valid;
    const errors = await validate(plainToInstance(SignUploadDto, withoutLength));
    expect(errors.some((e) => e.property === 'contentLength')).toBe(true);
  });

  it('rejects an oversized contentLength', async () => {
    const errors = await validate(
      plainToInstance(SignUploadDto, { ...valid, contentLength: UPLOAD_MAX_BYTES + 1 }),
    );
    expect(errors.some((e) => e.property === 'contentLength')).toBe(true);
  });

  it('rejects a zero/negative contentLength', async () => {
    const errors = await validate(plainToInstance(SignUploadDto, { ...valid, contentLength: 0 }));
    expect(errors.some((e) => e.property === 'contentLength')).toBe(true);
  });
});
