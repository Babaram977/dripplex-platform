'use client';

import { useMutation } from '@tanstack/react-query';

import type { ChangePasswordFormValues, ChangePasswordResponse } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useChangePassword(): UseMutationResult<
  ChangePasswordResponse,
  Error,
  ChangePasswordFormValues
> {
  return useMutation({
    mutationFn: (body: ChangePasswordFormValues) => sdk.auth.changePassword(body),
  });
}
