import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../admin/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../admin/guards/admin-role.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UgcActor } from '../entities/ugc-actor.entity';
import { UgcContentLibrary } from '../entities/ugc-content-library.entity';

class CreateActorDto {
  name: string;
  gender: string;
  age_group: string;
  region: string;
  style: string;
  portrait_s3_key: string;
  preview_s3_key?: string;
  voice_id?: string;
}

class CreateContentLibraryDto {
  title: string;
  s3_key: string;
  clip_type: string;
  category_tags: string[];
  duration_seconds?: number;
  thumbnail_s3_key?: string;
}

@Controller('admin/ugc')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
export class UgcAdminController {
  constructor(
    @InjectRepository(UgcActor)
    private readonly actorRepo: Repository<UgcActor>,
    @InjectRepository(UgcContentLibrary)
    private readonly contentRepo: Repository<UgcContentLibrary>,
  ) {}

  // ─── Actors ───────────────────────────────────────────────────────────────

  @Get('actors')
  async listActors() {
    return this.actorRepo.find({ order: { created_at: 'DESC' } });
  }

  @Post('actors')
  async createActor(@Body() dto: CreateActorDto) {
    const actor = this.actorRepo.create(dto);
    return this.actorRepo.save(actor);
  }

  @Delete('actors/:id')
  async deleteActor(@Param('id', ParseUUIDPipe) id: string) {
    await this.actorRepo.update(id, { is_active: false });
    return { success: true };
  }

  // ─── Content Library ──────────────────────────────────────────────────────

  @Get('library')
  async listLibrary() {
    return this.contentRepo.find({ order: { created_at: 'DESC' } });
  }

  @Post('library')
  async addToLibrary(@Body() dto: CreateContentLibraryDto) {
    const content = this.contentRepo.create({
      ...dto,
      category_tags: dto.category_tags || [],
    } as any);
    return this.contentRepo.save(content);
  }

  @Delete('library/:id')
  async deleteContent(@Param('id', ParseUUIDPipe) id: string) {
    await this.contentRepo.update(id, { is_active: false });
    return { success: true };
  }
}
