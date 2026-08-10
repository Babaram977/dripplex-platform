// DPX-REVIEWS-001 — fixed preset rating tags, mirrored from the backend
// (@dripplex/types REVIEW_TAGS / DRIVER_RATING_TAGS). Kept identical so the
// chips a user picks always validate server-side. The super-app is a
// standalone Figma-Make app with no @dripplex/types dependency, so these are
// duplicated here by design.

export const DRIVER_RATING_TAGS: readonly string[] = [
  'Safe driving',
  'Clean vehicle',
  'Polite',
  'On time',
  'Great conversation',
  'Helped with bags',
];

export const RIDER_RATING_TAGS: readonly string[] = [
  'On time',
  'Careful with items',
  'Polite',
  'Good communication',
];
