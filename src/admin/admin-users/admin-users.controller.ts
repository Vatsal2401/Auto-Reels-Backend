import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminRole } from '../entities/admin-user.entity';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateCreditsDto } from './dto/update-credits.dto';

@ApiTags('Admin')
@ApiBearerAuth('Admin-JWT')
@UseGuards(AdminJwtGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination and search' })
  listUsers(@Query() query: ListUsersDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all users as CSV' })
  @ApiQuery({ name: 'search', required: false, type: String })
  async exportUsers(@Query('search') search?: string) {
    const csv = await this.adminUsersService.exportUsers(search);
    return { csv };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.getUserById(id);
  }

  @Get(':id/projects')
  @ApiOperation({ summary: 'Get user projects' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  getUserProjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.adminUsersService.getUserProjects(id, +page, +limit, status);
  }

  @Patch(':id/credits')
  @ApiOperation({ summary: 'Adjust user credits (positive to add, negative to subtract)' })
  updateCredits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditsDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.adminUsersService.updateCredits(id, dto, admin.adminId);
  }

  @Delete(':id')
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a user (super_admin only)' })
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.deleteUser(id);
  }

  @Post(':id/impersonate')
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Impersonate user — generates user-scoped JWT (super_admin only)' })
  impersonateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || null;
    return this.adminUsersService.impersonateUser(id, admin.adminId, ipAddress);
  }
}
