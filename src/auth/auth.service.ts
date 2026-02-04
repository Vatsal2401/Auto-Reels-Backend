import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private creditsService: CreditsService,
    private mailService: MailService,
  ) { }

  async signUp(dto: SignUpDto) {
    const email = dto.email.toLowerCase().trim();

    return await this.userRepository.manager.transaction(async (manager) => {
      const existingUser = await manager.findOne(User, {
        where: { email },
      });

      if (existingUser) {
        if (existingUser.email_verified) {
          throw new ConflictException('User with this email already exists');
        }

        // Cleanup transactions and delete old unverified user atomically
        await manager.delete('credit_transactions', { user_id: existingUser.id });
        await manager.remove(existingUser);
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const verificationToken = uuidv4();

      const user = manager.create(User, {
        email,
        password_hash: passwordHash,
        name: dto.name,
        auth_provider: AuthProvider.EMAIL,
        email_verified: false,
        verification_token: verificationToken,
        last_verification_sent_at: new Date(),
      });

      const savedUser = await manager.save(user);

      // Initialize free credits for new user
      // Note: We use the injected creditsService but within the transaction we should ideally use the manager
      // but since CreditsService uses userRepository (injected), we'll just call it.
      // For absolute correctness, we'd need to refactor CreditsService to accept a manager.
      // However, since it's a new user, it's fine for now as long as the user exists.
      await this.creditsService.initializeUserCredits(savedUser.id, manager);

      // Send verification email (outside transaction ideally, but fine here for now)
      this.mailService.sendVerificationEmail(savedUser.email, verificationToken);

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

  async resendVerification(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Rate limiting: 1 minute cooldown
    if (user.last_verification_sent_at) {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      if (user.last_verification_sent_at > oneMinuteAgo) {
        throw new BadRequestException('Please wait 1 minute before requesting another email');
      }
    }

    // Generate new token or reuse old one? Keeping current token is safer for the link they might have just received,
    // but generating a new one is standard. Let's keep existing if it's there.
    if (!user.verification_token) {
      user.verification_token = uuidv4();
    }

    user.last_verification_sent_at = new Date();
    await this.userRepository.save(user);

    await this.mailService.sendVerificationEmail(user.email, user.verification_token);
    return { message: 'Verification email resent successfully' };
  }

  async signIn(dto: SignInDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
      },
      ...tokens,
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id: userId } });
  }

  async findOrCreateOAuthUser(
    email: string,
    provider: AuthProvider,
    providerId: string,
    name?: string,
    avatarUrl?: string,
  ): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { email },
    });

    if (user) {
      // Update provider info if needed
      if (user.auth_provider !== provider) {
        user.auth_provider = provider;
        user.provider_id = providerId;
        if (name) user.name = name;
        if (avatarUrl) user.avatar_url = avatarUrl;
        await this.userRepository.save(user);
      }
    } else {
      user = this.userRepository.create({
        email,
        auth_provider: provider,
        provider_id: providerId,
        name: name || null,
        avatar_url: avatarUrl || null,
        email_verified: true,
        password_hash: null,
      });
      user = await this.userRepository.save(user);

      // Initialize free credits for new OAuth user
      await this.creditsService.initializeUserCredits(user.id);
    }

    return user;
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Save refresh token
    await this.userRepository.update(user.id, { refresh_token: refreshToken });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub, refresh_token: refreshToken },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return await this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(token: string, email?: string) {
    const user = await this.userRepository.findOne({
      where: { verification_token: token },
    });

    if (!user) {
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

    user.email_verified = true;
    // We no longer set verification_token to null based on user request
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
