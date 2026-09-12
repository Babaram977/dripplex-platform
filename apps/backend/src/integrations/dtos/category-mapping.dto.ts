import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Create or replace one external-category → DrippleX-category mapping.
 *
 * There is no separate create and update: `(integrationId, externalCategoryName)`
 * is unique, and a merchant re-pointing "Fast Food" at a different category is
 * the same operation as mapping it for the first time. Making the endpoint
 * idempotent means a console that retries, or a merchant who submits twice,
 * cannot produce a duplicate-key error for what is not an error.
 */
export class UpsertCategoryMappingDto {
  /**
   * The category name exactly as the POS spells it. Matched verbatim against
   * the payload at ingestion time, so "Fast Food" and "fast food" are two
   * different mappings — the POS's spelling is the key, and normalising it here
   * would silently stop matching what the POS actually sends.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public readonly externalCategoryName!: string;

  /** An existing DrippleX category. A POS may never create one. */
  @IsUUID()
  public readonly categoryId!: string;
}
