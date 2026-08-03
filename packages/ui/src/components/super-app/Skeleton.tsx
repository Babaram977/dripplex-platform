/**
 * Loading-placeholder "bone" for the super-app design system, ported
 * verbatim (fill color, default radius) from `Bone` in the locked Figma
 * Make export's screen files. Named `SuperAppSkeleton` to avoid colliding
 * with the existing shadcn-derived `Skeleton` export from this package,
 * which is a different visual language (uses CSS var tokens, not the
 * locked navy/hex palette).
 */
export function SuperAppSkeleton({
  w,
  h,
  r = 16,
}: {
  w: number | string;
  h: number;
  r?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'rgba(255,255,255,.055)',
        flexShrink: 0,
      }}
    />
  );
}
