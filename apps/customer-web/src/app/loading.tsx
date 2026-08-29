import { LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

export default function Loading(): React.JSX.Element {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner label="Loading DrippleX" />
    </div>
  );
}
