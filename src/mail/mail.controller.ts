import { Controller, Get, Query } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('test-verification')
  async testVerification(@Query('email') email: string, @Query('name') name: string) {
    const targetEmail = email || 'delivered@resend.dev';
    await this.mailService.sendVerificationEmail(targetEmail, 'test-token', name || 'Test User');
    return { message: 'Verification email sent via Resend' };
  }

  @Get('test-render-complete')
  async testRenderComplete(
    @Query('email') email: string,
    @Query('name') name: string,
    @Query('topic') topic: string,
    @Query('url') url: string,
  ) {
    const targetEmail = email || 'delivered@resend.dev';
    await this.mailService.sendRenderCompleteEmail(
      targetEmail,
      url || 'https://example.com/video.mp4',
      topic || 'AI Video Adventures',
      name || 'Test User',
    );
    return { message: 'Render complete email sent via Resend' };
  }
}
