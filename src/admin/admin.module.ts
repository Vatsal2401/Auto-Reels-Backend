import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminPanelModule } from './admin-panel/admin-panel.module';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [PassportModule, ConfigModule, AdminAuthModule, AdminUsersModule, AdminPanelModule],
  providers: [AdminJwtStrategy],
})
export class AdminModule {}
