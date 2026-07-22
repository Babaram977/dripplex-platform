'use client';

import { registerSchema, type RegisterFormValues } from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { describeSdkError, sdk } from '@/lib/sdk';

export function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const phone = values.phone?.trim() ? values.phone.trim() : undefined;
      await sdk.auth.registerCustomer({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        ...(phone ? { phone } : {}),
      });
      toast({
        title: 'Account created',
        description: 'Check your email for a verification code to continue.',
      });
      const params = new URLSearchParams({ email: values.email });
      router.push(`/verify-otp?${params.toString()}`);
    } catch (error) {
      const described = describeSdkError(error);
      toast({
        title: described.title,
        description: described.description,
        variant: 'destructive',
      });
    }
  });

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            {...register('firstName')}
          />
          {errors.firstName ? (
            <p className="text-destructive text-sm">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            {...register('lastName')}
          />
          {errors.lastName ? (
            <p className="text-destructive text-sm">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email ? <p className="text-destructive text-sm">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          {...register('phone')}
        />
        {errors.phone ? <p className="text-destructive text-sm">{errors.phone.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-destructive text-sm">{errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </Button>
    </form>
  );
}
