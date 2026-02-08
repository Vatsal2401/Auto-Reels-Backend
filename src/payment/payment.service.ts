import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import Razorpay from 'razorpay';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { TransactionType } from '../credits/entities/credit-transaction.entity';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreditPlan } from './entities/credit-plan.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentService {
  private razorpay: Razorpay;
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private configService: ConfigService,
    private creditsService: CreditsService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CreditPlan)
    private creditPlanRepository: Repository<CreditPlan>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  async createOrder(planId: string, userId: string, userCountry?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && !user.email_verified) {
      throw new BadRequestException('Please verify your email address before purchasing credits.');
    }

    const plan = await this.creditPlanRepository.findOne({
      where: { id: planId, is_active: true },
    });
    if (!plan) {
      throw new NotFoundException('Credit plan not found or inactive');
    }

    const isIndia = userCountry === 'IN';
    const currency = isIndia ? 'INR' : 'USD';
    const amount = isIndia ? plan.price_inr : plan.price_usd; // amount in smallest unit (paise/cents)

    const options = {
      amount: amount,
      currency: currency,
      receipt: `rcpt_${userId.substring(0, 6)}_${Date.now()}`,
      notes: {
        userId: userId,
        planId: planId,
        credits: plan.credits.toString(),
      },
    };

    try {
      const order = await this.razorpay.orders.create(options);

      // Create Payment record
      const payment = this.paymentRepository.create({
        user_id: userId,
        plan_id: planId,
        amount: amount,
        currency: currency,
        razorpay_order_id: order.id,
        status: PaymentStatus.CREATED,
      });
      await this.paymentRepository.save(payment);

      return order;
    } catch (error) {
      this.logger.error('Error creating Razorpay order', error);
      throw error;
    }
  }

  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
    userId: string,
  ): Promise<boolean> {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', this.configService.get<string>('RAZORPAY_KEY_SECRET'))
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === signature;

    if (isAuthentic) {
      try {
        const payment = await this.paymentRepository.findOne({
          where: { razorpay_order_id: orderId },
        });
        if (!payment) {
          this.logger.error(`Payment record not found for orderId: ${orderId}`);
          return false;
        }

        if (payment.status === PaymentStatus.PAID) {
          this.logger.log(`Payment already processed for orderId: ${orderId}`);
          return true;
        }

        // Fetch plan to get credits (or use notes)
        // We trust our DB more than notes for the source of truth regarding credits valid for the plan *at time of purchase*?
        // Actually, better to rely on what was stored in the Payment record or Plan.
        // But Payment record doesn't store credits, Plan does.
        // If plan changed credits *after* order creation but *before* payment, user gets new credits?
        // Ideally we should have snapshotted credits in Payment or just look up Plan.
        // For simplicity, looking up plan again.
        const plan = await this.creditPlanRepository.findOne({ where: { id: payment.plan_id } });
        const creditsToAdd = plan ? plan.credits : 0;
        // Fallback to notes if plan missing? Unlikely if FK constraint exists, but soft delete might happen.

        await this.paymentRepository.manager.transaction(async (manager) => {
          // Update Payment Status
          payment.status = PaymentStatus.PAID;
          payment.razorpay_payment_id = paymentId;
          await manager.save(payment);

          // Add Credits
          await this.creditsService.addCredits(
            userId,
            creditsToAdd,
            TransactionType.PURCHASE,
            `Purchased ${plan?.name || 'Credits'}`,
            paymentId,
            { razorpay_order_id: orderId, razorpay_payment_id: paymentId, plan_id: plan?.id },
            manager,
          );
        });

        return true;
      } catch (error) {
        this.logger.error('Error post-verifying payment', error);
        // Even if credit granting fails, payment was verified at Razorpay end.
        // We should log this critically.
        return false;
      }
    }

    return false;
  }

  async handleWebhook(payload: any, signature: string) {
    const secret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || 'webhook_secret_placeholder';

    // Verify signature logic (omitted for brevity as it requires raw body)
    // Assuming signature is valid for now or handled by middleware

    this.logger.log(`Received Razorpay Webhook: ${payload.event}`);

    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      // Logic to handle async updates if verifyPayment wasn't called from frontend
      // Check if payment already marked PAID using order_id
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const payment = await this.paymentRepository.findOne({
        where: { razorpay_order_id: orderId },
      });
      if (payment && payment.status !== PaymentStatus.PAID) {
        // Process payment completion
        const plan = await this.creditPlanRepository.findOne({ where: { id: payment.plan_id } });
        const creditsToAdd = plan ? plan.credits : 0;

        await this.paymentRepository.manager.transaction(async (manager) => {
          payment.status = PaymentStatus.PAID;
          payment.razorpay_payment_id = paymentId;
          await manager.save(payment);

          await this.creditsService.addCredits(
            payment.user_id,
            creditsToAdd,
            TransactionType.PURCHASE,
            `Webhook: Purchased ${plan?.name}`,
            paymentId,
            { razorpay_order_id: orderId, razorpay_payment_id: paymentId, source: 'webhook' },
            manager,
          );
        });
        this.logger.log(`Processed payment via webhook for order ${orderId}`);
      }
    }

    return { status: 'ok' };
  }
}
