import { MUTED, NAVY_CARD, BORDER, G0, G2, G3 } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppStoreProduct {
  key: string;
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  emoji: string;
  rating: number;
  badge?: string;
  badgeColor?: string;
  inStock: boolean;
  isService?: boolean;
}

/**
 * Store menu/product card (image, wishlist heart, out-of-stock overlay,
 * price, Add to Cart), ported from the card markup inside `ProductGrid`
 * in the locked Figma Make Store screen. Source tracks wishlist/cart
 * state as `Set<id>` on the parent grid; here it's controlled via props
 * so the composing screen owns cart state (unlike Marketplace's
 * decorative product wishlist, this "Add to Cart" state is meant to feed
 * a real Cart screen later).
 */
export function SuperAppStoreProductCard({
  product,
  isWishlisted = false,
  isInCart = false,
  onSelect,
  onToggleWishlist,
  onAddToCart,
}: {
  product: SuperAppStoreProduct;
  isWishlisted?: boolean | undefined;
  isInCart?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  onToggleWishlist?: (() => void) | undefined;
  onAddToCart?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      onClick={onSelect}
      className="overflow-hidden rounded-3xl transition-all active:scale-[.97]"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${BORDER}`,
        opacity: product.inStock ? 1 : 0.55,
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ height: 88, background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
      >
        <span style={{ fontSize: 44 }}>{product.emoji}</span>
        {product.badge ? (
          <div
            className={`absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold ${body}`}
            style={{ background: product.badgeColor, color: '#FFF' }}
          >
            {product.badge}
          </div>
        ) : null}
        {!product.inStock ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(6,14,28,.72)' }}
          >
            <p
              className={`text-[10px] font-bold ${body}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              Out of Stock
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist?.();
          }}
          aria-label="Toggle wishlist"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl active:scale-90"
          style={{ background: isWishlisted ? 'rgba(239,68,68,.2)' : 'rgba(0,0,0,.4)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={isWishlisted ? '#F87171' : 'none'}
            stroke={isWishlisted ? '#F87171' : 'rgba(255,255,255,.6)'}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <p className={`mb-0.5 truncate text-[12px] font-bold ${heading}`} style={{ color: '#FFF' }}>
          {product.name}
        </p>
        <p className={`mb-1 truncate text-[9.5px] ${body}`} style={{ color: MUTED }}>
          {product.description}
        </p>
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold" style={{ color: '#FBBF24' }}>
            ★ {product.rating}
          </span>
        </div>
        {product.originalPrice ? (
          <p className={`text-[9.5px] line-through ${body}`} style={{ color: MUTED }}>
            {product.originalPrice}
          </p>
        ) : null}
        <p className={`mb-2 text-[13px] font-bold ${heading}`} style={{ color: G3 }}>
          {product.price}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (product.inStock) onAddToCart?.();
          }}
          disabled={!product.inStock}
          className={`h-[30px] w-full rounded-xl text-[10.5px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: isInCart
              ? 'rgba(43,172,82,.2)'
              : product.inStock
                ? `linear-gradient(135deg,${G0},${G2})`
                : 'rgba(255,255,255,.05)',
            color: isInCart ? G3 : product.inStock ? '#FFF' : 'rgba(255,255,255,.3)',
            border: isInCart ? '1px solid rgba(43,172,82,.3)' : 'none',
            boxShadow: !isInCart && product.inStock ? '0 3px 10px rgba(43,172,82,.22)' : 'none',
          }}
        >
          {isInCart ? '✓ Added' : product.isService ? 'Book Now' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
