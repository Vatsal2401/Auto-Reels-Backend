import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../entities/admin-user.entity';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

@Injectable()
export class AdminPanelService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
  ) {}

  async listAdmins() {
    const admins = await this.adminUserRepository.find({
      order: { created_at: 'ASC' },
    });
    return admins.map(({ id, email, role, created_at }) => ({
      id,
      email,
      role,
      createdAt: created_at,
    }));
  }

  async createAdmin(dto: CreateAdminUserDto) {
    const existing = await this.adminUserRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const admin = this.adminUserRepository.create({
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      role: dto.role,
    });

    const saved = await this.adminUserRepository.save(admin);

    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
      createdAt: saved.created_at,
    };
  }
}
