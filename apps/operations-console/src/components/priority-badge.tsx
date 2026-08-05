import { Badge } from '@dripplex/ui';
import * as React from 'react';

import type { OperationsPriority } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — the founder's unified priority scale: 🔴 Critical,
 * 🟠 High, 🟡 Medium, 🟢 Low, used identically across all three queues. */
const PRIORITY_LABEL: Record<OperationsPriority, string> = {
  CRITICAL: '🔴 Critical',
  HIGH: '🟠 High',
  MEDIUM: '🟡 Medium',
  LOW: '🟢 Low',
};

const PRIORITY_CLASSNAME: Record<OperationsPriority, string> = {
  CRITICAL: 'border-transparent bg-destructive text-destructive-foreground',
  HIGH: 'border-transparent bg-promotion text-promotion-foreground',
  MEDIUM: '',
  LOW: 'border-transparent bg-success text-success-foreground',
};

export function PriorityBadge({ priority }: { priority: OperationsPriority }): React.JSX.Element {
  const overrideClassName = PRIORITY_CLASSNAME[priority];
  return (
    <Badge variant={overrideClassName ? undefined : 'outline'} className={overrideClassName}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
