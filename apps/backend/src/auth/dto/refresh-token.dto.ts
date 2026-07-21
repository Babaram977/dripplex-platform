import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  public refreshToken!: string;
}
