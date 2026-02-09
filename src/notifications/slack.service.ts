import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  constructor(private configService: ConfigService) {}

  async sendSignupNotification(data: { email: string; country?: string; method: string }) {
    const webhookUrl = this.configService.get<string>('SLACK_SIGNUP_WEBHOOK');
    if (!webhookUrl) {
      this.logger.warn('SLACK_SIGNUP_WEBHOOK is not configured. Skipping notification.');
      return;
    }

    const { email, country, method } = data;
    const flag = country ? this.getFlagEmoji(country) : '';
    const countryLabel = country ? `${flag} ${country}` : 'Unknown';

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 New AutoReels Signup',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Email:*\n${email}`,
            },
            {
              type: 'mrkdwn',
              text: `*Country:*\n${countryLabel}`,
            },
            {
              type: 'mrkdwn',
              text: `*Method:*\n${method}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    };

    try {
      await axios.post(webhookUrl, payload);
      this.logger.log(`Signup notification sent to Slack for ${email}`);
    } catch (error) {
      this.logger.error('Failed to send Slack signup notification', error.message);
      // Silent failure - do not rethrow to avoid breaking the calling flow
    }
  }

  async sendPaymentNotification(data: {
    email: string;
    amount: number;
    currency: string;
    planName: string;
    orderId: string;
  }) {
    const webhookUrl = this.configService.get<string>('SLACK_SIGNUP_WEBHOOK');
    if (!webhookUrl) return;

    const { email, amount, currency, planName, orderId } = data;
    // Razorpay amounts are usually in paise/cents
    const formattedAmount = (amount / 100).toFixed(2);

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '💰 New Payment Received!',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Plan:* ${planName}\n*Amount:* ${formattedAmount} ${currency}\n*User:* ${email}\n*Order ID:* \`${orderId}\``,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Time: ${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    };

    try {
      await axios.post(webhookUrl, payload);
      this.logger.log(`Payment notification sent to Slack for ${email}`);
    } catch (error) {
      this.logger.error('Failed to send Slack payment notification', error.message);
    }
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const maskedName = name.length > 3 ? `${name.substring(0, 3)}***` : `${name}***`;
    return `${maskedName}@${domain}`;
  }

  private getFlagEmoji(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
}
