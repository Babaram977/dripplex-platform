import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Include upper, lower, and a number');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number');

export const portalRegistrationBaseSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  password: passwordSchema,
});

export const customerRegistrationSchema = portalRegistrationBaseSchema.extend({
  phone: phoneSchema.optional().or(z.literal('')),
});

export const merchantRegistrationSchema = portalRegistrationBaseSchema.extend({
  phone: phoneSchema.optional().or(z.literal('')),
});

export const riderRegistrationSchema = portalRegistrationBaseSchema.extend({
  phone: phoneSchema,
});

export const driverRegistrationSchema = portalRegistrationBaseSchema.extend({
  phone: phoneSchema,
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  otp: z.string().regex(/^\d{4,8}$/, 'Enter the numeric code from your message'),
});

export const verifyPhoneSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^\d{4,8}$/, 'Enter the numeric code from your message'),
});

export type CustomerRegistrationValues = z.infer<typeof customerRegistrationSchema>;
export type MerchantRegistrationValues = z.infer<typeof merchantRegistrationSchema>;
export type RiderRegistrationValues = z.infer<typeof riderRegistrationSchema>;
export type DriverRegistrationValues = z.infer<typeof driverRegistrationSchema>;
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;
export type VerifyPhoneValues = z.infer<typeof verifyPhoneSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number')
      .optional()
      .or(z.literal('')),
    password: passwordSchema,
    confirmPassword: z.string().min(8, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(8, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  otp: z.string().regex(/^\d{4,8}$/, 'Enter the numeric code from your message'),
});

export type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
