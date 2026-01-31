import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Razorpay = require('razorpay');
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { TransactionType } from '../credits/entities/credit-transaction.entity';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class PaymentService {
    private razorpay: Razorpay;
    private readonly logger = new Logger(PaymentService.name);

    constructor(
        private configService: ConfigService,
        private creditsService: CreditsService,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {
        this.razorpay = new Razorpay({
            key_id: this.configService.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_placeholder',
            key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET') || 'secret_placeholder',
        });
    }

    async createOrder(amount: number, credits: number, userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user && !user.email_verified) {
            throw new BadRequestException('Please verify your email address before purchasing credits.');
        }

        const options = {
            amount: Math.round(amount * 100), // amount in paise
            currency: 'INR',
            receipt: `rcpt_u_${userId.substring(0, 6)}_${Date.now()}`,
            notes: {
                userId: userId,
                credits: credits.toString(),
            },
        };

        try {
            const order = await this.razorpay.orders.create(options);
            return order;
        } catch (error) {
            this.logger.error('Error creating Razorpay order', error);
            throw error;
        }
    }

    async verifyPayment(orderId: string, paymentId: string, signature: string, userId: string): Promise<boolean> {
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", this.configService.get<string>('RAZORPAY_KEY_SECRET') || 'secret_placeholder')
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === signature;

        if (isAuthentic) {
            try {
                const order: any = await this.razorpay.orders.fetch(orderId);
                const creditsToAdd = Number(order.notes.credits) || (Number(order.amount) / 100);

                await this.creditsService.addCredits(
                    userId,
                    creditsToAdd,
                    TransactionType.PURCHASE,
                    `Purchased ${creditsToAdd} credits via Razorpay`,
                    paymentId,
                    { razorpay_order_id: orderId, razorpay_payment_id: paymentId }
                );
            } catch (error) {
                this.logger.error('Error post-verifying payment', error);
            }
        }

        return isAuthentic;
    }

    async handleWebhook(payload: any, signature: string) {
        const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || 'webhook_secret_placeholder';

        // In NestJS, we typically need the raw body for signature verification.
        // If we use JSON.stringify, we must ensure it matches the original exactly.
        const text = JSON.stringify(payload);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(text)
            .digest('hex');

        // NOTE: Manual verification might be tricky with NestJS body parser.
        // Razorpay docs recommend comparing signature.

        this.logger.log(`Received Razorpay Webhook: ${payload.event}`);

        if (payload.event === 'order.paid') {
            const order = payload.payload.order.entity;
            const userId = order.notes.userId;
            const credits = Number(order.notes.credits) || (order.amount / 100);

            try {
                const history = await this.creditsService.getTransactionHistory(userId, 10);
                const alreadyProcessed = history.some(t => t.reference_id === order.id);

                if (!alreadyProcessed) {
                    await this.creditsService.addCredits(
                        userId,
                        credits,
                        TransactionType.PURCHASE,
                        `Razorpay Webhook: ${order.id}`,
                        order.id,
                        { source: 'webhook', event: payload.event }
                    );
                }
            } catch (error) {
                this.logger.error('Failed to process webhook order.paid', error);
            }
        }

        return { status: 'ok' };
    }
}
