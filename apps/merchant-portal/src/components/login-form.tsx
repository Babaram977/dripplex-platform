'use client';

import { useAuth } from '@dripplex/hooks';
import { loginSchema, type LoginFormValues } from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { describeSdkError, sdk } from '@/lib/sdk';

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const { setSession } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await sdk.auth.loginMerchant({
        email: values.email,
        password: values.password,
      });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        user: session.user,
        portal: 'merchant',
      });
      toast({
        title: 'Signed in',
        description: `Welcome, ${session.user.firstName}.`,
      });
      router.push('/');
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
    <form
      className="mx-auto w-full max-w-md space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-destructive text-sm">{errors.password.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        New to DrippleX?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Create a merchant account
        </Link>
      </p>
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/" className="text-primary hover:underline">
          Back to status
        </Link>
      </p>
    </form>
  );
}
