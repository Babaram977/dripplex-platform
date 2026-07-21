'use client';

import {
  contactSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  type ContactFormValues,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
  type VerifyOtpFormValues,
} from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

export function ForgotPasswordForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(() => {
    toast({
      title: 'UI only',
      description: 'Password recovery will connect to the Dripplex API in a later commit.',
    });
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
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(() => {
    toast({
      title: 'UI only',
      description: 'Password reset will connect to the Dripplex API in a later commit.',
    });
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
        Update password
      </Button>
    </form>
  );
}

export function VerifyOtpForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { email: '', otp: '' },
  });

  const onSubmit = handleSubmit(() => {
    toast({
      title: 'UI only',
      description: 'OTP verification will connect to the Dripplex API in a later commit.',
    });
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
        Verify code
      </Button>
    </form>
  );
}

export function ContactForm(): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', message: '' },
  });

  const onSubmit = handleSubmit(() => {
    toast({
      title: 'Message captured locally',
      description: 'Contact delivery will be wired to operations in a later commit.',
    });
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
