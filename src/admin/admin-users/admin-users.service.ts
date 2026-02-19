import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import {
  CreditTransaction,
  TransactionType,
} from '../../credits/entities/credit-transaction.entity';
import { AdminImpersonationLog } from '../entities/admin-impersonation-log.entity';
import { CreditsService } from '../../credits/credits.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateCreditsDto } from './dto/update-credits.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(CreditTransaction)
    private creditTransactionRepository: Repository<CreditTransaction>,
    @InjectRepository(AdminImpersonationLog)
    private impersonationLogRepository: Repository<AdminImpersonationLog>,
    private creditsService: CreditsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async listUsers(dto: ListUsersDto) {
    const { page = 1, limit = 20, search } = dto;
    const offset = (page - 1) * limit;
    const searchParam = search ? `%${search}%` : '%';

    const [results, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT u.id, u.email, u.name, u.credits_balance as "creditsBalance", u.is_premium as "isPremium",
                u.created_at as "createdAt", COUNT(p.id)::int as "totalProjects"
         FROM users u
         LEFT JOIN projects p ON p.user_id = u.id
         WHERE u.email ILIKE $1 OR u.name ILIKE $1
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $2 OFFSET $3`,
        [searchParam, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int as count FROM users WHERE email ILIKE $1 OR name ILIKE $1`,
        [searchParam],
      ),
    ]);

    return {
      data: results,
      total: countResult[0].count,
      page,
      limit,
    };
  }

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [totalProjects, completedProjects] = await Promise.all([
      this.projectRepository.count({ where: { user_id: userId } }),
      this.projectRepository.count({ where: { user_id: userId, status: 'completed' as any } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      credits: user.credits_balance,
      isPremium: user.is_premium,
      createdAt: user.created_at,
      totalProjects,
      completedProjects,
    };
  }

  async getUserProjects(userId: string, page = 1, limit = 20, status?: string) {
    console.log('userId', userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const offset = (page - 1) * limit;

    if (status) {
      const [projects, countResult] = await Promise.all([
        this.dataSource.query(
          `SELECT p.id, p.tool_type as name, p.status, p.created_at as "createdAt", p.updated_at as "updatedAt"
           FROM projects p
           WHERE p.user_id = $1 AND p.status = $2
           ORDER BY p.created_at DESC
           LIMIT $3 OFFSET $4`,
          [userId, status, limit, offset],
        ),
        this.dataSource.query(
          `SELECT COUNT(*)::int as count FROM projects WHERE user_id = $1 AND status = $2`,
          [userId, status],
        ),
      ]);
      return { data: projects, total: countResult[0].count, page, limit };
    }

    const [projects, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT p.id, p.tool_type as name, p.status, p.created_at as "createdAt", p.updated_at as "updatedAt"
         FROM projects p
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int as count FROM projects WHERE user_id = $1`, [
        userId,
      ]),
    ]);

    return { data: projects, total: countResult[0].count, page, limit };
  }

  async updateCredits(userId: string, dto: UpdateCreditsDto, adminId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const delta = dto.credits;
    if (delta === 0) {
      throw new BadRequestException('Credits delta cannot be zero');
    }

    const newBalance = user.credits_balance + delta;
    if (newBalance < 0) {
      throw new BadRequestException('Resulting balance cannot be negative');
    }

    if (delta > 0) {
      await this.creditsService.addCredits(
        userId,
        delta,
        TransactionType.BONUS,
        'Admin adjustment',
        null,
        { adminId },
      );
    } else {
      // Negative delta — bypass balance check (admin is authoritative)
      await this.userRepository.update(userId, { credits_balance: newBalance });

      const transaction = this.creditTransactionRepository.create({
        user_id: userId,
        transaction_type: TransactionType.DEDUCTION,
        amount: delta, // negative value
        balance_after: newBalance,
        description: 'Admin adjustment',
        reference_id: null,
        metadata: { adminId },
      });
      await this.creditTransactionRepository.save(transaction);
    }

    return { userId, newBalance, delta };
  }

  async getStats() {
    const [usersResult, premiumResult, projectsResult, creditsResult] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*)::int as count FROM users`),
      this.dataSource.query(`SELECT COUNT(*)::int as count FROM users WHERE is_premium = true`),
      this.dataSource.query(`SELECT COUNT(*)::int as count FROM projects`),
      this.dataSource.query(
        `SELECT COALESCE(SUM(ABS(amount)), 0)::int as total FROM credit_transactions WHERE amount < 0`,
      ),
    ]);

    return {
      totalUsers: usersResult[0].count,
      premiumUsers: premiumResult[0].count,
      totalProjects: projectsResult[0].count,
      totalCreditsUsed: creditsResult[0].total,
    };
  }

  async impersonateUser(userId: string, adminId: string, ipAddress: string | null) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const jwtSecret =
      this.configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production';

    const payload = {
      sub: user.id,
      email: user.email,
      country: user.country,
      impersonatedByAdminId: adminId,
    };

    const accessToken = this.jwtService.sign(payload, { secret: jwtSecret, expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { secret: jwtSecret, expiresIn: '15m' });

    const log = this.impersonationLogRepository.create({
      admin_id: adminId,
      user_id: userId,
      ip_address: ipAddress,
    });
    await this.impersonationLogRepository.save(log);

    return {
      accessToken,
      refreshToken,
      impersonatedUserId: userId,
    };
  }
}
