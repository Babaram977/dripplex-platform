import { SuperAppSkeleton } from './Skeleton';

/**
 * Loading placeholder for the Product Detail screen while the real
 * product fetch is in flight, built from `SuperAppSkeleton` "bones" in
 * roughly the shape of the real layout (gallery / title / price / action
 * bar) rather than reusing the light-themed `CardGridSkeleton`, which
 * doesn't match this screen's dark full-bleed shell.
 */
export function SuperAppProductDetailSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-4">
      <SuperAppSkeleton w="100%" h={280} r={24} />
      <SuperAppSkeleton w="70%" h={22} />
      <SuperAppSkeleton w="40%" h={16} />
      <SuperAppSkeleton w="45%" h={30} />
      <SuperAppSkeleton w="100%" h={80} r={16} />
      <SuperAppSkeleton w="100%" h={120} r={16} />
    </div>
  );
}
