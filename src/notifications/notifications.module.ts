import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { NotificationsListener } from './notifications.listener';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [SlackService, NotificationsListener],
  exports: [SlackService],
})
export class NotificationsModule {}
