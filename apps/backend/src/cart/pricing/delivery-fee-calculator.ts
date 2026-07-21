export interface DeliveryFeeContext {
  merchantId: string;
  customerId: string;
  subtotal: number;
  currency: string;
}

export interface DeliveryFeeCalculator {
  calculateFee(context: DeliveryFeeContext): Promise<number>;
}

export const DELIVERY_FEE_CALCULATOR = Symbol('DELIVERY_FEE_CALCULATOR');
export const FLAT_DELIVERY_FEE = Symbol('FLAT_DELIVERY_FEE');
