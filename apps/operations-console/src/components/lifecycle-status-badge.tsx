import { Badge } from '@dripplex/ui';
import * as React from 'react';

import type { OperationsLifecycleStatus } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — the founder's standard workflow: New -> Assigned
 * -> In Progress -> Waiting -> Resolved -> Closed. */
const STATUS_LABEL: Record<OperationsLifecycleStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_CLASSNAME: Record<OperationsLifecycleStatus, string> = {
  NEW: 'border-transparent bg-secondary text-secondary-foreground',
  ASSIGNED: '',
  IN_PROGRESS: 'border-transparent bg-accent text-accent-foreground',
  WAITING: 'border-transparent bg-promotion text-promotion-foreground',
  RESOLVED: 'border-transparent bg-success text-success-foreground',
  CLOSED: '',
};

export function LifecycleStatusBadge({
  status,
}: {
  status: OperationsLifecycleStatus;
}): React.JSX.Element {
  const overrideClassName = STATUS_CLASSNAME[status];
  return (
    <Badge variant={overrideClassName ? undefined : 'outline'} className={overrideClassName}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
