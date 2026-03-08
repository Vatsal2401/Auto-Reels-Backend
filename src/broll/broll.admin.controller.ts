import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../admin/guards/admin-role.guard';
import { BrollService } from './broll.service';
import { IngestDto } from './dto/ingest.dto';

@ApiTags('admin/broll')
@ApiBearerAuth()
@Controller('admin/broll')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
export class BrollAdminController {
  constructor(private readonly brollService: BrollService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Start B-roll ingestion pipeline (admin only)' })
  async startIngestion(@Body() dto: IngestDto) {
    return this.brollService.startIngestion(dto);
  }

  @Post('rebuild-index')
  @ApiOperation({ summary: 'Rebuild IVFFlat pgvector index (admin only, run after ingestion)' })
  async rebuildIndex() {
    return this.brollService.rebuildIndex();
  }
}
