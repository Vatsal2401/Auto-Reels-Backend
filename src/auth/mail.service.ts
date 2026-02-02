import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = Number(this.configService.get('SMTP_PORT'));
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');
    const smtpSecure = this.configService.get('SMTP_SECURE') === 'true';

    this.logger.log(`Initializing SMTP for ${smtpUser}...`);

    const config: any = {
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // High stability timeouts for cloud environments
      connectionTimeout: 20000, // 20 seconds
      greetingTimeout: 20000,
      socketTimeout: 60000, // 60 seconds for sending

      // Gmail stability settings
      pool: false, // Disable pooling for cloud stability
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      // Enable detailed SMTP logs in the console
      debug: true,
      logger: true,
    };

    // FORCE Port 465 + SSL for Gmail in production (most reliable bypass)
    if (smtpHost?.toLowerCase().includes('gmail.com')) {
      config.host = 'smtp.gmail.com';
      config.port = 465;
      config.secure = true;
    } else {
      config.host = smtpHost;
      config.port = smtpPort;
      config.secure = smtpSecure;
    }

    this.transporter = nodemailer.createTransport(config);

    // Removed verify() on startup to avoid blocking or hanging initialization
  }

  async sendVerificationEmail(email: string, token: string, retries = 3) {
    this.logger.log(`Attempting to send verification email to: ${email}`);
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from:
        this.configService.get('SMTP_FROM') ||
        `"AI Reels" <${this.configService.get('SMTP_USER')}>`,
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

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(
          `Mail options (attempt ${attempt}/${retries}): ${JSON.stringify({ from: mailOptions.from, to: mailOptions.to, subject: mailOptions.subject })}`,
        );
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`Verification email sent successfully to ${email} (attempt ${attempt}).`);
        this.logger.log(`MessageId: ${info.messageId}`);
        return; // Success, exit the loop
      } catch (error) {
        this.logger.error(
          `Attempt ${attempt}/${retries} failed to send verification email to ${email}`,
          error,
        );
        if (attempt === retries) {
          this.logger.error(`Final attempt failed. Verification email not sent.`);
        } else {
          const delay = attempt * 2000;
          this.logger.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }
}
