import {
  SuperAppFeaturedMerchantCard,
  type SuperAppFeaturedMerchant,
} from './FeaturedMerchantCard';
import { SuperAppSectionHeader } from './SectionHeader';
import { SuperAppSkeleton } from './Skeleton';

/**
 * "Featured Merchants" section, ported from `FeaturedMerchants` in the
 * locked Figma Make Marketplace screen. Kept bespoke rather than built on
 * a shared section wrapper: the source's loading skeleton is a
 * horizontal-scroll row of wide cards while the loaded state is a
 * vertically-stacked full-width list — a genuine layout switch in the
 * source itself, not something the horizontal/vertical section
 * generics can represent.
 */
export function SuperAppFeaturedMerchantsSection({
  merchants,
  loaded,
  onSeeAll,
  onVisitStore,
}: {
  merchants: SuperAppFeaturedMerchant[];
  loaded: boolean;
  onSeeAll?: (() => void) | undefined;
  onVisitStore?: ((merchant: SuperAppFeaturedMerchant) => void) | undefined;
}): React.JSX.Element {
  return (
    <div className="mb-5">
      <SuperAppSectionHeader
        title="Featured Merchants"
        subtitle="Trusted local businesses"
        onSeeAll={onSeeAll}
      />
      {!loaded ? (
        <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
          {[1, 2, 3].map((i) => (
            <SuperAppSkeleton key={i} w={290} h={178} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5">
          {merchants.map((m) => (
            <SuperAppFeaturedMerchantCard
              key={m.key}
              merchant={m}
              onVisit={
                onVisitStore
                  ? () => {
                      onVisitStore(m);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
