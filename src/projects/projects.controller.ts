import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { KineticTypographyService } from '../kinetic-typography/kinetic-typography.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectStatus } from './entities/project.entity';

interface CreateProjectDto {
  tool_type: string;
  [key: string]: unknown;
}

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly kineticTypographyService: KineticTypographyService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    const { tool_type, ...payload } = dto;
    if (!tool_type || typeof tool_type !== 'string') {
      throw new BadRequestException('tool_type is required');
    }
    const project = await this.projectsService.create(tool_type, payload, req.user.userId);

    if (tool_type === 'kinetic-typography' && project.user_id) {
      await this.projectsService.updateStatus(project.id, ProjectStatus.RENDERING);
      try {
        await this.kineticTypographyService.enqueueRender(
          project.id,
          project.user_id,
          payload as any,
        );
      } catch (err: any) {
        await this.projectsService.updateStatus(
          project.id,
          ProjectStatus.FAILED,
          undefined,
          err?.message,
        );
        throw err;
      }
    }

    return project;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any) {
    return this.projectsService.findByUser(req.user.userId);
  }

  @Get(':id/output-url')
  @UseGuards(JwtAuthGuard)
  async getOutputUrl(@Param('id') id: string, @Req() req: any) {
    const url = await this.projectsService.getOutputSignedUrl(id, req.user.userId);
    if (!url) throw new BadRequestException('Project output not available');
    return { url };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }
}
