import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phoneNumber must be a valid E.164 format (e.g. +919876543210)',
  })
  phoneNumber?: string;
}
