import {
  Controller,
  Post,
  Patch,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CreditsService } from '../credits/credits.service';
import { MailService } from '../mail/mail.service';
import { extractClientIp, getCountryFromIp } from '../common/utils/geo.util';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private creditsService: CreditsService,
    private mailService: MailService,
  ) {}

  @Get('test-email')
  @ApiOperation({ summary: 'Test email sending' })
  async testEmail(@Query('email') email: string) {
    const testEmail = email || 'vatsalpatel9393@gmail.com';
    await this.mailService.sendVerificationEmail(testEmail, 'test-token');
    return { message: 'Test email sent' };
  }

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@CurrentUser() user: any) {
    return this.authService.resendVerification(user.userId);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: any) {
    const userEntity = await this.authService.validateUser(user.userId);
    const balance = await this.creditsService.getBalance(user.userId);

    return {
      userId: user.userId,
      email: user.email,
      credits_balance: balance,
      is_premium: userEntity?.is_premium || false,
      email_verified: userEntity?.email_verified || false,
      country: userEntity?.country || null,
    };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify user email' })
  async verifyEmail(@Query('token') token: string, @Query('email') email: string) {
    return this.authService.verifyEmail(token, email);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { user, tokens } = req.user as any;

    // Auto-detect country from IP for OAuth users who don't have one yet
    let needsCountry = false;
    if (!user.country) {
      const ip = extractClientIp(req);
      const detectedCountry = getCountryFromIp(ip);
      if (detectedCountry) {
        await this.authService.updateUserCountry(user.id, detectedCountry);
      } else {
        needsCountry = true; // IP detection failed — frontend will prompt
      }
    }

    const base = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback`;
    const redirectUrl = `${base}?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}${needsCountry ? '&needs_country=true' : ''}`;
    res.redirect(redirectUrl);
  }

  @Patch('me/country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update the current user\'s country' })
  async updateCountry(
    @CurrentUser() user: any,
    @Body('country') country: string,
  ) {
    await this.authService.updateUserCountry(user.userId, country);
    return { country };
  }

  @Get('microsoft')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftAuth() {
    // Initiates Microsoft OAuth flow
  }

  @Get('microsoft/callback')
  @UseGuards(AuthGuard('microsoft'))
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    const { user, tokens } = req.user as any;

    let needsCountry = false;
    if (!user.country) {
      const ip = extractClientIp(req);
      const detectedCountry = getCountryFromIp(ip);
      if (detectedCountry) {
        await this.authService.updateUserCountry(user.id, detectedCountry);
      } else {
        needsCountry = true;
      }
    }

    const base = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/auth/callback`;
    const redirectUrl = `${base}?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}${needsCountry ? '&needs_country=true' : ''}`;
    res.redirect(redirectUrl);
  }
}
