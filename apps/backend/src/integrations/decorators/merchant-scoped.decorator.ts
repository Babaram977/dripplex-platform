import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Extract and validate merchantId from authenticated user context.
 *
 * Usage:
 * ```typescript
 * @Get()
 * async list(@MerchantScoped() merchantId: string) {
 *   return this.service.list(merchantId);
 * }
 * ```
 *
 * This decorator:
 * 1. Requires JwtAuthGuard to have already authenticated the user
 * 2. Extracts merchantId from user context (to be implemented: merchant_id in JWT)
 * 3. Throws if merchantId is missing
 * 4. Is NOT a substitute for authorization checks — that's the service's job
 */
export const MerchantScoped = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new BadRequestException('Authentication required');
    }

    // For now, use user.id as merchantId (customer/driver serves as merchant)
    // In a multi-tenant scenario with distinct merchants, extract from JWT payload
    // Example: const merchantId = user.merchantId;
    const merchantId = user.id;

    if (!merchantId) {
      throw new BadRequestException('Merchant ID not found in request context');
    }

    return merchantId;
  },
);
