'use client';

import { changePasswordSchema, type ChangePasswordFormValues } from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { useChangePassword } from '@/hooks/use-change-password';

export function ChangePasswordForm(): React.JSX.Element {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = handleSubmit((values) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        toast({ title: 'Password changed' });
        reset();
      },
      onError: () => {
        toast({
          title: "Couldn't change password",
          description: 'Check your current password and try again.',
          variant: 'destructive',
        });
      },
    });
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.currentPassword)}
          {...register('currentPassword')}
        />
        {errors.currentPassword ? (
          <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          {...register('newPassword')}
        />
        {errors.newPassword ? (
          <p className="text-destructive text-sm">{errors.newPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}
