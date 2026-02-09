import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SlackService } from './slack.service';
import { MailService } from '../mail/mail.service';

export class UserSignupEvent {
  email: string;
  country?: string;
  method: string;
}

export class PaymentSuccessEvent {
  userId: string;
  email: string;
  amount: number;
  currency: string;
  planName: string;
  orderId: string;
  paymentId: string;
}

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private slackService: SlackService,
    private mailService: MailService,
  ) {}

  @OnEvent('user.signup', { async: true })
  async handleUserSignupEvent(event: UserSignupEvent) {
    this.logger.debug(`Received user.signup event for: ${event.email}`);
    await this.slackService.sendSignupNotification(event);
  }

  @OnEvent('payment.success', { async: true })
  async handlePaymentSuccessEvent(event: PaymentSuccessEvent) {
    this.logger.debug(`Received payment.success event for: ${event.email}`);

    // 1. Send Slack notification to admin
    await this.slackService.sendPaymentNotification({
      email: event.email,
      amount: event.amount,
      currency: event.currency,
      planName: event.planName,
      orderId: event.orderId,
    });

    // 2. Send receipt email to user
    const formattedAmount = (event.amount / 100).toFixed(2);
    await this.mailService.sendPaymentSuccessEmail(
      event.email,
      event.planName,
      formattedAmount,
      event.currency,
      event.orderId,
    );
  }
}
