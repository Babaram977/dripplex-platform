import { BORDER, G3, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRelatedProduct {
  id: string;
  name: string;
  priceLabel: string;
  imageUrl: string | null;
  badge?: string | undefined;
  badgeColor?: string | undefined;
}

/**
 * "You May Also Like" card, ported from the related-products markup in
 * the locked Figma Make Product Detail screen. Renders a real product
 * image when the backend provides one (`primaryImageUrl`) instead of the
 * source's emoji placeholder, since real `ProductSummaryDto` has no
 * emoji field.
 */
export function SuperAppRelatedProductCard({
  product,
  onPress,
}: {
  product: SuperAppRelatedProduct;
  onPress?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-[140px] shrink-0 overflow-hidden rounded-2xl text-left"
      style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
    >
      <div
        className="flex h-[90px] items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#1e2d44,#243347)' }}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
        )}
      </div>
      <div className="p-3">
        <p className={`truncate text-[12px] font-semibold text-white ${heading}`}>{product.name}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className={`text-[12px] font-bold ${heading}`} style={{ color: G3 }}>
            {product.priceLabel}
          </span>
          {product.badge ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${body}`}
              style={{ background: product.badgeColor, color: '#FFF' }}
            >
              {product.badge}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
