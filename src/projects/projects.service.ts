import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @Inject('IStorageService') private storageService: IStorageService,
  ) {}

  async create(
    toolType: string,
    payload: Record<string, unknown>,
    userId: string | null,
  ): Promise<Project> {
    const { credit_cost: creditCost, ...metadata } = payload as Record<string, unknown> & {
      credit_cost?: number;
    };
    const project = this.projectRepository.create({
      tool_type: toolType,
      user_id: userId,
      status: ProjectStatus.PENDING,
      metadata: Object.keys(metadata).length ? metadata : null,
      credit_cost: typeof creditCost === 'number' ? creditCost : 0,
    });
    return this.projectRepository.save(project);
  }

  async findByUser(userId: string): Promise<(Project & { media_id?: string | null })[]> {
    const rows = await this.projectRepository.manager.query(
      `SELECT p.*, m.id as media_id
       FROM projects p
       LEFT JOIN media m ON m.project_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId],
    );
    return rows.map((row: any) => {
      const { media_id, ...rest } = row;
      return { ...rest, media_id: media_id ?? null };
    });
  }

  async findOne(id: string): Promise<Project & { media_id?: string | null }> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    const out = { ...project } as Project & { media_id?: string | null };
    if (project.tool_type === 'reel') {
      const rows = await this.projectRepository.manager.query(
        'SELECT id FROM media WHERE project_id = $1 LIMIT 1',
        [id],
      );
      out.media_id = rows[0]?.id ?? null;
    }
    return out;
  }

  async updateStatus(
    id: string,
    status: ProjectStatus,
    outputUrl?: string | null,
    errorMessage?: string | null,
  ): Promise<Project> {
    const project = await this.findOne(id);
    project.status = status;
    if (outputUrl !== undefined) project.output_url = outputUrl;
    if (errorMessage !== undefined) project.error_message = errorMessage;
    if (status === ProjectStatus.COMPLETED || status === ProjectStatus.FAILED) {
      project.completed_at = new Date();
    }
    return this.projectRepository.save(project);
  }

  async setOutput(id: string, outputUrl: string, thumbnailUrl?: string | null): Promise<Project> {
    const project = await this.findOne(id);
    project.output_url = outputUrl;
    if (thumbnailUrl !== undefined) project.thumbnail_url = thumbnailUrl;
    project.status = ProjectStatus.COMPLETED;
    project.completed_at = new Date();
    return this.projectRepository.save(project);
  }

  async setMetadata(id: string, metadata: Record<string, unknown>): Promise<Project> {
    const project = await this.findOne(id);
    project.metadata = { ...(project.metadata || {}), ...metadata };
    return this.projectRepository.save(project);
  }

  async getOutputSignedUrl(projectId: string, userId: string): Promise<string | null> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project || project.user_id !== userId || !project.output_url) return null;
    return this.storageService.getSignedUrl(project.output_url, 3600);
  }
}
