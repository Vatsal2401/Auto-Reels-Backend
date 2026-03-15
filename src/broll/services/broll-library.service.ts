import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { BrollIngestionJob } from '../entities/broll-ingestion-job.entity';
import { BrollLibrary } from '../entities/broll-library.entity';
import { CreateLibraryDto } from '../dto/create-library.dto';
import { UpdateLibraryDto } from '../dto/update-library.dto';
import { BrollPythonService } from './broll-python.service';

const BROLL_CONTENT_TYPE_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
};

interface BrollVideoRow {
  id: string;
  file_path: string;
  filename: string;
  status: string;
  duration_seconds: number | null;
  frame_count: number;
  ingested_at: string | null;
  error_message: string | null;
  library_id: string | null;
  user_id: string | null;
  job_status: string | null;
  job_stage: string | null;
  job_frames_processed: number | null;
  job_total_frames: number | null;
}

@Injectable()
export class BrollLibraryService {
  private readonly logger = new Logger(BrollLibraryService.name);

  constructor(
    @InjectRepository(BrollLibrary)
    private readonly libraryRepo: Repository<BrollLibrary>,
    @InjectRepository(BrollIngestionJob)
    private readonly jobRepo: Repository<BrollIngestionJob>,
    @Inject('IStorageService')
    private readonly storageService: IStorageService,
    private readonly brollPythonService: BrollPythonService,
    private readonly dataSource: DataSource,
  ) {}

  async createLibrary(userId: string, dto: CreateLibraryDto): Promise<BrollLibrary> {
    const lib = this.libraryRepo.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      status: 'draft',
    });
    return this.libraryRepo.save(lib);
  }

  async listLibraries(userId: string): Promise<BrollLibrary[]> {
    return this.libraryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLibrary(id: string, userId: string): Promise<BrollLibrary> {
    const lib = await this.libraryRepo.findOne({ where: { id } });
    if (!lib) throw new NotFoundException('Library not found');
    if (lib.userId !== userId) throw new ForbiddenException();
    return lib;
  }

  async updateLibrary(id: string, userId: string, dto: UpdateLibraryDto): Promise<void> {
    await this.getLibrary(id, userId);
    const update: Partial<BrollLibrary> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.description !== undefined) update.description = dto.description;
    if (Object.keys(update).length > 0) {
      await this.libraryRepo.update({ id }, update);
    }
  }

  async deleteLibrary(id: string, userId: string): Promise<void> {
    await this.getLibrary(id, userId);
    await this.libraryRepo.delete({ id });
  }

  async presignUpload(
    libId: string,
    userId: string,
    filename: string,
    contentType?: string,
  ): Promise<{ uploadUrl: string; s3Key: string; videoId: string }> {
    await this.getLibrary(libId, userId);
    const ext = filename.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '.mp4';
    const videoId = uuidv4();
    const inferredContentType = contentType ?? BROLL_CONTENT_TYPE_MAP[ext] ?? 'video/mp4';
    const result = await this.storageService.getPresignedPutUrl(
      { userId, mediaId: videoId, type: 'broll', fileName: `input${ext}` },
      900,
      inferredContentType,
    );
    // Insert as 'uploading' — confirmUpload() will promote to 'uploaded' once S3 PUT succeeds
    await this.dataSource.query(
      `INSERT INTO broll_videos (id, file_path, filename, status, library_id, user_id)
       VALUES ($1, $2, $3, 'uploading', $4, $5)`,
      [videoId, result.objectId, filename, libId, userId],
    );
    await this.recalcStats(libId);
    return { uploadUrl: result.uploadUrl, s3Key: result.objectId, videoId };
  }

  async confirmUpload(libId: string, videoId: string, userId: string): Promise<void> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT id FROM broll_videos WHERE id = $1 AND library_id = $2 AND status = 'uploading'`,
      [videoId, libId],
    )) as { id: string }[];
    if (!rows[0]) throw new NotFoundException('Video not found or already confirmed');
    await this.dataSource.query(`UPDATE broll_videos SET status = 'uploaded' WHERE id = $1`, [
      videoId,
    ]);
    await this.recalcStats(libId);
  }

  async listVideos(libId: string, userId: string): Promise<BrollVideoRow[]> {
    // Single query: ownership check (user_id = $2) + video list + latest job — no extra round-trip
    const rows = (await this.dataSource.query(
      `SELECT v.id, v.file_path, v.filename, v.status, v.duration_seconds,
              v.frame_count, v.ingested_at, v.error_message, v.library_id, v.user_id,
              j.status AS job_status, j.stage AS job_stage,
              j.frames_processed AS job_frames_processed, j.total_frames AS job_total_frames
       FROM broll_videos v
       LEFT JOIN LATERAL (
         SELECT status, stage, frames_processed, total_frames
         FROM broll_ingestion_jobs
         WHERE video_id = v.id
         ORDER BY created_at DESC
         LIMIT 1
       ) j ON true
       WHERE v.library_id = $1
         AND EXISTS (SELECT 1 FROM broll_libraries WHERE id = $1 AND user_id = $2)
       ORDER BY v.created_at DESC`,
      [libId, userId],
    )) as BrollVideoRow[];

    if (rows.length === 0) {
      // Could be empty library or forbidden — do a lightweight ownership check only in that case
      await this.getLibrary(libId, userId);
    }

    return rows;
  }

  async deleteVideo(libId: string, videoId: string, userId: string): Promise<void> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT id FROM broll_videos WHERE id = $1 AND library_id = $2`,
      [videoId, libId],
    )) as { id: string }[];
    if (!rows[0]) throw new NotFoundException('Video not found in this library');
    await this.dataSource.query(`DELETE FROM broll_videos WHERE id = $1`, [videoId]);
    await this.recalcStats(libId);
  }

  async indexAll(libId: string, userId: string): Promise<{ queued: number }> {
    await this.getLibrary(libId, userId);
    const videos = (await this.dataSource.query(
      `SELECT id, file_path, filename FROM broll_videos WHERE library_id = $1 AND status = 'uploaded'`,
      [libId],
    )) as { id: string; file_path: string; filename: string }[];

    let queued = 0;
    for (const video of videos) {
      await this.triggerIngestion(libId, video.id, video.file_path, video.filename);
      queued++;
    }

    if (queued > 0) {
      await this.libraryRepo.update({ id: libId }, { status: 'processing' });
    }
    return { queued };
  }

  async indexOne(libId: string, videoId: string, userId: string): Promise<void> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT id, file_path, filename FROM broll_videos WHERE id = $1 AND library_id = $2`,
      [videoId, libId],
    )) as { id: string; file_path: string; filename: string }[];
    if (!rows[0]) throw new NotFoundException('Video not found in this library');
    await this.triggerIngestion(libId, rows[0].id, rows[0].file_path, rows[0].filename);
    await this.libraryRepo.update({ id: libId }, { status: 'processing' });
  }

  async reindexOne(libId: string, videoId: string, userId: string): Promise<void> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT id, file_path, filename FROM broll_videos WHERE id = $1 AND library_id = $2`,
      [videoId, libId],
    )) as { id: string; file_path: string; filename: string }[];
    if (!rows[0]) throw new NotFoundException('Video not found in this library');
    // Reset status to re-index
    await this.dataSource.query(`UPDATE broll_videos SET status = 'uploaded' WHERE id = $1`, [
      videoId,
    ]);
    await this.triggerIngestion(libId, rows[0].id, rows[0].file_path, rows[0].filename);
    await this.libraryRepo.update({ id: libId }, { status: 'processing' });
  }

  async listJobs(libId: string, userId: string): Promise<BrollIngestionJob[]> {
    await this.getLibrary(libId, userId);
    return this.jobRepo.find({
      where: { libraryId: libId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getVideoPreviewUrl(
    libId: string,
    videoId: string,
    userId: string,
  ): Promise<{ signedUrl: string }> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT file_path FROM broll_videos WHERE id = $1 AND library_id = $2`,
      [videoId, libId],
    )) as { file_path: string }[];
    if (!rows[0]) throw new NotFoundException('Video not found in this library');
    const signedUrl = await this.storageService.getSignedUrl(rows[0].file_path, 3600);
    return { signedUrl };
  }

  // ─── Multipart Upload ──────────────────────────────────────────────────────

  async presignMultipart(
    libId: string,
    userId: string,
    filename: string,
    contentType: string,
    size: number,
  ): Promise<{ uploadId: string; key: string; videoId: string }> {
    await this.getLibrary(libId, userId);
    const ext = filename.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '.mp4';
    const videoId = uuidv4();
    const key = this.storageService.buildObjectKey(userId, videoId, 'broll', `input${ext}`);

    const uploadId = await this.storageService.createMultipartUpload(key, contentType);

    // Persist the video row + multipart tracking row in a single transaction
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO broll_videos (id, file_path, filename, status, library_id, user_id, file_size_bytes, content_type)
         VALUES ($1, $2, $3, 'uploading', $4, $5, $6, $7)`,
        [videoId, key, filename, libId, userId, size, contentType],
      );
      await manager.query(
        `INSERT INTO broll_multipart_uploads (video_id, library_id, upload_id, s3_key, filename, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [videoId, libId, uploadId, key, filename],
      );
    });

    await this.recalcStats(libId);
    return { uploadId, key, videoId };
  }

  async presignParts(
    libId: string,
    userId: string,
    videoId: string,
    uploadId: string,
    key: string,
    partNumbers: number[],
  ): Promise<{ parts: { partNumber: number; url: string }[] }> {
    await this.getLibrary(libId, userId);
    const parts = await Promise.all(
      partNumbers.map(async (n) => ({
        partNumber: n,
        url: await this.storageService.presignUploadPart(key, uploadId, n, 3600),
      })),
    );
    return { parts };
  }

  async completeMultipart(
    libId: string,
    userId: string,
    videoId: string,
    uploadId: string,
    key: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<{ videoId: string }> {
    await this.getLibrary(libId, userId);
    await this.storageService.completeMultipartUpload(
      key,
      uploadId,
      parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
    );
    // Mark video as uploaded so it can be indexed
    await this.dataSource.query(`UPDATE broll_videos SET status = 'uploaded' WHERE id = $1`, [
      videoId,
    ]);
    await this.dataSource.query(
      `UPDATE broll_multipart_uploads SET status = 'completed', updated_at = now() WHERE video_id = $1 AND upload_id = $2`,
      [videoId, uploadId],
    );
    return { videoId };
  }

  async abortMultipart(
    libId: string,
    userId: string,
    videoId: string,
    uploadId: string,
    key: string,
  ): Promise<void> {
    await this.getLibrary(libId, userId);
    try {
      await this.storageService.abortMultipartUpload(key, uploadId);
    } catch (err) {
      this.logger.warn(`abortMultipart: S3 abort failed: ${(err as Error)?.message}`);
    }
    await this.dataSource.query(`DELETE FROM broll_videos WHERE id = $1`, [videoId]);
    await this.recalcStats(libId);
  }

  // ─── Frame Timeline ────────────────────────────────────────────────────────

  async getVideoFrames(
    libId: string,
    videoId: string,
    userId: string,
  ): Promise<{ frameTime: number; frameIndex: number; caption: string | null }[]> {
    await this.getLibrary(libId, userId);
    const rows = (await this.dataSource.query(
      `SELECT frame_time, frame_index, caption
       FROM broll_frame_embeddings
       WHERE video_id = $1
       ORDER BY frame_index ASC`,
      [videoId],
    )) as { frame_time: number; frame_index: number; caption: string | null }[];
    return rows.map((r) => ({
      frameTime: r.frame_time,
      frameIndex: r.frame_index,
      caption: r.caption ?? null,
    }));
  }

  // ─── Search (for ClipPickerPanel) ──────────────────────────────────────────

  async searchClips(libId: string, userId: string, query: string, topK = 10): Promise<unknown[]> {
    await this.getLibrary(libId, userId);
    try {
      const results = await this.brollPythonService.match([query], topK);
      // results is an array of { script_line, matches: [{filename, file_path, frame_time, similarity_score, ...}] }
      const line = (results as unknown as { script_line: string; matches: unknown[] }[])[0];
      return line?.matches ?? [];
    } catch (err) {
      this.logger.error(`searchClips: ${(err as Error)?.message}`);
      return [];
    }
  }

  async recalcStats(libId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE broll_libraries
       SET video_count   = (SELECT COUNT(*) FROM broll_videos WHERE library_id = $1),
           indexed_count = (SELECT COUNT(*) FROM broll_videos WHERE library_id = $1 AND status = 'indexed'),
           scene_count   = (SELECT COALESCE(SUM(frame_count), 0) FROM broll_videos WHERE library_id = $1 AND status = 'indexed'),
           updated_at    = now()
       WHERE id = $1`,
      [libId],
    );

    // Auto-promote to indexed/active if all videos are done
    const lib = await this.libraryRepo.findOne({ where: { id: libId } });
    if (lib && lib.videoCount > 0 && lib.indexedCount === lib.videoCount) {
      await this.libraryRepo.update({ id: libId }, { status: 'indexed' });
    }
  }

  private async triggerIngestion(
    libId: string,
    videoId: string,
    s3Key: string,
    filename: string,
  ): Promise<void> {
    const job = this.jobRepo.create({
      videoId,
      libraryId: libId,
      status: 'queued',
    });
    await this.jobRepo.save(job);

    try {
      // promptDownload: true forces direct S3 presigned URL (bypasses CloudFront)
      // — CloudFront may not be configured for broll paths, causing 403
      const presignedUrl = await this.storageService.getSignedUrl(s3Key, 3600, {
        promptDownload: true,
      });
      await this.brollPythonService.ingestFromUrl(presignedUrl, filename, videoId);
      await this.jobRepo.update({ id: job.id }, { status: 'active', stage: 'downloading' });
      await this.dataSource.query(`UPDATE broll_videos SET status = 'processing' WHERE id = $1`, [
        videoId,
      ]);
    } catch (err) {
      this.logger.error(
        `triggerIngestion: failed for video ${videoId}: ${(err as Error)?.message}`,
      );
      await this.jobRepo.update(
        { id: job.id },
        {
          status: 'failed',
          errorMessage: (err as Error)?.message ?? 'Unknown error',
        },
      );
    }
  }
}
