import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.adminUserRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(admin);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const secret =
      this.configService.get<string>('ADMIN_JWT_SECRET') || 'admin-secret-change-in-production';

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.adminUserRepository.findOne({
      where: { id: payload.sub },
    });

    if (!admin || !admin.refresh_token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, admin.refresh_token);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(admin);
  }

  private async generateTokens(admin: AdminUser) {
    const secret =
      this.configService.get<string>('ADMIN_JWT_SECRET') || 'admin-secret-change-in-production';
    const payload = { sub: admin.id, email: admin.email, role: admin.role, type: 'admin' };

    const accessToken = this.jwtService.sign(payload, { secret, expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { secret, expiresIn: '7d' });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.adminUserRepository.update(admin.id, { refresh_token: hashedRefreshToken });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
