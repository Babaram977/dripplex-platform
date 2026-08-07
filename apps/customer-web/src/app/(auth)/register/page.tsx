import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Dripplex customer account.',
};

/**
 * The generic email+password form here has been replaced by the real
 * Figma-ported Welcome/Register flow at `/get-started` (DPX-100 Auth Slice
 * 2, see docs/AUTH-DPX-100-REALITY-AUDIT.md). Kept as a redirect so old
 * links/bookmarks to `/register` still land somewhere real.
 */
export default function RegisterPage(): never {
  redirect('/get-started');
}
