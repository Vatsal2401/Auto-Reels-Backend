import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { User } from '../auth/entities/user.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, CreditTransaction])],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
