import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { CreditsModule } from '../credits/credits.module';
import { MailService } from './mail.service';

// Factory functions to conditionally provide OAuth strategies
const createOAuthProviders = () => {
  const providers: any[] = [JwtStrategy];

  // Only include GoogleStrategy if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleStrategy);
  }

  // Only include MicrosoftStrategy if credentials are provided
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    providers.push(MicrosoftStrategy);
  }

  return providers;
};

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    CreditsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, ...createOAuthProviders()],
  exports: [AuthService],
})
export class AuthModule {}
