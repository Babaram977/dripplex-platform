export const PRODUCT_PERMISSIONS = {
  MANAGE: 'merchant:products:manage',
} as const;

export const PRODUCT_AUDIT_ACTIONS = {
  CREATED: 'product.created',
  UPDATED: 'product.updated',
  DELETED: 'product.deleted',
  PUBLISHED: 'product.published',
  UNPUBLISHED: 'product.unpublished',
  IMAGE_ADDED: 'product.image_added',
  IMAGE_REMOVED: 'product.image_removed',
  IMAGES_REORDERED: 'product.images_reordered',
  VARIANT_CREATED: 'product.variant_created',
  VARIANT_UPDATED: 'product.variant_updated',
  VARIANT_REMOVED: 'product.variant_removed',
  INVENTORY_UPDATED: 'product.inventory_updated',
} as const;

export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_NAME_MAX_LENGTH = 255;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 4000;
export const PRODUCT_SKU_MAX_LENGTH = 100;
export const PRODUCT_CURRENCY_DEFAULT = 'NGN';
