import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from '../../user-settings/user-settings.service';

@Injectable()
export class LipSyncEnabledGuard implements CanActivate {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enabled = await this.userSettingsService.isLipSyncEnabled(req.user.userId);
    if (!enabled) {
      throw new ForbiddenException('Lip Sync is not enabled for your account.');
    }
    return true;
  }
}
