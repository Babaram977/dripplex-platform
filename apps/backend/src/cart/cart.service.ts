import { Inject, Injectable } from '@nestjs/common';
import { CartStatus, MerchantStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  CartMerchantConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { CART_AUDIT_ACTIONS, CART_CURRENCY_DEFAULT } from './cart.constants';
import { roundMoney, toCartDto } from './cart.mapper';
import { INVENTORY_VALIDATOR, type InventoryValidator } from './inventory/inventory-validator';
import { COUPON_ENGINE, type CouponEngine } from './pricing/coupon-engine';
import {
  DELIVERY_FEE_CALCULATOR,
  type DeliveryFeeCalculator,
} from './pricing/delivery-fee-calculator';
import { TAX_CALCULATOR, type TaxCalculator } from './pricing/tax-calculator';
import {
  CART_REPOSITORY,
  type CartRepository,
  type CartWithItems,
} from './repositories/cart.repository';

import type { CreateCartItemDto } from './dto/create-cart-item.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';
import type { CartDto, CartSummaryDto } from '@dripplex/types';
import type { CartItem } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepository,
    @Inject(COUPON_ENGINE)
    private readonly couponEngine: CouponEngine,
    @Inject(TAX_CALCULATOR)
    private readonly taxCalculator: TaxCalculator,
    @Inject(DELIVERY_FEE_CALCULATOR)
    private readonly deliveryFeeCalculator: DeliveryFeeCalculator,
    @Inject(INVENTORY_VALIDATOR)
    private readonly inventoryValidator: InventoryValidator,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  public async getActiveCart(customerId: string): Promise<CartDto | null> {
    const cart = await this.cartRepository.findActiveByCustomerId(customerId);
    return cart ? toCartDto(cart) : null;
  }

  public async addItem(
    customerId: string,
    dto: CreateCartItemDto,
    context: AuditContext,
  ): Promise<CartDto> {
    await this.validateMerchant(dto.merchantId);

    const availability = await this.inventoryValidator.validateAvailability({
      merchantId: dto.merchantId,
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      quantity: dto.quantity,
    });
    if (!availability.available) {
      throw new ValidationDomainException(availability.reason ?? 'Product is not available');
    }

    let cart = await this.cartRepository.findActiveByCustomerId(customerId);
    let created = false;

    if (!cart) {
      cart = await this.cartRepository.createCart({
        customerId,
        merchantId: dto.merchantId,
        currency: (dto.currency ?? CART_CURRENCY_DEFAULT).toUpperCase(),
      });
      created = true;
      await this.auditService.record(
        CART_AUDIT_ACTIONS.CREATED,
        { ...context, userId: customerId },
        {
          resource: 'cart',
          resourceId: cart.id,
          metadata: { merchantId: dto.merchantId },
        },
      );
    } else if (cart.merchantId !== dto.merchantId) {
      throw new CartMerchantConflictDomainException(
        'Cart already contains items from a different merchant',
        {
          cartMerchantId: cart.merchantId,
          requestedMerchantId: dto.merchantId,
        },
      );
    }

    const variantId = dto.variantId ?? null;
    const existing = await this.cartRepository.findDuplicateItem(cart.id, dto.productId, variantId);

    if (existing) {
      const quantity = existing.quantity + dto.quantity;
      const unitPrice = Number(existing.unitPriceSnapshot);
      await this.cartRepository.updateItem(existing.id, {
        quantity,
        subtotal: roundMoney(unitPrice * quantity),
      });
      await this.auditService.record(
        CART_AUDIT_ACTIONS.ITEM_UPDATED,
        { ...context, userId: customerId },
        {
          resource: 'cart_item',
          resourceId: existing.id,
          metadata: { merged: true, quantity },
        },
      );
    } else {
      const unitPrice = roundMoney(dto.unitPrice);
      const item = await this.cartRepository.addItem({
        cartId: cart.id,
        productId: dto.productId,
        variantId,
        productNameSnapshot: dto.productName.trim(),
        skuSnapshot: dto.sku?.trim() ?? null,
        imageSnapshot: dto.imageUrl ?? null,
        unitPriceSnapshot: unitPrice,
        quantity: dto.quantity,
        subtotal: roundMoney(unitPrice * dto.quantity),
      });
      await this.auditService.record(
        CART_AUDIT_ACTIONS.ITEM_ADDED,
        { ...context, userId: customerId },
        {
          resource: 'cart_item',
          resourceId: item.id,
          metadata: { productId: dto.productId, quantity: dto.quantity },
        },
      );
    }

    const recalculated = await this.recalculateInternal(cart.id, customerId, context, !created);
    return recalculated;
  }

  public async updateItem(
    customerId: string,
    itemId: string,
    dto: UpdateCartItemDto,
    context: AuditContext,
  ): Promise<CartDto> {
    const cart = await this.requireActiveCart(customerId);
    const item = await this.requireOwnedItem(cart, itemId);

    const availability = await this.inventoryValidator.validateAvailability({
      merchantId: cart.merchantId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: dto.quantity,
    });
    if (!availability.available) {
      throw new ValidationDomainException(availability.reason ?? 'Product is not available');
    }

    const unitPrice = Number(item.unitPriceSnapshot);
    await this.cartRepository.updateItem(item.id, {
      quantity: dto.quantity,
      subtotal: roundMoney(unitPrice * dto.quantity),
    });

    await this.auditService.record(
      CART_AUDIT_ACTIONS.ITEM_UPDATED,
      { ...context, userId: customerId },
      {
        resource: 'cart_item',
        resourceId: item.id,
        metadata: { quantity: dto.quantity },
      },
    );

    return await this.recalculateInternal(cart.id, customerId, context, true);
  }

  public async removeItem(
    customerId: string,
    itemId: string,
    context: AuditContext,
  ): Promise<CartDto> {
    const cart = await this.requireActiveCart(customerId);
    await this.requireOwnedItem(cart, itemId);
    await this.cartRepository.removeItem(itemId);

    await this.auditService.record(
      CART_AUDIT_ACTIONS.ITEM_REMOVED,
      { ...context, userId: customerId },
      {
        resource: 'cart_item',
        resourceId: itemId,
      },
    );

    const remaining = await this.cartRepository.findById(cart.id);
    if (remaining?.items.length === 0) {
      await this.cartRepository.updateTotals(cart.id, {
        subtotal: 0,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total: 0,
      });
      await this.cartRepository.updateStatus(cart.id, CartStatus.ABANDONED);
      const abandoned = await this.cartRepository.findById(cart.id);
      if (!abandoned) {
        throw new NotFoundDomainException('Cart not found after clear');
      }
      return toCartDto(abandoned);
    }

    return await this.recalculateInternal(cart.id, customerId, context, true);
  }

  public async clearCart(customerId: string, context: AuditContext): Promise<CartSummaryDto> {
    const cart = await this.cartRepository.findActiveByCustomerId(customerId);
    if (!cart) {
      return { cleared: true, cartId: null };
    }

    await this.cartRepository.clearItems(cart.id);
    await this.cartRepository.updateTotals(cart.id, {
      subtotal: 0,
      discount: 0,
      tax: 0,
      deliveryFee: 0,
      total: 0,
    });
    await this.cartRepository.updateStatus(cart.id, CartStatus.ABANDONED);

    await this.auditService.record(
      CART_AUDIT_ACTIONS.CLEARED,
      { ...context, userId: customerId },
      {
        resource: 'cart',
        resourceId: cart.id,
      },
    );

    return { cleared: true, cartId: cart.id };
  }

  public async recalculate(customerId: string, context: AuditContext): Promise<CartDto> {
    const cart = await this.requireActiveCart(customerId);
    return await this.recalculateInternal(cart.id, customerId, context, true);
  }

  public async getCheckoutEligibility(customerId: string): Promise<{
    eligible: boolean;
    reasons: string[];
  }> {
    const cart = await this.cartRepository.findActiveByCustomerId(customerId);
    const reasons: string[] = [];
    if (!cart) {
      reasons.push('No active cart');
      return { eligible: false, reasons };
    }
    if (cart.items.length === 0) {
      reasons.push('Cart is empty');
    }
    try {
      await this.validateMerchant(cart.merchantId);
    } catch {
      reasons.push('Merchant is not available');
    }
    for (const item of cart.items) {
      const availability = await this.inventoryValidator.validateAvailability({
        merchantId: cart.merchantId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
      if (!availability.available) {
        reasons.push(`Item ${item.productId} is unavailable`);
      }
    }
    return { eligible: reasons.length === 0, reasons };
  }

  private async recalculateInternal(
    cartId: string,
    customerId: string,
    context: AuditContext,
    emitAudit: boolean,
  ): Promise<CartDto> {
    const cart = await this.cartRepository.findById(cartId);
    if (!cart) {
      throw new NotFoundDomainException('Cart not found');
    }

    const subtotal = roundMoney(cart.items.reduce((sum, item) => sum + Number(item.subtotal), 0));

    const discount = roundMoney(
      await this.couponEngine.applyDiscount({
        customerId,
        merchantId: cart.merchantId,
        subtotal,
        currency: cart.currency,
      }),
    );

    const tax = roundMoney(
      await this.taxCalculator.calculateTax({
        subtotal,
        discount,
        currency: cart.currency,
        country: 'NG',
      }),
    );

    const deliveryFee =
      cart.items.length === 0
        ? 0
        : roundMoney(
            await this.deliveryFeeCalculator.calculateFee({
              merchantId: cart.merchantId,
              customerId,
              subtotal,
              currency: cart.currency,
            }),
          );

    const total = roundMoney(Math.max(0, subtotal - discount + tax + deliveryFee));

    await this.cartRepository.updateTotals(cartId, {
      subtotal,
      discount,
      tax,
      deliveryFee,
      total,
    });

    if (emitAudit) {
      await this.auditService.record(
        CART_AUDIT_ACTIONS.RECALCULATED,
        { ...context, userId: customerId },
        {
          resource: 'cart',
          resourceId: cartId,
          metadata: { subtotal, discount, tax, deliveryFee, total },
        },
      );
    }

    const refreshed = await this.cartRepository.findById(cartId);
    if (!refreshed) {
      throw new NotFoundDomainException('Cart not found after recalculation');
    }
    return toCartDto(refreshed);
  }

  private async requireActiveCart(customerId: string): Promise<CartWithItems> {
    const cart = await this.cartRepository.findActiveByCustomerId(customerId);
    if (!cart) {
      throw new NotFoundDomainException('Active cart not found');
    }
    return cart;
  }

  private async requireOwnedItem(cart: CartWithItems, itemId: string): Promise<CartItem> {
    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) {
      const loaded = await this.cartRepository.findItemById(itemId);
      if (loaded?.cartId !== cart.id) {
        throw new NotFoundDomainException('Cart item not found');
      }
      return loaded;
    }
    return item;
  }

  private async validateMerchant(merchantId: string): Promise<void> {
    const profile = await this.prisma.merchantProfile.findFirst({
      where: { userId: merchantId, deletedAt: null },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant not found');
    }
    if (profile.status === MerchantStatus.SUSPENDED || profile.status === MerchantStatus.REJECTED) {
      throw new ValidationDomainException('Merchant is not available for ordering');
    }
  }
}
