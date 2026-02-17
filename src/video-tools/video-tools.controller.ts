import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  PayloadTooLargeException,
  ForbiddenException,
  Req,
  Res,
  Logger,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatus } from '../projects/entities/project.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { MAX_VIDEO_SIZE_BYTES, validateSize, FILE_TOO_LARGE_MESSAGE } from './video-policy';
import { getResizedFilename, getCompressedFilename } from './filename.util';
import { VideoToolsQueueService } from './video-tools-queue.service';
import type { VideoResizeOptions, VideoCompressOptions } from './video-tools-queue.service';

const PRESIGNED_EXPIRES_SEC = 900; // 15 min

const VIDEO_TOOLS_TEMP_PREFIX = 'video-tools-';

function getExt(name: string): string {
  const m = name.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : '.mp4';
}

const multerOptions = {
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: (e: Error | null, p: string) => void) => {
      cb(null, tmpdir());
    },
    filename: (_req: any, file: Express.Multer.File, cb: (e: Error | null, n: string) => void) => {
      cb(null, VIDEO_TOOLS_TEMP_PREFIX + uuidv4() + getExt(file.originalname));
    },
  }),
  limits: { fileSize: MAX_VIDEO_SIZE_BYTES },
};

@Controller('video-tools')
export class VideoToolsController {
  private readonly logger = new Logger(VideoToolsController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    @Inject('IStorageService') private readonly storage: IStorageService,
    private readonly videoToolsQueue: VideoToolsQueueService,
  ) {}

  @Post('resize')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async resize(
    @Req() req: any,
    @Res({ passthrough: false }) res: Response,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.handleUpload(req, res, file, 'video-resize', (options) => {
      const opts = options as VideoResizeOptions;
      return getResizedFilename(file!.originalname, opts.width, opts.height);
    });
  }

  @Post('compress')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async compress(
    @Req() req: any,
    @Res({ passthrough: false }) res: Response,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.handleUpload(req, res, file, 'video-compress', (options) => {
      const opts = options as VideoCompressOptions;
      return getCompressedFilename(file!.originalname, opts.presetLabel);
    });
  }

  /**
   * Request a presigned PUT URL for direct upload to S3.
   * Client uploads file to uploadUrl, then calls start-job with projectId and inputBlobId.
   */
  @Post('request-upload')
  @UseGuards(JwtAuthGuard)
  async requestUpload(
    @Req() req: any,
    @Res({ passthrough: false }) res: Response,
    @Body()
    body: {
      toolType: 'video-resize' | 'video-compress';
      options: VideoResizeOptions | VideoCompressOptions;
      outputFileName: string;
      originalFileName: string;
      fileExtension?: string;
    },
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Unauthorized');

    const { toolType, options, outputFileName, originalFileName, fileExtension = '.mp4' } = body;
    if (!toolType || !outputFileName || !originalFileName) {
      throw new BadRequestException('toolType, outputFileName, originalFileName are required');
    }
    const ext = fileExtension.startsWith('.') ? fileExtension : `.${fileExtension}`;

    const project = await this.projectsService.create(
      toolType,
      { originalFileName, outputFileName, ...options },
      userId,
    );

    let uploadUrl: string;
    let inputBlobId: string;
    try {
      const result = await this.storage.getPresignedPutUrl(
        {
          userId,
          mediaId: project.id,
          type: 'video-tools',
          fileName: 'input' + ext,
        },
        PRESIGNED_EXPIRES_SEC,
        'video/mp4',
      );
      uploadUrl = result.uploadUrl;
      inputBlobId = result.objectId;
    } catch (err: any) {
      await this.projectsService.updateStatus(
        project.id,
        ProjectStatus.FAILED,
        undefined,
        err?.message ?? 'Failed to get upload URL',
      );
      throw err;
    }

    res.status(200);
    return res.json({
      project,
      uploadUrl,
      inputBlobId,
      expiresIn: PRESIGNED_EXPIRES_SEC,
    });
  }

  /**
   * Start processing after client has uploaded file to S3 via presigned URL.
   */
  @Post('start-job')
  @UseGuards(JwtAuthGuard)
  async startJob(
    @Req() req: any,
    @Res({ passthrough: false }) res: Response,
    @Body() body: { projectId: string; inputBlobId: string },
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Unauthorized');
    const { projectId, inputBlobId } = body;
    if (!projectId || !inputBlobId) {
      throw new BadRequestException('projectId and inputBlobId are required');
    }

    const project = await this.projectsService.findOne(projectId);
    if (project.user_id !== userId) {
      throw new ForbiddenException('Project not found or access denied');
    }
    if (project.status !== ProjectStatus.PENDING) {
      throw new BadRequestException(`Project is not pending (status: ${project.status})`);
    }
    if (project.tool_type !== 'video-resize' && project.tool_type !== 'video-compress') {
      throw new BadRequestException('Invalid project tool type');
    }

    const metadata = (project.metadata || {}) as Record<string, unknown>;
    const outputFileName = metadata.outputFileName as string;
    const options = {
      width: metadata.width ?? 1080,
      height: metadata.height ?? 1920,
      fit: metadata.fit ?? 'contain',
      crf: metadata.crf ?? 23,
      presetLabel: metadata.presetLabel ?? 'hd',
    };

    await this.projectsService.updateStatus(projectId, ProjectStatus.PROCESSING);

    try {
      await this.videoToolsQueue.addJob({
        projectId,
        userId,
        inputBlobId,
        toolType: project.tool_type as 'video-resize' | 'video-compress',
        options:
          project.tool_type === 'video-resize'
            ? {
                width: options.width as number,
                height: options.height as number,
                fit: options.fit as 'fill' | 'contain' | 'cover',
              }
            : {
                width: options.width as number,
                height: options.height as number,
                crf: options.crf as number,
                presetLabel: options.presetLabel as string,
              },
        outputFileName: outputFileName || 'output.mp4',
      });
    } catch (err: any) {
      await this.projectsService.updateStatus(
        projectId,
        ProjectStatus.FAILED,
        undefined,
        err?.message ?? 'Failed to enqueue job',
      );
      throw err;
    }

    res.status(202);
    res.setHeader('Location', `/projects/${projectId}`);
    return res.json(await this.projectsService.findOne(projectId));
  }

  private async handleUpload(
    req: any,
    res: Response,
    file: Express.Multer.File | undefined,
    toolType: 'video-resize' | 'video-compress',
    getOutputFileName: (options: VideoResizeOptions | VideoCompressOptions) => string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('Unauthorized');
    }

    const contentLength = req.headers?.['content-length'];
    if (contentLength && parseInt(contentLength, 10) > MAX_VIDEO_SIZE_BYTES) {
      throw new PayloadTooLargeException(FILE_TOO_LARGE_MESSAGE);
    }

    if (!file || !file.path) {
      throw new BadRequestException('Video file is required');
    }

    const sizeCheck = validateSize(file.size);
    if (!sizeCheck.valid) {
      if (existsSync(file.path)) unlinkSync(file.path);
      throw new PayloadTooLargeException(sizeCheck.error || FILE_TOO_LARGE_MESSAGE);
    }

    let options: VideoResizeOptions | VideoCompressOptions;
    try {
      const raw = req.body?.options ?? req.body;
      options = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {});
    } catch {
      options =
        toolType === 'video-resize'
          ? { width: 1080, height: 1920, fit: 'contain' as const }
          : { width: 1080, height: 1920, crf: 23, presetLabel: 'hd' };
    }

    const outputFileName = getOutputFileName(options);
    const project = await this.projectsService.create(
      toolType,
      {
        originalFileName: file.originalname,
        outputFileName,
        ...options,
      },
      userId,
    );

    let inputBlobId: string;
    try {
      const stream = createReadStream(file.path);
      inputBlobId = await this.storage.upload({
        userId,
        mediaId: project.id,
        type: 'video-tools',
        stream,
        fileName: 'input' + getExt(file.originalname),
      });
    } finally {
      if (existsSync(file.path)) {
        try {
          unlinkSync(file.path);
        } catch (e) {
          this.logger.warn(`Failed to unlink temp file ${file.path}: ${e}`);
        }
      }
    }

    await this.projectsService.updateStatus(project.id, ProjectStatus.PROCESSING);

    try {
      await this.videoToolsQueue.addJob({
        projectId: project.id,
        userId,
        inputBlobId,
        toolType,
        options,
        outputFileName,
      });
    } catch (err: any) {
      await this.projectsService.updateStatus(
        project.id,
        ProjectStatus.FAILED,
        undefined,
        err?.message ?? 'Failed to enqueue job',
      );
      throw err;
    }

    res.status(202);
    res.setHeader('Location', `/projects/${project.id}`);
    return res.json(project);
  }
}
