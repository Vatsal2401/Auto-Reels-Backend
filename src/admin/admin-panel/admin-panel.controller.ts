import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminPanelService } from './admin-panel.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole } from '../entities/admin-user.entity';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

@ApiTags('Admin')
@ApiBearerAuth('Admin-JWT')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
@AdminRoles(AdminRole.SUPER_ADMIN)
@Controller('admin/admin-users')
export class AdminPanelController {
  constructor(private adminPanelService: AdminPanelService) {}

  @Get()
  @ApiOperation({ summary: 'List all admin users (super_admin only)' })
  listAdmins() {
    return this.adminPanelService.listAdmins();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new admin user (super_admin only)' })
  createAdmin(@Body() dto: CreateAdminUserDto) {
    return this.adminPanelService.createAdmin(dto);
  }
}
