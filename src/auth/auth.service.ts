import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from './entities/user.entity';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { CreditsService } from '../credits/credits.service';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';

// AuthService — user registration, login, OAuth, JWT tokens manage કરે છે
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private creditsService: CreditsService,
    private mailService: MailService,
    private eventEmitter: EventEmitter2,
  ) {}

  // નવો user email/password થી register કરે
  async signUp(dto: SignUpDto) {
    const email = dto.email.toLowerCase().trim();

    // transaction: user create + credits initialize atomically
    return await this.userRepository.manager.transaction(async (manager) => {
      const existingUser = await manager.findOne(User, { where: { email } });

      if (existingUser) {
        if (existingUser.email_verified) {
          // verified user already exist — error throw
          throw new ConflictException('User with this email already exists');
        }
        // unverified user હોય તો delete કરીને fresh signup allow
        await manager.delete('credit_transactions', { user_id: existingUser.id });
        await manager.remove(existingUser);
      }

      // password hash કરો (bcrypt, 10 rounds)
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const verificationToken = uuidv4(); // email verify link ટોકન

      const user = manager.create(User, {
        email,
        password_hash: passwordHash,
        name: dto.name,
        auth_provider: AuthProvider.EMAIL,
        email_verified: false, // email verify pending
        verification_token: verificationToken,
        last_verification_sent_at: new Date(),
        country: dto.country,
        phone_number: dto.phoneNumber ?? null,
      });

      const savedUser = await manager.save(user);

      // નવા user ને free credits initialize
      await this.creditsService.initializeUserCredits(savedUser.id, manager);

      // verification email send (async — transaction wait ન કરે)
      this.mailService.sendVerificationEmail(savedUser.email, verificationToken);

      // signup event emit — notifications/analytics માટે
      this.eventEmitter.emit('user.signup', {
        email: savedUser.email,
        country: savedUser.country,
        method: 'email',
      });

      // JWT tokens generate (access: 15min, refresh: 7days)
      const tokens = await this.generateTokens(savedUser);

      return {
        user: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
          email_verified: savedUser.email_verified,
        },
        ...tokens,
      };
    });
  }

  // verification email ફરીથી send કરે (rate limit: 1 min cooldown)
  async resendVerification(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.email_verified) throw new BadRequestException('Email is already verified');

    // 1 minute cooldown check
    if (user.last_verification_sent_at) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      if (user.last_verification_sent_at > oneMinuteAgo) {
        throw new BadRequestException('Please wait 1 minute before requesting another email');
      }
    }

    // existing token reuse (user ને already link ગયો હોઈ શકે)
    if (!user.verification_token) {
      user.verification_token = uuidv4();
    }

    user.last_verification_sent_at = new Date();
    await this.userRepository.save(user);
    await this.mailService.sendVerificationEmail(user.email, user.verification_token);

    return { message: 'Verification email resent successfully' };
  }

  // email + password verify કરીને login
  async signIn(dto: SignInDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email } });

    // user ન મળ્યો અથવા password hash ન હોય
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // bcrypt વડે password compare
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user);
    return {
      user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified },
      ...tokens,
    };
  }

  // JWT guard — userId ના based user validate (protect routes)
  async validateUser(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id: userId } });
  }

  // Google OAuth user ને find અથવા create કરે
  async findOrCreateOAuthUser(
    email: string,
    provider: AuthProvider,
    providerId: string,
    name?: string,
    avatarUrl?: string,
  ): Promise<User> {
    let user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      // existing user — provider info update (same email, different OAuth provider)
      if (user.auth_provider !== provider) {
        user.auth_provider = provider;
        user.provider_id = providerId;
        if (name) user.name = name;
        if (avatarUrl) user.avatar_url = avatarUrl;
        await this.userRepository.save(user);
      }
    } else {
      // નવો OAuth user create — email already verified ગણો
      user = this.userRepository.create({
        email,
        auth_provider: provider,
        provider_id: providerId,
        name: name || null,
        avatar_url: avatarUrl || null,
        email_verified: true, // Google email trusted
        password_hash: null,  // OAuth user ને password નથી
      });
      user = await this.userRepository.save(user);

      await this.creditsService.initializeUserCredits(user.id);

      this.eventEmitter.emit('user.signup', {
        email: user.email,
        country: null,
        method: provider.toLowerCase(),
      });
    }

    return user;
  }

  // access token (15min) + refresh token (7days) generate કરે
  async generateTokens(user: User) {
    try {
      const payload = { sub: user.id, email: user.email };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

      // refresh token DB માં hashed save (validate refresh time)
      await this.userRepository.update(user.id, { refresh_token: hashedRefreshToken });

      return { access_token: accessToken, refresh_token: refreshToken };
    } catch (error) {
      this.logger.error(`generateTokens.error.${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException('Unable to complete authentication');
    }
  }

  // refresh token verify કરીને નવા tokens issue
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.refresh_token) throw new UnauthorizedException('Invalid refresh token');

      const storedToken = user.refresh_token;
      const isHashedToken = storedToken.startsWith('$2a$') || storedToken.startsWith('$2b$');
      const isRefreshTokenValid = isHashedToken
        ? await bcrypt.compare(refreshToken, storedToken)
        : storedToken === refreshToken;

      if (!isRefreshTokenValid) throw new UnauthorizedException('Invalid refresh token');

      return await this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // user ના country update (OAuth callback વખતે)
  async updateUserCountry(userId: string, country: string): Promise<void> {
    await this.userRepository.update(userId, { country });
  }

  // user ના phone number update (Google OAuth users માટે phone step)
  async updateUserPhone(userId: string, phoneNumber: string): Promise<void> {
    await this.userRepository.update(userId, { phone_number: phoneNumber });
  }

  // email verification link ક્લિક થાય ત્યારે email verify
  async verifyEmail(token: string, email?: string) {
    const user = await this.userRepository.findOne({
      where: { verification_token: token },
    });

    if (!user) {
      // token ન મળ્યો — email ના based already verified check
      if (email) {
        const targetEmail = email.toLowerCase().trim();
        const existingUser = await this.userRepository.findOne({
          where: { email: targetEmail },
        });

        if (existingUser && existingUser.email_verified) {
          const tokens = await this.generateTokens(existingUser);
          return {
            message: 'Email already verified',
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              email_verified: existingUser.email_verified,
            },
            ...tokens,
          };
        }
      }
      throw new BadRequestException('Invalid or expired verification token');
    }

    // email verified mark કરો
    user.email_verified = true;
    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);

    return {
      message: 'Email verified successfully',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        email_verified: savedUser.email_verified,
      },
      ...tokens,
    };
  }
}
