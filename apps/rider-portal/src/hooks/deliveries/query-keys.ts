/** Centralized so every rider-delivery hook reads/invalidates the same cache. */
export const riderDeliveryKeys = {
  all: ['rider-delivery'] as const,
  jobs: () => [...riderDeliveryKeys.all, 'jobs'] as const,
  availability: () => [...riderDeliveryKeys.all, 'availability'] as const,
};
