'use client';

import {
  contactSchema,
  forgotPasswordSchema,
  resetPasswordUiSchema,
  verifyEmailTokenSchema,
  verifyOtpSchema,
  verifyPhoneSchema,
  type ContactFormValues,
  type ForgotPasswordFormValues,
  type ResetPasswordUiFormValues,
  type VerifyEmailDto,
  type VerifyOtpFormValues,
  type VerifyPhoneValues,
} from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { describeSdkError, sdk } from '@/lib/sdk';

export function ForgotPasswordForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sdk.auth.forgotPassword(values);
      toast({
        title: 'Check your email',
        description: 'If an account exists for that address, reset instructions were sent.',
      });
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
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}

export function ResetPasswordForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const resetToken = searchParams.get('token') ?? searchParams.get('resetToken') ?? '';
  const otp = searchParams.get('otp') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordUiFormValues>({
    resolver: zodResolver(resetPasswordUiSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!email || !resetToken || !otp) {
      toast({
        title: 'Missing reset details',
        description: 'Open the reset link from your email so email, token, and OTP are present.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await sdk.auth.resetPassword({
        email,
        resetToken,
        otp,
        password: values.password,
      });
      toast({
        title: 'Password updated',
        description: 'You can sign in with your new password.',
      });
      router.push('/login');
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
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
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
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}

/**
 * Landing page for the magic-link "Verify email" button in the
 * account-verification email (`ProductionNotificationService.sendEmailVerification`,
 * a signed one-time token via `EmailVerificationService` -- distinct from
 * the 6-digit code flow below (`VerifyOtpForm`), which is what the real
 * registration screen (`auth-flow.tsx`) actually uses today. The emailed
 * link only carries `?token=`, not the address it was sent to, and the
 * backend deliberately requires both (`VerifyEmailDto`) as a defense
 * against a leaked token alone being enough -- so this form asks the user
 * to confirm their email rather than silently trusting the URL.
 */
export function VerifyEmailForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailDto>({
    resolver: zodResolver(verifyEmailTokenSchema),
    defaultValues: { email: '', token },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sdk.auth.verifyEmailToken(values);
      toast({
        title: 'Email verified',
        description: 'Your account is verified. You can sign in now.',
      });
      router.push('/login');
    } catch (error) {
      const described = describeSdkError(error);
      toast({
        title: described.title,
        description: described.description,
        variant: 'destructive',
      });
    }
  });

  if (!token) {
    return (
      <p className="text-destructive text-sm">
        This verification link is missing its token. Open the &ldquo;Verify email&rdquo; button from
        the email we sent you, or request a new link.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
      <input type="hidden" {...register('token')} />
      <div className="space-y-2">
        <Label htmlFor="verify-email-address">Confirm your email</Label>
        <Input
          id="verify-email-address"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email ? <p className="text-destructive text-sm">{errors.email.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Verifying…' : 'Verify email'}
      </Button>
    </form>
  );
}

/**
 * Dispatches to phone- or email-verification based on which identifier the
 * caller landed here with -- registration now accepts either (see
 * docs/AUTH-DPX-100-REALITY-AUDIT.md Slice 1), so a phone-only signup must
 * be able to verify by phone too, not just email.
 */
export function VerifyOtpForm(): React.JSX.Element {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const email = searchParams.get('email');
  if (phone && !email) {
    return <VerifyPhoneOtpForm phone={phone} />;
  }
  return <VerifyEmailOtpForm email={email ?? ''} />;
}

function VerifyEmailOtpForm({ email }: { email: string }): React.JSX.Element {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { email, otp: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sdk.auth.verifyEmail(values);
      toast({
        title: 'Email verified',
        description: 'Your account is verified. You can sign in now.',
      });
      router.push('/login');
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
        <Label htmlFor="otp">One-time code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-invalid={Boolean(errors.otp)}
          {...register('otp')}
        />
        {errors.otp ? <p className="text-destructive text-sm">{errors.otp.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Verifying…' : 'Verify code'}
      </Button>
    </form>
  );
}

function VerifyPhoneOtpForm({ phone }: { phone: string }): React.JSX.Element {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyPhoneValues>({
    resolver: zodResolver(verifyPhoneSchema),
    defaultValues: { phone, otp: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sdk.auth.verifyPhone(values);
      toast({
        title: 'Phone verified',
        description: 'Your account is verified. You can sign in now.',
      });
      router.push('/login');
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
      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
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
        <Label htmlFor="otp">One-time code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-invalid={Boolean(errors.otp)}
          {...register('otp')}
        />
        {errors.otp ? <p className="text-destructive text-sm">{errors.otp.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Verifying…' : 'Verify code'}
      </Button>
    </form>
  );
}

export function ContactForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', message: '' },
  });

  const onSubmit = handleSubmit((values) => {
    // Contact is not a Backend Core auth/commerce endpoint in Program A freeze.
    // Capture locally until operations CMS intake is productized in a later phase.
    toast({
      title: 'Message captured',
      description: `Thanks ${values.name}. Operations intake will follow in a later phase.`,
    });
    reset();
  });

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          {...register('name')}
        />
        {errors.name ? <p className="text-destructive text-sm">{errors.name.message}</p> : null}
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
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          rows={5}
          className="border-input bg-background/80 placeholder:text-muted-foreground flex w-full rounded-md border px-3 py-2 text-sm shadow-sm"
          aria-invalid={Boolean(errors.message)}
          {...register('message')}
        />
        {errors.message ? (
          <p className="text-destructive text-sm">{errors.message.message}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Send message
      </Button>
    </form>
  );
}
