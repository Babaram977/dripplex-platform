import * as React from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Loading(): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner label="Loading Dripplex" />
    </div>
  );
}
