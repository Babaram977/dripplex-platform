'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type {
  AddressListResponse,
  CreateAddressDto,
  CustomerAddressDto,
  UpdateAddressDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

/**
 * Not Ride-specific — the "Saved Places" screen reuses the existing
 * customer address book (CustomerAddress, pre-dates Ride) as-is, per the
 * "no duplicated logic" rule. See docs/RIDE-003-INTEGRATION-MAP.md screen 23.
 */
export function useSavedPlaces(): UseQueryResult<AddressListResponse> {
  return useQuery({
    queryKey: rideQueryKeys.addresses,
    queryFn: () => sdk.addresses.list(),
  });
}

export function useCreateSavedPlace(): UseMutationResult<
  CustomerAddressDto,
  Error,
  CreateAddressDto
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAddressDto) => sdk.addresses.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.addresses });
    },
  });
}

interface UpdateSavedPlaceVariables {
  id: string;
  body: UpdateAddressDto;
}

export function useUpdateSavedPlace(): UseMutationResult<
  CustomerAddressDto,
  Error,
  UpdateSavedPlaceVariables
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: UpdateSavedPlaceVariables) => sdk.addresses.update(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.addresses });
    },
  });
}

export function useDeleteSavedPlace(): UseMutationResult<undefined, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.addresses.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.addresses });
    },
  });
}

export function useSetDefaultSavedPlace(): UseMutationResult<CustomerAddressDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.addresses.setDefault(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.addresses });
    },
  });
}
