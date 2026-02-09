import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SlackService } from './slack.service';

export class UserSignupEvent {
  email: string;
  country?: string;
  method: string;
}

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private slackService: SlackService) {}

  @OnEvent('user.signup', { async: true })
  async handleUserSignupEvent(event: UserSignupEvent) {
    this.logger.debug(`Received user.signup event for: ${event.email}`);
    await this.slackService.sendSignupNotification(event);
  }
}
