import { ReviewStatus, ReviewTargetType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto, ReplyReviewDto, ReportReviewDto } from './dto/review-actions.dto';

describe('Review DTO validation', () => {
  it('accepts a valid review payload', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      rating: '5',
      comment: 'Great',
      photos: ['https://example.com/photo.jpg'],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.rating).toBe(5);
  });

  it('rejects ratings below one', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      rating: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('rejects ratings above five', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      rating: 6,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'rating')).toBe(true);
  });

  it('rejects invalid target types', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      targetType: 'STORE',
      targetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      rating: 5,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'targetType')).toBe(true);
  });

  it('validates report reasons', async () => {
    const dto = plainToInstance(ReportReviewDto, { reason: 'ab' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('validates merchant replies', async () => {
    const dto = plainToInstance(ReplyReviewDto, { reply: '' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'reply')).toBe(true);
  });

  it('accepts moderation statuses', async () => {
    const dto = plainToInstance(ModerateReviewDto, { status: ReviewStatus.APPROVED });
    expect(await validate(dto)).toHaveLength(0);
  });
});
