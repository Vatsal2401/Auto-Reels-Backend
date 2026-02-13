import { CreditPlan } from './entities/credit-plan.entity';
import { Payment } from './entities/payment.entity';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsModule } from '../credits/credits.module';
import { PaymentService } from './payment.service';
import { User } from '../auth/entities/user.entity';
import { Module } from '@nestjs/common';

@Module({
  imports: [TypeOrmModule.forFeature([User, CreditPlan, Payment]), CreditsModule],
  controllers: [PaymentController, PricingController],
  providers: [PaymentService, PricingService],
})
export class PaymentModule {}
