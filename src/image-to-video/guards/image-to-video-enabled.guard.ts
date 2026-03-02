import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserSettingsService } from '../../user-settings/user-settings.service';

@Injectable()
export class ImageToVideoEnabledGuard implements CanActivate {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const enabled = await this.userSettingsService.isImageToVideoEnabled(req.user.userId);
    if (!enabled) {
      throw new ForbiddenException('Image to Video is not enabled for your account.');
    }
    return true;
  }
}
