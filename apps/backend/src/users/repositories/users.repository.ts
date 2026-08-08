import type { User, UserStatus, RegistrationChannel } from '@prisma/client';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
  registrationChannel?: RegistrationChannel;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
  dateOfBirth?: Date;
  gender?: string;
}

export interface UserWithRbac extends User {
  roles: {
    role: {
      name: string;
      permissions: {
        permission: {
          code: string;
        };
      }[];
    };
  }[];
}

export interface UsersRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByIdWithRbac(id: string): Promise<UserWithRbac | null>;
  markLogin(id: string): Promise<User>;
  recordLoginActivity(id: string): Promise<User>;
  markEmailVerified(id: string): Promise<User>;
  markPhoneVerified(id: string): Promise<User>;
  activateIfVerificationsComplete(id: string, requiresPhoneVerification: boolean): Promise<User>;
  softDelete(id: string): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
  linkGoogleId(id: string, googleId: string): Promise<User>;
  updateProfile(id: string, data: UpdateProfileInput): Promise<User>;
  /** Sets the new phone number and marks it verified (the caller has already confirmed OTP). */
  updatePhone(id: string, phone: string): Promise<User>;
  /** Sets the new email and marks it verified (the caller has already confirmed OTP). */
  updateEmail(id: string, email: string): Promise<User>;
  list(params: { skip: number; take: number }): Promise<{ items: User[]; total: number }>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
