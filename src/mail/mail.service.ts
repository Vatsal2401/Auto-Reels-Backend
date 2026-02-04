import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import VerificationEmail from './templates/verification';
import RenderCompleteEmail from './templates/render-complete';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    if (!this.configService) {
      this.logger.error('ConfigService not injected!');
      return;
    }
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail =
      this.configService.get<string>('SMTP_FROM') || 'AI Reels <onboarding@resend.dev>';

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not defined');
    } else {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend MailService initialized');
    }
  }

  async sendVerificationEmail(email: string, token: string, name?: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      const html = await render(
        React.createElement(VerificationEmail, {
          userFirstname: name,
          verificationUrl,
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Verify your email for AI Reels',
        html,
      });

      if (error) {
        this.logger.error(`Failed to send verification email to ${email}:`, error);
        throw error;
      }

      this.logger.log(`Verification email sent to ${email}. ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error in sendVerificationEmail: ${error.message}`);
      throw error;
    }
  }

  async sendRenderCompleteEmail(email: string, videoUrl: string, topic: string, name?: string) {
    try {
      const html = await render(
        React.createElement(RenderCompleteEmail, {
          userFirstname: name,
          videoUrl,
          topic,
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Your video is ready! - AI Reels',
        html,
      });

      if (error) {
        this.logger.error(`Failed to send render complete email to ${email}:`, error);
        throw error;
      }

      this.logger.log(`Render complete email sent to ${email}. ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error in sendRenderCompleteEmail: ${error.message}`);
      throw error;
    }
  }
}
