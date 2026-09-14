import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * An optional note attached to a conflict acknowledgement.
 *
 * Bounded on purpose. `IntegrationConflict.resolution` is a column a merchant
 * can write into, so the audit value is guaranteed by a fixed prefix the
 * service supplies and the free text is capped — rather than letting arbitrary
 * merchant input define what the record says.
 */
export class AcknowledgeConflictDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public readonly note?: string;
}
