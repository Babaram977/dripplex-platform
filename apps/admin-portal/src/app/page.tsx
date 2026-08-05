import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { BackendStatusPanel } from '@/components/backend-status-panel';

export default function HomePage(): React.JSX.Element {
  return (
    <AppShell>
      <BackendStatusPanel />
    </AppShell>
  );
}
