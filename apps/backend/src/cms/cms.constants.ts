export const CMS_PERMISSIONS = {
  ADMIN_MANAGE: 'admin:cms:manage',
  CUSTOMER_READ: 'customer:cms:read',
} as const;

export const CMS_AUDIT_ACTIONS = {
  CONTENT_CREATED: 'cms.content.created',
  CONTENT_UPDATED: 'cms.content.updated',
  CONTENT_PUBLISHED: 'cms.content.published',
  CONTENT_SCHEDULED: 'cms.content.scheduled',
  CONTENT_ARCHIVED: 'cms.content.archived',
  CONTENT_DELETED: 'cms.content.deleted',
} as const;
