import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
