import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddOperationsCaseNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  public note!: string;
}
