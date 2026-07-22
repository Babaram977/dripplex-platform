import * as React from 'react';

import { BackendStatusPanel } from '@/components/backend-status-panel';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="container py-10">
      <BackendStatusPanel />
    </main>
  );
}
