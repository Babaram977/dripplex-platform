import * as React from 'react';

import type { Metadata } from 'next';

import { EditProfileFlow } from '@/components/auth/edit-profile-flow';

export const metadata: Metadata = {
  title: 'Edit Profile',
  description: 'Update your DrippleX profile.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditProfilePage(): React.JSX.Element {
  return <EditProfileFlow />;
}
