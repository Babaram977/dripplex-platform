'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateVehicleRequest, UpdateVehicleRequest, VehicleDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const vehicleKeys = {
  all: ['driver-vehicles'] as const,
};

/** Driver Slice 2 item 9 — the backend/SDK vehicle CRUD surface
 * (VehiclesService/DriverVehiclesController, DPX-DRIVER-002) has existed
 * since Driver Slice 1; this is the first driver-portal UI to consume it.
 * Previously the profile page only showed the broad DriverAvailability
 * vehicle-type category. */
export function useDriverVehicles(): UseQueryResult<VehicleDto[]> {
  return useQuery({
    queryKey: vehicleKeys.all,
    queryFn: () => sdk.vehicles.listOwn(),
  });
}

export function useCreateVehicle(): UseMutationResult<VehicleDto, Error, CreateVehicleRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVehicleRequest) => sdk.vehicles.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });
}

export function useUpdateVehicle(): UseMutationResult<
  VehicleDto,
  Error,
  { id: string; body: UpdateVehicleRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateVehicleRequest }) =>
      sdk.vehicles.update(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    },
  });
}
