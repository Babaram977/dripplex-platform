'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Switch, toast } from '@dripplex/ui';
import * as React from 'react';

import { useSetRiderAvailability } from '@/hooks/deliveries/use-rider-availability';
import { describeSdkError } from '@/lib/sdk';

/**
 * Online / accepting-orders toggle wired to POST /rider/availability. The
 * rider SDK has no read endpoint for availability, so state is held locally
 * and seeded to offline; every change is persisted through the mutation.
 */
export function AvailabilityToggle(): React.JSX.Element {
  const [online, setOnline] = React.useState(false);
  const setAvailability = useSetRiderAvailability();

  const apply = (next: boolean): void => {
    setAvailability.mutate(
      { online: next, acceptingOrders: next },
      {
        onSuccess: (data) => {
          setOnline(data.online);
          toast({
            title: data.online ? 'You are online' : 'You are offline',
            description: data.online
              ? 'Accepting delivery assignments.'
              : 'Not accepting new assignments.',
          });
        },
        onError: (error) => {
          const described = describeSdkError(error);
          toast({
            title: described.title,
            description: described.description,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base">Availability</CardTitle>
        <Badge variant={online ? 'success' : 'outline'}>{online ? 'Online' : 'Offline'}</Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {online ? 'Accepting delivery assignments.' : 'Go online to accept assignments.'}
        </p>
        <Switch
          checked={online}
          disabled={setAvailability.isPending}
          onCheckedChange={apply}
          label="Toggle availability"
        />
      </CardContent>
    </Card>
  );
}
