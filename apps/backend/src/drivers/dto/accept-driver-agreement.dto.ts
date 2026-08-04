import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptDriverAgreementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  public agreementVersion!: string;
}
