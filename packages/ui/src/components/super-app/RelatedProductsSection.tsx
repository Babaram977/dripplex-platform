import { useSuperAppFonts } from './fonts';
import { SuperAppRelatedProductCard, type SuperAppRelatedProduct } from './RelatedProductCard';

/**
 * "You May Also Like" section (label + horizontal scroll row), ported
 * from the Related Products block in the locked Figma Make Product Detail
 * screen.
 */
export function SuperAppRelatedProductsSection({
  title = 'You May Also Like',
  products,
  onSelect,
}: {
  title?: string | undefined;
  products: SuperAppRelatedProduct[];
  onSelect?: ((productId: string) => void) | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div className="mb-4">
      <p className={`px-page mb-3 text-[14px] font-semibold text-white ${heading}`}>{title}</p>
      <div className="px-page flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {products.map((product) => (
          <SuperAppRelatedProductCard
            key={product.id}
            product={product}
            onPress={
              onSelect
                ? () => {
                    onSelect(product.id);
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
