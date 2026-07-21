export interface TaxContext {
  subtotal: number;
  discount: number;
  currency: string;
  country?: string;
}

export interface TaxCalculator {
  calculateTax(context: TaxContext): Promise<number>;
}

export const TAX_CALCULATOR = Symbol('TAX_CALCULATOR');
export const VAT_RATE = Symbol('VAT_RATE');
