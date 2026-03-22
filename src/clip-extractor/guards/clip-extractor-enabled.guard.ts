import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from '../../user-settings/user-settings.service';

@Injectable()
export class ClipExtractorEnabledGuard implements CanActivate {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enabled = await this.userSettingsService.isClipExtractorEnabled(req.user.userId);
    if (!enabled) {
      throw new ForbiddenException('Clip Extractor is not enabled for your account.');
    }
    return true;
  }
}
