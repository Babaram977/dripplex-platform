import * as React from 'react';

import { BackendStatusPanel } from '@/components/backend-status-panel';
import { PortalAuthGate } from '@/components/portal-auth-gate';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="container py-10">
      <PortalAuthGate>
        <BackendStatusPanel />
      </PortalAuthGate>
    </main>
  );
}
