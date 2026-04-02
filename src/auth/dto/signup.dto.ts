import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phoneNumber must be a valid E.164 format (e.g. +919876543210)',
  })
  phoneNumber?: string;
}
