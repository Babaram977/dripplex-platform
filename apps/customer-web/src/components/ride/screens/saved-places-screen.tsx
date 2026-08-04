'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideDashedAddButton,
  SuperAppRideHeader,
  SuperAppRidePlaceCard,
  SuperAppRideSegmentedTabs,
  SuperAppRideStatusBanner,
  SuperAppRideTextField,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { AddressLabel, CustomerAddressDto } from '@dripplex/types';

import {
  useCreateSavedPlace,
  useCurrentLocation,
  useDeleteSavedPlace,
  useSavedPlaces,
  useSetDefaultSavedPlace,
  useUpdateSavedPlace,
} from '@/hooks/rides';

const LABELS: AddressLabel[] = ['HOME', 'WORK', 'OTHER'];

function labelIcon(label: AddressLabel): string {
  if (label === 'HOME') return '🏠';
  if (label === 'WORK') return '💼';
  return '📍';
}

interface FormState {
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

const EMPTY_FORM: FormState = {
  label: 'HOME',
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  country: 'Nigeria',
  postalCode: '',
};

/**
 * Generated form — the real Figma Make source's SavedPlacesScreen only
 * defines `onAdd` as a callback with no destination screen. Built here
 * because it's a genuine functional need (CreateAddressDto has required
 * fields the list view can't collect), reusing the exact input visual
 * pattern already established in DestinationSearchScreen (h-14/h-12
 * rounded-2xl #112238 surface) and the segmented-tab pattern from
 * RideHistoryScreen — no new visual tokens introduced. `latitude`/
 * `longitude` come from the device's real GPS (useCurrentLocation) since
 * no geocoding/address-autocomplete endpoint exists in this backend (the
 * same gap already documented in DestinationSearchScreen) — there is no
 * way to turn typed address text into coordinates.
 */
function PlaceForm({
  initial,
  editingId,
  onCancel,
  onSaved,
}: {
  initial: FormState;
  editingId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const [form, setForm] = React.useState<FormState>(initial);
  const location = useCurrentLocation();
  const createPlace = useCreateSavedPlace();
  const updatePlace = useUpdateSavedPlace();
  const { body } = useSuperAppFonts();

  const pending = createPlace.isPending || updatePlace.isPending;
  const canUseLocation = location.status === 'ready';
  const hasCoordinates = editingId !== null || canUseLocation;
  const canSubmit =
    form.recipientName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.addressLine1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.state.trim().length > 0 &&
    hasCoordinates;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onCancel} title={editingId ? 'Edit Place' : 'Add a Place'} />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        <div className="mb-4">
          <SuperAppRideSegmentedTabs
            tabs={LABELS.map((label) => ({
              key: label,
              label: `${labelIcon(label)} ${label.toLowerCase()}`,
            }))}
            selectedKey={form.label}
            onSelect={(label) => {
              setForm((f) => ({ ...f, label }));
            }}
          />
        </div>
        <SuperAppRideTextField
          label="Recipient name"
          value={form.recipientName}
          onChange={(v) => {
            setForm((f) => ({ ...f, recipientName: v }));
          }}
          required
        />
        <SuperAppRideTextField
          label="Phone"
          value={form.phone}
          onChange={(v) => {
            setForm((f) => ({ ...f, phone: v }));
          }}
          required
        />
        <SuperAppRideTextField
          label="Address"
          value={form.addressLine1}
          onChange={(v) => {
            setForm((f) => ({ ...f, addressLine1: v }));
          }}
          required
        />
        <SuperAppRideTextField
          label="Address line 2"
          value={form.addressLine2}
          onChange={(v) => {
            setForm((f) => ({ ...f, addressLine2: v }));
          }}
        />
        <SuperAppRideTextField
          label="Landmark"
          value={form.landmark}
          onChange={(v) => {
            setForm((f) => ({ ...f, landmark: v }));
          }}
        />
        <SuperAppRideTextField
          label="City"
          value={form.city}
          onChange={(v) => {
            setForm((f) => ({ ...f, city: v }));
          }}
          required
        />
        <SuperAppRideTextField
          label="State"
          value={form.state}
          onChange={(v) => {
            setForm((f) => ({ ...f, state: v }));
          }}
          required
        />
        <SuperAppRideTextField
          label="Postal code"
          value={form.postalCode}
          onChange={(v) => {
            setForm((f) => ({ ...f, postalCode: v }));
          }}
        />
        {editingId === null ? (
          <div
            className="mb-4 rounded-xl p-3.5"
            style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)' }}
          >
            <p className={`text-[12px] ${body}`} style={{ color: '#47CF72' }}>
              {canUseLocation
                ? '📍 Using your current device location for this place — no address search exists yet, so this is the only way to set coordinates.'
                : location.status === 'denied'
                  ? 'Location access denied — enable it to save a new place.'
                  : 'Getting your current location…'}
            </p>
          </div>
        ) : null}
        {createPlace.isError || updatePlace.isError ? (
          <p className={`mb-3 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
            Couldn&apos;t save this place. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <SuperAppRideActionButton
          label={editingId ? 'Save Changes' : 'Save Place'}
          disabled={!canSubmit}
          loading={pending}
          onClick={() => {
            const requestBody = {
              label: form.label,
              recipientName: form.recipientName.trim(),
              phone: form.phone.trim(),
              addressLine1: form.addressLine1.trim(),
              addressLine2: form.addressLine2.trim() || undefined,
              landmark: form.landmark.trim() || undefined,
              city: form.city.trim(),
              state: form.state.trim(),
              country: form.country.trim(),
              postalCode: form.postalCode.trim() || undefined,
            };
            if (editingId) {
              updatePlace.mutate({ id: editingId, body: requestBody }, { onSuccess: onSaved });
              return;
            }
            if (location.latitude === null || location.longitude === null) {
              return;
            }
            createPlace.mutate(
              { ...requestBody, latitude: location.latitude, longitude: location.longitude },
              { onSuccess: onSaved },
            );
          }}
        />
      </div>
    </div>
  );
}

function toFormState(place: CustomerAddressDto): FormState {
  return {
    label: place.label,
    recipientName: place.recipientName,
    phone: place.phone,
    addressLine1: place.addressLine1,
    addressLine2: place.addressLine2 ?? '',
    landmark: place.landmark ?? '',
    city: place.city,
    state: place.state,
    country: place.country,
    postalCode: place.postalCode ?? '',
  };
}

export function SavedPlacesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const savedPlaces = useSavedPlaces();
  const deletePlace = useDeleteSavedPlace();
  const setDefault = useSetDefaultSavedPlace();
  const { heading, body } = useSuperAppFonts();
  const [mode, setMode] = React.useState<
    { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; place: CustomerAddressDto }
  >({ kind: 'list' });

  if (mode.kind === 'add') {
    return (
      <PlaceForm
        initial={EMPTY_FORM}
        editingId={null}
        onCancel={() => {
          setMode({ kind: 'list' });
        }}
        onSaved={() => {
          setMode({ kind: 'list' });
        }}
      />
    );
  }
  if (mode.kind === 'edit') {
    return (
      <PlaceForm
        initial={toFormState(mode.place)}
        editingId={mode.place.id}
        onCancel={() => {
          setMode({ kind: 'list' });
        }}
        onSaved={() => {
          setMode({ kind: 'list' });
        }}
      />
    );
  }

  const homeWork = (savedPlaces.data?.items ?? []).filter(
    (p) => p.label === 'HOME' || p.label === 'WORK',
  );
  const other = (savedPlaces.data?.items ?? []).filter((p) => p.label === 'OTHER');

  function placeTitle(place: CustomerAddressDto): string {
    if (place.label === 'HOME') return 'Home';
    if (place.label === 'WORK') return 'Work';
    return place.addressLine1;
  }

  function placeCard(place: CustomerAddressDto): React.JSX.Element {
    return (
      <SuperAppRidePlaceCard
        key={place.id}
        icon={labelIcon(place.label)}
        title={placeTitle(place)}
        subtitle={`${place.addressLine1}, ${place.city}`}
        isDefault={place.isDefault}
        onEdit={() => {
          setMode({ kind: 'edit', place });
        }}
        onDelete={() => {
          deletePlace.mutate(place.id);
        }}
        onSetDefault={() => {
          setDefault.mutate(place.id);
        }}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Saved Places" />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        {savedPlaces.isLoading ? (
          <p className={`py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading saved places…
          </p>
        ) : null}
        {savedPlaces.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <SuperAppRideStatusBanner
              tone="error"
              title="Couldn't load your saved places"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <SuperAppRideActionButton
                label="Retry"
                variant="secondary"
                onClick={() => {
                  void savedPlaces.refetch();
                }}
              />
            </div>
          </div>
        ) : null}
        {!savedPlaces.isError && homeWork.length > 0 ? (
          <>
            <p
              className={`mb-3 text-[11px] font-semibold ${heading}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              HOME &amp; WORK
            </p>
            {homeWork.map((place) => placeCard(place))}
          </>
        ) : null}
        {!savedPlaces.isError && other.length > 0 ? (
          <>
            <p
              className={`mb-3 mt-4 text-[11px] font-semibold ${heading}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              OTHER PLACES
            </p>
            {other.map((place) => placeCard(place))}
          </>
        ) : null}
        {!savedPlaces.isLoading &&
        !savedPlaces.isError &&
        homeWork.length === 0 &&
        other.length === 0 ? (
          <p className={`py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            No saved places yet.
          </p>
        ) : null}
        <SuperAppRideDashedAddButton
          label="Add a place"
          onClick={() => {
            setMode({ kind: 'add' });
          }}
        />
      </div>
    </div>
  );
}
