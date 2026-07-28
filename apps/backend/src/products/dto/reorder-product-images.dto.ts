import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderProductImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  public imageIds!: string[];
}
