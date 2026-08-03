import { useSuperAppFonts } from './fonts';
import { SuperAppQuantityStepper } from './QuantityStepper';

/**
 * "Quantity" label + stepper row, ported from the inline qty selector in
 * the locked Figma Make Product Detail screen (distinct from the compact
 * stepper reused in the sticky action bar).
 */
export function SuperAppProductQuantityRow({
  quantity,
  onDecrement,
  onIncrement,
}: {
  quantity: number;
  onDecrement?: (() => void) | undefined;
  onIncrement?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  return (
    <div className="mb-4 flex items-center justify-between px-5">
      <p className={`text-[13px] font-semibold text-white ${heading}`}>Quantity</p>
      <SuperAppQuantityStepper
        quantity={quantity}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
      />
    </div>
  );
}
