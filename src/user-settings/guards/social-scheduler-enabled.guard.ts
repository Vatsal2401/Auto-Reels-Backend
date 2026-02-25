import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from '../user-settings.service';

@Injectable()
export class SocialSchedulerEnabledGuard implements CanActivate {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enabled = await this.userSettingsService.isSocialSchedulerEnabled(req.user.userId);
    if (!enabled) {
      throw new ForbiddenException('Social Media Scheduler is not enabled for your account.');
    }
    return true;
  }
}
