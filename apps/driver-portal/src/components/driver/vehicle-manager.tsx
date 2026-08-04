'use client';

import { Badge, Button, Input, Label, Select, Skeleton, toast } from '@dripplex/ui';
import * as React from 'react';

import type { RideType, VehicleApprovalStatus, VehicleDto } from '@dripplex/types';

import { useCreateVehicle, useDriverVehicles, useUpdateVehicle } from '@/hooks/use-driver-vehicles';

const RIDE_CATEGORY_OPTIONS: { value: RideType; label: string }[] = [
  { value: 'ECONOMY', label: 'Dx Ride (car)' },
  { value: 'COMFORT', label: 'Dx Comfort (car)' },
  { value: 'XL', label: 'Dx XL (car)' },
  { value: 'TRICYCLE', label: 'Tricycle (Keke)' },
];

const APPROVAL_BADGE: Record<
  VehicleApprovalStatus,
  { variant: 'success' | 'outline'; className?: string }
> = {
  APPROVED: { variant: 'success' },
  REJECTED: { variant: 'outline', className: 'text-destructive border-destructive/40' },
  PENDING: { variant: 'outline' },
};

interface VehicleFormState {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: string;
  rideCategory: RideType;
}

const EMPTY_FORM: VehicleFormState = {
  plateNumber: '',
  make: '',
  model: '',
  color: '',
  year: String(new Date().getFullYear()),
  rideCategory: 'ECONOMY',
};

function VehicleRow({ vehicle }: { vehicle: VehicleDto }): React.JSX.Element {
  const updateVehicle = useUpdateVehicle();
  const [editing, setEditing] = React.useState(false);
  const [make, setMake] = React.useState(vehicle.make);
  const [model, setModel] = React.useState(vehicle.model);
  const [color, setColor] = React.useState(vehicle.color);

  const onSave = (): void => {
    updateVehicle.mutate(
      { id: vehicle.id, body: { make: make.trim(), model: model.trim(), color: color.trim() } },
      {
        onSuccess: () => {
          toast({ title: 'Vehicle updated' });
          setEditing(false);
        },
        onError: () => {
          toast({
            title: "Couldn't update vehicle",
            description: 'Check the details and try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">
          {vehicle.plateNumber} —{' '}
          {RIDE_CATEGORY_OPTIONS.find((o) => o.value === vehicle.rideCategory)?.label ??
            vehicle.rideCategory}
        </p>
        <Badge {...APPROVAL_BADGE[vehicle.approvalStatus]}>{vehicle.approvalStatus}</Badge>
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              aria-label="Make"
              value={make}
              onChange={(event) => {
                setMake(event.target.value);
              }}
              placeholder="Make"
            />
            <Input
              aria-label="Model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
              }}
              placeholder="Model"
            />
            <Input
              aria-label="Colour"
              value={color}
              onChange={(event) => {
                setColor(event.target.value);
              }}
              placeholder="Colour"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={onSave} disabled={updateVehicle.isPending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {vehicle.color} {vehicle.make} {vehicle.model} ({vehicle.year})
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      )}
      {vehicle.approvalStatus === 'REJECTED' && vehicle.rejectedReason ? (
        <p className="text-destructive text-xs">Rejected: {vehicle.rejectedReason}</p>
      ) : null}
    </div>
  );
}

export function VehicleManager(): React.JSX.Element {
  const vehicles = useDriverVehicles();
  const createVehicle = useCreateVehicle();
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [form, setForm] = React.useState<VehicleFormState>(EMPTY_FORM);

  const onCreate = (): void => {
    const year = Number(form.year);
    if (!form.plateNumber.trim() || !form.make.trim() || !form.model.trim() || !form.color.trim()) {
      toast({
        title: "Couldn't add vehicle",
        description: 'Fill in all fields.',
        variant: 'destructive',
      });
      return;
    }
    createVehicle.mutate(
      {
        plateNumber: form.plateNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        color: form.color.trim(),
        year,
        rideCategory: form.rideCategory,
      },
      {
        onSuccess: () => {
          toast({ title: 'Vehicle submitted', description: 'Awaiting approval.' });
          setForm(EMPTY_FORM);
          setShowAddForm(false);
        },
        onError: () => {
          toast({
            title: "Couldn't add vehicle",
            description: 'Check the details and try again.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {vehicles.isLoading ? <Skeleton className="h-16 w-full" /> : null}
      {vehicles.data && vehicles.data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {vehicles.data.map((vehicle) => (
            <VehicleRow key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      ) : vehicles.data ? (
        <p className="text-muted-foreground text-sm">No vehicles added yet.</p>
      ) : null}

      {showAddForm ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
          className="border-border/70 flex flex-col gap-3 rounded-md border p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-plate">Plate number</Label>
              <Input
                id="vehicle-plate"
                value={form.plateNumber}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, plateNumber: event.target.value }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-category">Category</Label>
              <Select
                id="vehicle-category"
                value={form.rideCategory}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, rideCategory: event.target.value as RideType }));
                }}
              >
                {RIDE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-make">Make</Label>
              <Input
                id="vehicle-make"
                value={form.make}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, make: event.target.value }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input
                id="vehicle-model"
                value={form.model}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, model: event.target.value }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-color">Colour</Label>
              <Input
                id="vehicle-color"
                value={form.color}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, color: event.target.value }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-year">Year</Label>
              <Input
                id="vehicle-year"
                type="number"
                value={form.year}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, year: event.target.value }));
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createVehicle.isPending}>
              Add vehicle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setShowAddForm(true);
          }}
        >
          Add vehicle
        </Button>
      )}
    </div>
  );
}
