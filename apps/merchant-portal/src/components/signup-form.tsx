'use client';

import { useAuth } from '@dripplex/hooks';
import {
  merchantRegistrationSchema,
  verifyEmailSchema,
  type MerchantRegistrationValues,
} from '@dripplex/types';
import { Button, Input, Label, toast } from '@dripplex/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { describeSdkError, sdk } from '@/lib/sdk';

type Step = 'account' | 'verify';

/**
 * Merchant self-registration against the live Backend Core.
 *
 * Step 1 creates a real merchant account (`POST /auth/register/merchant`) — this
 * writes a User + MerchantProfile to the production database and dispatches a
 * 6-digit email code. Step 2 verifies the email (`POST /auth/verify/email`),
 * then signs the merchant in (`POST /auth/login/merchant`) and hands off to the
 * dashboard, where Business Setup → KYC → Bank Account complete onboarding and
 * enter the Operations review queue. No mock state — every call hits the SDK.
 */
export function SignupForm(): React.JSX.Element {
  const router = useRouter();
  const { setSession } = useAuth();
  const [step, setStep] = React.useState<Step>('account');
  const [creds, setCreds] = React.useState<{ email: string; password: string }>({
    email: '',
    password: '',
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MerchantRegistrationValues>({
    resolver: zodResolver(merchantRegistrationSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
  });

  const onCreate = handleSubmit(async (values) => {
    try {
      const email = values.email && values.email.length > 0 ? values.email : undefined;
      const phone = values.phone && values.phone.length > 0 ? values.phone : undefined;
      await sdk.auth.registerMerchant({
        firstName: values.firstName,
        lastName: values.lastName,
        email,
        phone,
        password: values.password,
      });
      setCreds({ email: values.email ?? '', password: values.password });
      setStep('verify');
      toast({
        title: 'Account created',
        description: 'Enter the 6-digit code we just emailed you to verify your address.',
      });
    } catch (error) {
      const described = describeSdkError(error);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  });

  const [otp, setOtp] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);

  const onVerify = async (event: React.SyntheticEvent): Promise<void> => {
    event.preventDefault();
    const parsed = verifyEmailSchema.safeParse({ email: creds.email, otp });
    if (!parsed.success) {
      toast({
        title: 'Invalid code',
        description: parsed.error.issues[0]?.message ?? 'Enter the numeric code from your email.',
        variant: 'destructive',
      });
      return;
    }
    setVerifying(true);
    try {
      await sdk.auth.verifyEmail({ email: creds.email, otp });
      const session = await sdk.auth.loginMerchant({
        email: creds.email,
        password: creds.password,
      });
      setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        user: session.user,
        portal: 'merchant',
      });
      toast({
        title: 'Welcome to DrippleX',
        description: "You're signed in — let's set up your business for review.",
      });
      router.push('/business');
    } catch (error) {
      const described = describeSdkError(error);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async (): Promise<void> => {
    try {
      await sdk.auth.resendEmailOtp({ email: creds.email });
      toast({ title: 'Code resent', description: `A new code is on its way to ${creds.email}.` });
    } catch (error) {
      const described = describeSdkError(error);
      toast({ title: described.title, description: described.description, variant: 'destructive' });
    }
  };

  if (step === 'verify') {
    return (
      <form
        className="mx-auto w-full max-w-md space-y-4"
        onSubmit={(event) => {
          void onVerify(event);
        }}
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otp}
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, '').slice(0, 8));
            }}
          />
          <p className="text-muted-foreground text-sm">Sent to {creds.email}</p>
        </div>
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify & continue'}
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Didn’t get it?{' '}
          <button
            type="button"
            onClick={() => {
              void onResend();
            }}
            className="text-primary hover:underline"
          >
            Resend code
          </button>
        </p>
      </form>
    );
  }

  return (
    <form
      className="mx-auto w-full max-w-md space-y-4"
      onSubmit={(event) => {
        void onCreate(event);
      }}
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
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
          placeholder="+234 801 234 5678"
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
        ) : (
          <p className="text-muted-foreground text-sm">
            At least 8 characters with an uppercase, a lowercase, and a number.
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create merchant account'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
