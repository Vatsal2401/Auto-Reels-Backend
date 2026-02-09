import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { NotificationsListener } from './notifications.listener';

@Module({
  providers: [SlackService, NotificationsListener],
  exports: [SlackService],
})
export class NotificationsModule {}
