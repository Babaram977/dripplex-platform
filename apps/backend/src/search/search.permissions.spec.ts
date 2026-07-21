import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminSearchController } from './admin-search.controller';
import { SEARCH_PERMISSIONS } from './search.constants';
import { SearchController } from './search.controller';

describe('search controller permissions', () => {
  it('protects customer search endpoints with customer search permission', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SearchController.prototype.search)).toEqual([
      SEARCH_PERMISSIONS.USE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SearchController.prototype.autocomplete)).toEqual([
      SEARCH_PERMISSIONS.USE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SearchController.prototype.recent)).toEqual([
      SEARCH_PERMISSIONS.USE,
    ]);
  });

  it('protects admin search document upsert with admin search permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminSearchController.prototype.upsertDocument),
    ).toEqual([SEARCH_PERMISSIONS.ADMIN_MANAGE]);
  });
});
