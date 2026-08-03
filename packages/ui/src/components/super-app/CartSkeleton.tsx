import { SuperAppSkeleton } from './Skeleton';

/** Loading placeholder for the Cart screen while the real cart fetch is in flight. */
export function SuperAppCartSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-6">
      <SuperAppSkeleton w="100%" h={22} />
      <SuperAppSkeleton w="100%" h={280} r={24} />
      <SuperAppSkeleton w="100%" h={140} r={16} />
    </div>
  );
}
