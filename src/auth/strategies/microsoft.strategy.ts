import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-microsoft';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../entities/user.entity';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(private authService: AuthService) {
    const clientID = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      throw new Error(
        'Microsoft OAuth credentials are not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/auth/microsoft/callback',
      scope: ['user.read'],
      tenant: 'common',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, displayName, emails, photos } = profile;
    const user = await this.authService.findOrCreateOAuthUser(
      emails[0].value,
      AuthProvider.MICROSOFT,
      id,
      displayName,
      photos?.[0]?.value,
    );

    const tokens = await this.authService.generateTokens(user);

    done(null, { user, tokens });
  }
}
