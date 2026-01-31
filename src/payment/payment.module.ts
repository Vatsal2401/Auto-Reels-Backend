import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { CreditsModule } from '../credits/credits.module';
import { User } from '../auth/entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        CreditsModule
    ],
    controllers: [PaymentController],
    providers: [PaymentService],
})
export class PaymentModule { }
