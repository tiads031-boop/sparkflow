import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CredentialsDto {
  @IsIn(['nickname', 'email'])
  method!: 'nickname' | 'email';

  @IsString()
  @MinLength(2)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}
