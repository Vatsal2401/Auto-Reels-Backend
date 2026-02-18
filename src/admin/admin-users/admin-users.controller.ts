import {
  Controller,
  Get,
  Patch,
  Post,
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
