import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

@ApiTags('Admin')
@ApiBearerAuth('Admin-JWT')
@UseGuards(AdminJwtGuard)
@Controller('admin')
export class AdminStatsController {
  constructor(private adminUsersService: AdminUsersService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide stats for the dashboard' })
  getStats() {
    return this.adminUsersService.getStats();
  }
}
