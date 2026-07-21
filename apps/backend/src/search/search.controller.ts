import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AutocompleteQueryDto, SearchQueryDto, SuggestionsQueryDto } from './dto/search-query.dto';
import { SEARCH_PERMISSIONS } from './search.constants';
import { SearchService } from './search.service';

import type { SearchResult } from './search.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PopularSearch, RecentSearch } from '@prisma/client';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  @RequirePermissions(SEARCH_PERMISSIONS.USE)
  public async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ): Promise<ApiSuccessResponse<SearchResult>> {
    const data = await this.searchService.search(query, user.id, { userId: user.id });
    return { success: true, data };
  }

  @Get('search/autocomplete')
  @RequirePermissions(SEARCH_PERMISSIONS.USE)
  public async autocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<ApiSuccessResponse<string[]>> {
    const data = await this.searchService.autocomplete(query.q, query.type, query.limit);
    return { success: true, data };
  }

  @Get('search/suggestions')
  @RequirePermissions(SEARCH_PERMISSIONS.USE)
  public async suggestions(
    @Query() query: SuggestionsQueryDto,
  ): Promise<ApiSuccessResponse<string[]>> {
    const data = await this.searchService.suggestions(query.q, query.limit);
    return { success: true, data };
  }

  @Get('search/popular')
  @RequirePermissions(SEARCH_PERMISSIONS.USE)
  public async popular(
    @Query() query: SuggestionsQueryDto,
  ): Promise<ApiSuccessResponse<PopularSearch[]>> {
    const data = await this.searchService.popular(query.limit);
    return { success: true, data };
  }

  @Get('customer/search/recent')
  @RequirePermissions(SEARCH_PERMISSIONS.USE)
  public async recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SuggestionsQueryDto,
  ): Promise<ApiSuccessResponse<RecentSearch[]>> {
    const data = await this.searchService.recent(user.id, query.limit);
    return { success: true, data };
  }
}
