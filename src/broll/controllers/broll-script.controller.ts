import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BrollEnabledGuard } from '../guards/broll-enabled.guard';
import { BrollScriptService } from '../services/broll-script.service';
import { CreateScriptDto } from '../dto/create-script.dto';
import { UpdateScriptDto } from '../dto/update-script.dto';
import { RunScriptDto } from '../dto/run-script.dto';
import { OverrideResultDto } from '../dto/override-result.dto';

@ApiTags('broll/scripts')
@ApiBearerAuth()
@Controller('broll/libraries/:id/scripts')
@UseGuards(JwtAuthGuard, BrollEnabledGuard)
export class BrollScriptController {
  constructor(private readonly scriptService: BrollScriptService) {}

  private userId(req: { user?: { userId?: string; id?: string } }): string {
    return req.user?.userId ?? req.user?.id ?? '';
  }

  @Post()
  @ApiOperation({ summary: 'Create a new script in the library' })
  async create(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() dto: CreateScriptDto,
  ) {
    return this.scriptService.createScript(id, this.userId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List scripts in the library' })
  async list(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
  ) {
    return this.scriptService.listScripts(id, this.userId(req));
  }

  @Get(':sid')
  @ApiOperation({ summary: 'Get script with all match results' })
  async getOne(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
  ) {
    return this.scriptService.getScript(id, sid, this.userId(req));
  }

  @Patch(':sid')
  @ApiOperation({ summary: 'Update script name or text' })
  async update(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: UpdateScriptDto,
  ) {
    await this.scriptService.updateScript(id, sid, this.userId(req), dto);
    return { success: true };
  }

  @Delete(':sid')
  @ApiOperation({ summary: 'Delete script and all results' })
  async delete(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
  ) {
    await this.scriptService.deleteScript(id, sid, this.userId(req));
    return { success: true };
  }

  @Post(':sid/run')
  @ApiOperation({ summary: 'Run CLIP match for the script' })
  async run(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: RunScriptDto,
  ) {
    return this.scriptService.runScript(id, sid, this.userId(req), dto);
  }

  @Patch(':sid/results/:lineIndex/override')
  @ApiOperation({ summary: 'Override a matched clip for a specific script line' })
  async override(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Param('lineIndex', ParseIntPipe) lineIndex: number,
    @Body() dto: OverrideResultDto,
  ) {
    await this.scriptService.overrideResult(id, sid, lineIndex, dto, this.userId(req));
    return { success: true };
  }

  @Patch(':sid/results/:lineIndex/lock')
  @ApiOperation({ summary: 'Lock or unlock a match result' })
  async lock(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Param('lineIndex', ParseIntPipe) lineIndex: number,
    @Body() body: { locked: boolean },
  ) {
    await this.scriptService.lockResult(id, sid, lineIndex, body.locked, this.userId(req));
    return { success: true };
  }

  @Get(':sid/export')
  @ApiOperation({ summary: 'Export script matches as CSV, JSON, or EDL' })
  @Header('Content-Disposition', 'attachment')
  async export(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Query('format') format: string,
  ) {
    const fmt = format ?? 'csv';
    const content = await this.scriptService.exportScript(id, sid, fmt, this.userId(req));
    return { content, format: fmt };
  }
}
