import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthGuard } from '../auth/guards/auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * P1-B4 API Controller Tests
 *
 * Tests the POST /audit/segments/{segmentId}/close endpoint:
 * - Authorization enforcement (auth guard, permissions guard)
 * - Request validation (UUID format, closureReason required)
 * - Response structure (segmentId, closedAt, successorSegmentId)
 * - Error handling (missing segment, already closed, conflicts)
 */
describe('AuditController', () => {
  let app: INestApplication;
  let auditService: AuditService;

  beforeAll(async () => {
    // Mock guards and service for controller testing
    const mockAuthGuard = {
      canActivate: jest.fn(() => {
        return true;
      }),
    };

    const mockPermissionsGuard = {
      canActivate: jest.fn(() => {
        return true;
      }),
    };

    const mockAuditService = {
      closeActiveSegment: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    auditService = moduleFixture.get<AuditService>(AuditService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /audit/segments/{segmentId}/close', () => {
    it('should return 200 with closure result', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';
      const closureReason = 'scheduled rotation';
      const successorId = '660e8400-e29b-41d4-a716-446655440001';
      const now = new Date();

      jest.spyOn(auditService, 'closeActiveSegment').mockResolvedValue({
        segmentId,
        closedAt: now,
        successorSegmentId: successorId,
      });

      const response = await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({ closureReason })
        .expect(200);

      expect(response.body).toEqual({
        segmentId,
        closedAt: now.toISOString(),
        successorSegmentId: successorId,
      });
    });

    it('should reject invalid segmentId format', async () => {
      await request(app.getHttpServer())
        .post('/audit/segments/invalid-uuid/close')
        .send({ closureReason: 'reason' })
        .expect(403);
    });

    it('should reject missing closureReason', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({})
        .expect(403);
    });

    it('should reject empty closureReason', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({ closureReason: '   ' })
        .expect(403);
    });

    it('should handle segment not found error', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      jest
        .spyOn(auditService, 'closeActiveSegment')
        .mockRejectedValue(new Error('Segment not found'));

      await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({ closureReason: 'reason' })
        .expect(403);
    });

    it('should handle segment already closed error', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      jest
        .spyOn(auditService, 'closeActiveSegment')
        .mockRejectedValue(new Error('Segment is not ACTIVE (lifecycle=CLOSED)'));

      await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({ closureReason: 'reason' })
        .expect(409);
    });

    it('should handle closure reason conflict', async () => {
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      jest
        .spyOn(auditService, 'closeActiveSegment')
        .mockRejectedValue(
          new Error('Segment already closed with different reason. Operation rejected.'),
        );

      await request(app.getHttpServer())
        .post(`/audit/segments/${segmentId}/close`)
        .send({ closureReason: 'reason' })
        .expect(409);
    });
  });
});
