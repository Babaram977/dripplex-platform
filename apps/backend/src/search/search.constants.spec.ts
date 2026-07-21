import { SEARCH_AUDIT_ACTIONS, SEARCH_PERMISSIONS } from './search.constants';

describe('search constants', () => {
  it('defines search permission codes', () => {
    expect(SEARCH_PERMISSIONS.USE).toBe('customer:search:use');
    expect(SEARCH_PERMISSIONS.ADMIN_MANAGE).toBe('admin:search:manage');
  });

  it('defines audit action codes', () => {
    expect(SEARCH_AUDIT_ACTIONS.QUERY).toBe('search.query');
    expect(SEARCH_AUDIT_ACTIONS.DOCUMENT_UPSERTED).toBe('search.document.upserted');
  });
});
