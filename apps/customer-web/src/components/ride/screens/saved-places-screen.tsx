'use client';

import * as React from 'react';

import { ActionButton, RideHeader, StatusBanner } from '../ride-ui';

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

function fieldStyle(): React.CSSProperties {
  return { background: '#112238', border: '1px solid rgba(255,255,255,.08)' };
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}): React.JSX.Element {
  return (
    <div className="mb-3">
      <p
        className="mb-1.5 text-[11px] font-semibold"
        style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
      >
        {label}
        {required ? ' *' : ''}
      </p>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-12 w-full rounded-2xl px-4 outline-none"
        style={{ ...fieldStyle(), fontFamily: "'Inter',sans-serif", fontSize: 14, color: '#fff' }}
      />
    </div>
  );
}

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
      <RideHeader onBack={onCancel} title={editingId ? 'Edit Place' : 'Add a Place'} />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        <div className="mb-4 flex gap-2">
          {LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, label }));
              }}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize"
              style={{
                background: form.label === label ? '#2BAC52' : '#112238',
                color: form.label === label ? '#fff' : 'rgba(255,255,255,.5)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {labelIcon(label)} {label.toLowerCase()}
            </button>
          ))}
        </div>
        <TextField
          label="Recipient name"
          value={form.recipientName}
          onChange={(v) => {
            setForm((f) => ({ ...f, recipientName: v }));
          }}
          required
        />
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(v) => {
            setForm((f) => ({ ...f, phone: v }));
          }}
          required
        />
        <TextField
          label="Address"
          value={form.addressLine1}
          onChange={(v) => {
            setForm((f) => ({ ...f, addressLine1: v }));
          }}
          required
        />
        <TextField
          label="Address line 2"
          value={form.addressLine2}
          onChange={(v) => {
            setForm((f) => ({ ...f, addressLine2: v }));
          }}
        />
        <TextField
          label="Landmark"
          value={form.landmark}
          onChange={(v) => {
            setForm((f) => ({ ...f, landmark: v }));
          }}
        />
        <TextField
          label="City"
          value={form.city}
          onChange={(v) => {
            setForm((f) => ({ ...f, city: v }));
          }}
          required
        />
        <TextField
          label="State"
          value={form.state}
          onChange={(v) => {
            setForm((f) => ({ ...f, state: v }));
          }}
          required
        />
        <TextField
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
            <p
              className="text-[12px]"
              style={{ fontFamily: "'Inter',sans-serif", color: '#47CF72' }}
            >
              {canUseLocation
                ? '📍 Using your current device location for this place — no address search exists yet, so this is the only way to set coordinates.'
                : location.status === 'denied'
                  ? 'Location access denied — enable it to save a new place.'
                  : 'Getting your current location…'}
            </p>
          </div>
        ) : null}
        {createPlace.isError || updatePlace.isError ? (
          <p
            className="mb-3 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#EF4444' }}
          >
            Couldn&apos;t save this place. Try again.
          </p>
        ) : null}
      </div>
      <div className="px-5 pb-8 pt-3">
        <ActionButton
          label={editingId ? 'Save Changes' : 'Save Place'}
          disabled={!canSubmit}
          loading={pending}
          onClick={() => {
            const body = {
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
              updatePlace.mutate({ id: editingId, body }, { onSuccess: onSaved });
              return;
            }
            if (location.latitude === null || location.longitude === null) {
              return;
            }
            createPlace.mutate(
              { ...body, latitude: location.latitude, longitude: location.longitude },
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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Saved Places" />
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        {savedPlaces.isLoading ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            Loading saved places…
          </p>
        ) : null}
        {savedPlaces.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <StatusBanner
              tone="error"
              title="Couldn't load your saved places"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <ActionButton
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
              className="mb-3 text-[11px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              HOME &amp; WORK
            </p>
            {homeWork.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
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
            ))}
          </>
        ) : null}
        {!savedPlaces.isError && other.length > 0 ? (
          <>
            <p
              className="mb-3 mt-4 text-[11px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              OTHER PLACES
            </p>
            {other.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
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
            ))}
          </>
        ) : null}
        {!savedPlaces.isLoading &&
        !savedPlaces.isError &&
        homeWork.length === 0 &&
        other.length === 0 ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            No saved places yet.
          </p>
        ) : null}
        <button
          type="button"
          className="mb-6 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl"
          style={{ border: '1.5px dashed rgba(34,197,94,.4)', background: 'transparent' }}
          onClick={() => {
            setMode({ kind: 'add' });
          }}
        >
          <span style={{ fontSize: 20, color: '#47CF72' }}>+</span>
          <p
            style={{
              fontSize: 14,
              color: '#47CF72',
              fontFamily: "'Poppins',sans-serif",
              fontWeight: 600,
            }}
          >
            Add a place
          </p>
        </button>
      </div>
    </div>
  );
}

function PlaceRow({
  place,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  place: CustomerAddressDto;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}): React.JSX.Element {
  return (
    <div
      className="mb-3 overflow-hidden rounded-2xl"
      style={{
        background: '#0D1B2E',
        border: '1px solid rgba(255,255,255,.08)',
        borderLeft: place.isDefault ? '3px solid #47CF72' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <div className="flex items-center gap-3 p-4">
        <span style={{ fontSize: 22 }}>{labelIcon(place.label)}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p
              style={{
                fontFamily: "'Poppins',sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {place.label === 'HOME'
                ? 'Home'
                : place.label === 'WORK'
                  ? 'Work'
                  : place.addressLine1}
            </p>
            {place.isDefault ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(43,172,82,.12)', color: '#47CF72' }}
              >
                Default
              </span>
            ) : null}
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,.6)',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {place.addressLine1}, {place.city}
          </p>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={onEdit}
          className="text-[12px] font-semibold"
          style={{ color: '#47CF72', fontFamily: "'Poppins',sans-serif" }}
        >
          Edit
        </button>
        {!place.isDefault ? (
          <button
            type="button"
            onClick={onSetDefault}
            className="text-[12px] font-semibold"
            style={{ color: 'rgba(255,255,255,.6)', fontFamily: "'Poppins',sans-serif" }}
          >
            Set as default
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-[12px] font-semibold"
          style={{ color: '#EF4444', fontFamily: "'Poppins',sans-serif" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
