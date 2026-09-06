import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  ConflictDomainException,
  ForbiddenDomainException,
} from '../common/exceptions/domain.exception';

import { AuditService } from './audit.service';

/**
 * Audit Controller — Segment Closure Endpoint
 *
 * P1-B4: Segment Closure
 * Exposes the ability to close an ACTIVE segment and create its successor.
 *
 * Authorization:
 * 1. JwtAuthGuard: Requires authenticated principal
 * 2. PermissionsGuard: Requires audit_segment:close permission
 * 3. AuditService: Re-validates authorization and operation validity (final authority)
 *
 * All closure requests must be within a Serializable transaction (enforced by AuditService).
 */
@Controller('audit/segments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Close an ACTIVE audit segment.
   *
   * POST /audit/segments/{segmentId}/close
   *
   * Request body:
   * {
   *   "closureReason": "governance reason (e.g., 'scheduled rotation', 'manual authorization')"
   * }
   *
   * Response (200 OK):
   * {
   *   "segmentId": "uuid-of-closed-segment",
   *   "closedAt": "ISO8601 timestamp",
   *   "successorSegmentId": "uuid-of-new-active-segment"
   * }
   *
   * Errors:
   * - 401: Not authenticated
   * - 403: Missing audit_segment:close permission
   * - 400: Invalid segmentId or closureReason format
   * - 409: Segment not ACTIVE, or closure reason conflicts with previous closure
   * - 500: Transaction failure (rollback on any step failure)
   *
   * @param segmentId - UUID of the segment to close
   * @param body - { closureReason: string }
   * @param user - Authenticated user (injected by AuthGuard)
   * @returns ClosureResult with segmentId, closedAt, successorSegmentId
   */
  @Post(':segmentId/close')
  @RequirePermissions('audit_segment:close')
  public async closeSegment(
    @Param('segmentId') segmentId: string,
    @Body() body: { closureReason: string },
  ): Promise<{ segmentId: string; closedAt: string; successorSegmentId: string }> {
    // Validate request
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.exec(segmentId)
    ) {
      throw new ForbiddenDomainException('Invalid segmentId format (must be UUID)');
    }

    if (
      !body.closureReason ||
      typeof body.closureReason !== 'string' ||
      body.closureReason.trim().length === 0
    ) {
      throw new ForbiddenDomainException(
        'closureReason is required and must be a non-empty string',
      );
    }

    const closureReason = body.closureReason.trim();

    // Service re-validates authorization and executes closure atomically
    try {
      const result = await this.auditService.closeActiveSegment(segmentId, closureReason);

      return {
        segmentId: result.segmentId,
        closedAt: result.closedAt.toISOString(),
        successorSegmentId: result.successorSegmentId,
      };
    } catch (error) {
      // Convert service errors to HTTP responses
      if (error instanceof Error) {
        const message = error.message || '';

        if (message.includes('not found') || message.includes('does not exist')) {
          throw new ForbiddenDomainException(`Segment not found or not ACTIVE: ${message}`);
        }

        if (message.includes('not ACTIVE') || message.includes('lifecycle')) {
          throw new ConflictDomainException(`Segment closure failed: ${message}`);
        }

        if (message.includes('conflicts') || message.includes('already closed')) {
          throw new ConflictDomainException(
            `Segment already closed with different reason. Operation rejected.`,
          );
        }
      }

      throw error;
    }
  }
}
