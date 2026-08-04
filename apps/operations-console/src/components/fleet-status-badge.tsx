import { Badge } from '@dripplex/ui';
import * as React from 'react';

import type { FleetDriverStatus } from '@dripplex/types';

/** DPX-OPS-001 Slice 1 — colour/label mapping for `FleetDriverStatus`,
 * shared between the Live Fleet Map's list view and the driver list.
 * `Badge` only ships default/secondary/outline/accent/success/promotion
 * variants (packages/ui/src/components/ui/badge.tsx); SOS/SUSPENDED/
 * NEEDS_INSPECTION need the `destructive`/amber tokens the Button
 * component already uses, so those three apply them via `className`
 * rather than adding a one-off variant to the shared package. */
const STATUS_LABEL: Record<FleetDriverStatus, string> = {
  SOS: 'SOS',
  SUSPENDED: 'Suspended',
  NEEDS_INSPECTION: 'Needs inspection',
  BUSY: 'On a trip',
  AVAILABLE: 'Available',
  OFFLINE: 'Offline',
};

const STATUS_CLASSNAME: Record<FleetDriverStatus, string> = {
  SOS: 'border-transparent bg-destructive text-destructive-foreground animate-pulse',
  SUSPENDED: 'border-transparent bg-destructive text-destructive-foreground',
  NEEDS_INSPECTION: 'border-transparent bg-promotion text-promotion-foreground',
  BUSY: 'border-transparent bg-secondary text-secondary-foreground',
  AVAILABLE: 'border-transparent bg-success text-success-foreground',
  OFFLINE: '',
};

export function FleetStatusBadge({ status }: { status: FleetDriverStatus }): React.JSX.Element {
  const overrideClassName = STATUS_CLASSNAME[status];
  return (
    <Badge variant={overrideClassName ? undefined : 'outline'} className={overrideClassName}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
