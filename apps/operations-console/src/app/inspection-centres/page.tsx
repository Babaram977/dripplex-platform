'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingSpinner,
  toast,
} from '@dripplex/ui';
import * as React from 'react';

import type { CreateInspectionCentreRequest } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import {
  useCreateInspectionCentre,
  useInspectionCentres,
  useUpdateInspectionCentre,
} from '@/hooks/use-inspection-centres';

const EMPTY_FORM: CreateInspectionCentreRequest = { name: '', address: '', city: '' };

function CreateCentreForm(): React.JSX.Element {
  const create = useCreateInspectionCentre();
  const [form, setForm] = React.useState<CreateInspectionCentreRequest>(EMPTY_FORM);

  const set = (key: keyof CreateInspectionCentreRequest, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (): void => {
    if (
      form.name.trim().length < 2 ||
      form.address.trim().length < 5 ||
      form.city.trim().length < 2
    ) {
      toast({
        title: 'Name, address and city are required',
        description: 'Address needs at least 5 characters.',
        variant: 'destructive',
      });
      return;
    }
    create.mutate(
      { name: form.name.trim(), address: form.address.trim(), city: form.city.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Inspection centre created' });
          setForm(EMPTY_FORM);
        },
        onError: (error) => {
          toast({
            title: "Couldn't create centre",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a centre</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Centre name"
            value={form.name}
            onChange={(event) => {
              set('name', event.target.value);
            }}
          />
          <Input
            placeholder="Address"
            value={form.address}
            onChange={(event) => {
              set('address', event.target.value);
            }}
          />
          <Input
            placeholder="City"
            value={form.city}
            onChange={(event) => {
              set('city', event.target.value);
            }}
          />
          <div>
            <Button disabled={create.isPending} onClick={onSubmit}>
              Create centre
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InspectionCentresPage(): React.JSX.Element {
  const query = useInspectionCentres();
  const update = useUpdateInspectionCentre();

  const toggleActive = (id: string, isActive: boolean): void => {
    update.mutate(
      { id, body: { isActive: !isActive } },
      {
        onSuccess: () => {
          toast({ title: isActive ? 'Centre deactivated' : 'Centre activated' });
        },
        onError: (error) => {
          toast({
            title: "Couldn't update centre",
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Inspection Centres</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage the centres where drivers schedule vehicle inspections. Only active centres are
            offered to drivers.
          </p>
        </div>

        <CreateCentreForm />

        <Card>
          <CardHeader>
            <CardTitle>Centres</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading ? <LoadingSpinner /> : null}
            {query.data?.length === 0 ? (
              <EmptyState
                title="No inspection centres yet"
                description="Add one above so drivers can schedule inspections."
              />
            ) : null}
            {query.data && query.data.length > 0 ? (
              <div className="border-border/70 divide-border/70 divide-y rounded-lg border">
                {query.data.map((centre) => (
                  <div
                    key={centre.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{centre.name}</p>
                      <p className="text-muted-foreground">
                        {centre.address} · {centre.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={centre.isActive ? 'success' : 'outline'}>
                        {centre.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        variant="outline"
                        disabled={update.isPending}
                        onClick={() => {
                          toggleActive(centre.id, centre.isActive);
                        }}
                      >
                        {centre.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
