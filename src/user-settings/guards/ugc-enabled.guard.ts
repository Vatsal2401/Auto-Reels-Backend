import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from '../user-settings.service';

@Injectable()
export class UgcEnabledGuard implements CanActivate {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enabled = await this.userSettingsService.isUgcEnabled(req.user.userId);
    if (!enabled) {
      throw new ForbiddenException('UGC Video Ads are not enabled for your account.');
    }
    return true;
  }
}
