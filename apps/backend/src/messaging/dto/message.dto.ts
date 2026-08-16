import { IsString, MaxLength, MinLength } from 'class-validator';

import { MESSAGE_MAX_LENGTH } from '../messaging.constants';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  public body!: string;
}
