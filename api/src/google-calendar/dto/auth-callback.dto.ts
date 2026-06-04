import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class AuthCallbackDto {
  @IsString()
  @IsOptional()
  error?: string;

  @IsString()
  @IsOptional()
  error_description?: string;

  @IsString()
  @IsOptional()
  error_uri?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((dto: AuthCallbackDto) => !dto.error)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((dto: AuthCallbackDto) => !dto.error)
  state?: string;
}
