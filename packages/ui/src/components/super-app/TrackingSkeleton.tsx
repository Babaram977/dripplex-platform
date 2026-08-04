import { SuperAppSkeleton } from './Skeleton';

/** Loading placeholder for the Tracking screen while real order/delivery data is in flight. */
export function SuperAppTrackingSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-6">
      <SuperAppSkeleton w="100%" h={180} r={16} />
      <SuperAppSkeleton w="100%" h={90} r={16} />
      <SuperAppSkeleton w="100%" h={110} r={16} />
      <SuperAppSkeleton w="100%" h={220} r={16} />
    </div>
  );
}
