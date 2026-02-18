import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '../../entities/admin-user.entity';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'newadmin@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: AdminRole, default: AdminRole.ADMIN })
  @IsEnum(AdminRole)
  role: AdminRole;
}
