import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserNotificationsService } from './user-notifications.service';

@ApiTags('User Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('user-notifications')
@UseGuards(JwtAuthGuard)
export class UserNotificationsController {
  constructor(private readonly service: UserNotificationsService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.service.getForUser(user.userId);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: any) {
    await this.service.markAllRead(user.userId);
    return { success: true };
  }

  @Patch(':id/read')
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    await this.service.markRead(id, user.userId);
    return { success: true };
  }
}
