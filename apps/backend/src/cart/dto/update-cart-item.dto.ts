import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(999)
  public quantity!: number;
}
