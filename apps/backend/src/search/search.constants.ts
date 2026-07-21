export const SEARCH_PERMISSIONS = {
  USE: 'customer:search:use',
  ADMIN_MANAGE: 'admin:search:manage',
} as const;

export const SEARCH_AUDIT_ACTIONS = {
  QUERY: 'search.query',
  DOCUMENT_UPSERTED: 'search.document.upserted',
} as const;
