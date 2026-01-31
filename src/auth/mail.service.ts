import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: Number(this.configService.get('SMTP_PORT')),
            secure: this.configService.get('SMTP_SECURE') === 'true',
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            },
        });

        // Verify connection on startup
        this.transporter.verify((error, success) => {
            if (error) {
                this.logger.error('SMTP Connection Error:', error);
            } else {
                this.logger.log('SMTP Server is ready to take our messages');
            }
        });
    }

    async sendVerificationEmail(email: string, token: string) {
        this.logger.log(`Attempting to send verification email to: ${email}`);
        const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
        const verificationUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

        const mailOptions = {
            from: this.configService.get('SMTP_FROM') || `"AI Reels" <${this.configService.get('SMTP_USER')}>`,
            to: email,
            subject: 'Verify your email for AI Reels',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #4f46e5; text-align: center;">Welcome to AI Reels!</h1>
          <p>Thank you for signing up. Please click the button below to verify your email address and get started creating amazing videos!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">If you did not sign up for this account, you can safely ignore this email.</p>
        </div>
      `,
        };

        try {
            this.logger.debug(`Mail options: ${JSON.stringify({ ...mailOptions, html: '...' })}`);
            const info = await this.transporter.sendMail(mailOptions);
            this.logger.log(`Verification email sent successfully to ${email}.`);
            this.logger.log(`MessageId: ${info.messageId}`);
            this.logger.log(`Response: ${info.response}`);
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}`, error);
            // We log but don't throw to avoid crashing the signup process
            // In a real app, we might want to throw or queue this.
        }
    }
}
