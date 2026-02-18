import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { CreditTransaction } from '../../credits/entities/credit-transaction.entity';
import { AdminImpersonationLog } from '../entities/admin-impersonation-log.entity';
import { CreditsModule } from '../../credits/credits.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Project, CreditTransaction, AdminImpersonationLog]),
    JwtModule.register({}),
    ConfigModule,
    CreditsModule,
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
