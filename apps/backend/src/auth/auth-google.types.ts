/**
 * Profile data extracted from a verified Google OAuth callback, passed from
 * GoogleStrategy.validate() through to GoogleAuthService. Kept separate from
 * the raw passport-google-oauth20 Profile type so the rest of the auth module
 * only depends on the fields it actually needs.
 */
export interface GoogleProfileData {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}
