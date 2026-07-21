import { Injectable } from '@nestjs/common';

import type {
  InventoryCheckInput,
  InventoryCheckResult,
  InventoryValidator,
} from './inventory-validator';

/**
 * Stub inventory validator — always available.
 * Replace with stock service integration later.
 */
@Injectable()
export class AlwaysAvailableInventoryValidator implements InventoryValidator {
  public validateAvailability(_input: InventoryCheckInput): Promise<InventoryCheckResult> {
    return Promise.resolve({ available: true });
  }
}
