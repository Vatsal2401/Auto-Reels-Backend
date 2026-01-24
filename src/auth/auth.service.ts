import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from './entities/user.entity';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private creditsService: CreditsService,
  ) {}

  async signUp(dto: SignUpDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      password_hash: passwordHash,
      name: dto.name,
      auth_provider: AuthProvider.EMAIL,
      email_verified: false,
    });

    const savedUser = await this.userRepository.save(user);
    
    // Initialize free credits for new user
    await this.creditsService.initializeUserCredits(savedUser.id);
    
    const tokens = await this.generateTokens(savedUser);

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
      },
      ...tokens,
    };
  }

  async signIn(dto: SignInDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
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
}
