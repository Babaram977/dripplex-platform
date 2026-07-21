export interface InventoryCheckInput {
  merchantId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface InventoryCheckResult {
  available: boolean;
  reason?: string;
}

export interface InventoryValidator {
  validateAvailability(input: InventoryCheckInput): Promise<InventoryCheckResult>;
}

export const INVENTORY_VALIDATOR = Symbol('INVENTORY_VALIDATOR');
