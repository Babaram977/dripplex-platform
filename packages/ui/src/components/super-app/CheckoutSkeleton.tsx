import { SuperAppSkeleton } from './Skeleton';

/** Loading placeholder for the Checkout screen while real cart/address data is in flight. */
export function SuperAppCheckoutSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-6">
      <SuperAppSkeleton w="100%" h={100} r={16} />
      <SuperAppSkeleton w="100%" h={140} r={16} />
      <SuperAppSkeleton w="100%" h={180} r={16} />
      <SuperAppSkeleton w="100%" h={120} r={16} />
    </div>
  );
}
