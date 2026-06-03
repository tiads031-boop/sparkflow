import { IsString, IsNotEmpty } from 'class-validator';

export class AuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
