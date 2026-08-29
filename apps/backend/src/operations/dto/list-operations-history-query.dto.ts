import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * DPX-OPS — shared filters for all four history endpoints.
 *
 * One shape across rides, deliveries, orders and utility purchases, because an
 * operator answering a dispute or a police enquiry asks the same three
 * questions of each: when, what state, and who. Making them differ per domain
 * would mean re-learning the screen four times.
 *
 * `status` is a plain string, validated by each endpoint against its own enum.
 * Typing it here would need four DTOs to say one thing, and an unknown status
 * has to be rejected with a message naming the domain either way.
 *
 * The date range is optional, unlike the analytics endpoints, which require it.
 * Analytics answers "how did last week go", so a range is inherent. History
 * answers "find me this record", and a founder chasing one disputed trip
 * should not have to guess which week it fell in before they can search.
 */
export class ListOperationsHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  public from?: string;

  @IsOptional()
  @IsDateString()
  public to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  public status?: string;

  /**
   * Matches the record's own id and the names, phones and emails of everyone
   * on it. A security enquiry arrives as a phone number or a name, never as a
   * UUID, so searching only by id would answer none of them.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  /**
   * Capped at 100. These rows carry personal data and join several tables;
   * an uncapped limit is both a slow query and a bulk export of customer
   * records through a screen meant for looking at one case.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;
}
