import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import axios from 'axios';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { BrollAirImport } from '../entities/broll-air-import.entity';
import { BrollLibrary } from '../entities/broll-library.entity';
import { ImportFromAirDto } from '../dto/import-from-air.dto';
import { BrowseAirDto } from '../dto/browse-air.dto';

const AIR_API_BASE = 'https://api.air.inc';
const PART_SIZE = 50 * 1024 * 1024; // 50 MB
const CONCURRENCY = 3;

interface AirAsset {
  id: string;
  title: string;
  ext: string;
  size?: number;
  mimeType?: string;
  source?: { downloadUrl?: string };
  duration?: number;
  thumbnails?: { url: string }[];
}

export interface AirClipPreview {
  id: string;
  title: string;
  ext: string;
  size?: number;
  duration?: number;
  mimeType?: string;
  thumbnailUrl: string | null;
}

export interface AirBrowseResult {
  boardId: string;
  totalClips: number;
  clips: AirClipPreview[];
}

@Injectable()
export class BrollAirImportService {
  private readonly logger = new Logger(BrollAirImportService.name);

  constructor(
    @InjectRepository(BrollAirImport)
    private readonly importRepo: Repository<BrollAirImport>,
    @InjectRepository(BrollLibrary)
    private readonly libraryRepo: Repository<BrollLibrary>,
    @Inject('IStorageService')
    private readonly storageService: IStorageService,
    private readonly dataSource: DataSource,
  ) {}

  async startImport(libId: string, userId: string, dto: ImportFromAirDto): Promise<BrollAirImport> {
    // Verify library ownership
    const lib = await this.libraryRepo.findOne({ where: { id: libId } });
    if (!lib) throw new NotFoundException('Library not found');
    if (lib.userId !== userId) throw new ForbiddenException();

    const boardId = this.parseAirBoardUrl(dto.boardUrl);
    if (!boardId) {
      throw new BadRequestException('Invalid AIR board URL — could not extract board ID');
    }

    const job = this.importRepo.create({
      libraryId: libId,
      userId,
      boardUrl: dto.boardUrl,
      boardId,
      status: 'running',
    });
    const saved = await this.importRepo.save(job);

    // Run import asynchronously — never blocks the HTTP response
    setImmediate(() => {
      void this.runImport(saved, dto.airApiKey, dto.clipIds, dto.autoIndex ?? false);
    });

    return saved;
  }

  async browseBoard(libId: string, userId: string, dto: BrowseAirDto): Promise<AirBrowseResult> {
    const lib = await this.libraryRepo.findOne({ where: { id: libId } });
    if (!lib) throw new NotFoundException('Library not found');
    if (lib.userId !== userId) throw new ForbiddenException();

    const boardId = this.parseAirBoardUrl(dto.boardUrl);
    if (!boardId) {
      throw new BadRequestException('Invalid AIR share URL — could not extract board ID');
    }

    const assets = await this.paginateAirAssetsPublic(boardId);
    return {
      boardId,
      totalClips: assets.length,
      clips: assets.map((a) => ({
        id: a.id,
        title: a.title,
        ext: a.ext,
        size: a.size,
        duration: a.duration,
        mimeType: a.mimeType,
        thumbnailUrl: a.thumbnails?.[0]?.url ?? null,
      })),
    };
  }

  async listImports(libId: string, userId: string): Promise<BrollAirImport[]> {
    // Verify ownership
    const lib = await this.libraryRepo.findOne({ where: { id: libId } });
    if (!lib) throw new NotFoundException('Library not found');
    if (lib.userId !== userId) throw new ForbiddenException();

    return this.importRepo.find({
      where: { libraryId: libId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private parseAirBoardUrl(url: string): string | null {
    const match = /\/b\/([0-9a-f-]{36})/i.exec(url);
    return match?.[1] ?? null;
  }

  private async runImport(
    job: BrollAirImport,
    apiKey: string | undefined,
    clipIds: string[] | undefined,
    autoIndex: boolean,
  ): Promise<void> {
    try {
      let assets = apiKey
        ? await this.paginateAirAssets(job.boardId, apiKey)
        : await this.paginateAirAssetsPublic(job.boardId);

      if (clipIds?.length) {
        const idSet = new Set(clipIds);
        assets = assets.filter((a) => idSet.has(a.id));
      }

      await this.importRepo.update({ id: job.id }, { totalClips: assets.length });

      // Process up to CONCURRENCY assets at a time
      let importedClips = 0;
      let failedClips = 0;

      for (let i = 0; i < assets.length; i += CONCURRENCY) {
        const batch = assets.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (asset) => {
            try {
              await this.streamAirToS3(asset, job.libraryId, job.userId, autoIndex);
              importedClips++;
            } catch (err) {
              failedClips++;
              this.logger.error(
                `runImport: failed clip ${asset.id} (${asset.title}): ${(err as Error)?.message}`,
              );
            }
            // Update progress after each video regardless of success/failure
            await this.importRepo.update({ id: job.id }, { importedClips, failedClips });
          }),
        );
      }

      // Recalculate library stats
      await this.recalcStats(job.libraryId);

      const finalStatus =
        failedClips === 0 ? 'completed' : importedClips === 0 ? 'failed' : 'partial';
      await this.importRepo.update(
        { id: job.id },
        {
          status: finalStatus,
          importedClips,
          failedClips,
        },
      );
    } catch (err) {
      this.logger.error(`runImport: fatal error for job ${job.id}: ${(err as Error)?.message}`);
      await this.importRepo.update(
        { id: job.id },
        {
          status: 'failed',
          errorMessage: (err as Error)?.message ?? 'Unknown error',
        },
      );
    }
  }

  private async paginateAirAssets(boardId: string, apiKey: string): Promise<AirAsset[]> {
    const assets: AirAsset[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      try {
        const body: Record<string, unknown> = {
          boardId,
          types: ['video'],
          limit: 50,
        };
        if (cursor) body.cursor = cursor;

        const res = await axios.post<{
          assets: AirAsset[];
          cursor?: string;
          hasMore?: boolean;
        }>(`${AIR_API_BASE}/assets/search`, body, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 30_000,
        });

        assets.push(...(res.data.assets ?? []));
        cursor = res.data.cursor;
        hasMore = res.data.hasMore ?? false;
      } catch (err) {
        // Fallback: try GET /boards/{boardId}/clips
        if (!cursor) {
          this.logger.warn(
            `paginateAirAssets: POST /assets/search failed, trying GET fallback: ${(err as Error)?.message}`,
          );
          const fallback = await this.paginateAirClipsFallback(boardId, apiKey);
          assets.push(...fallback);
          break;
        }
        throw err;
      }
    }

    return assets;
  }

  private async paginateAirClipsFallback(boardId: string, apiKey: string): Promise<AirAsset[]> {
    const assets: AirAsset[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = cursor
        ? `${AIR_API_BASE}/boards/${boardId}/clips?limit=50&cursor=${cursor}`
        : `${AIR_API_BASE}/boards/${boardId}/clips?limit=50`;

      const res = await axios.get<{
        clips?: AirAsset[];
        assets?: AirAsset[];
        cursor?: string;
        hasMore?: boolean;
      }>(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 30_000,
      });

      const page = res.data.clips ?? res.data.assets ?? [];
      assets.push(...page);
      cursor = res.data.cursor;
      hasMore = res.data.hasMore ?? false;
    }

    return assets;
  }

  private async paginateAirAssetsPublic(boardId: string): Promise<AirAsset[]> {
    const assets: AirAsset[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      try {
        const body: Record<string, unknown> = { boardId, types: ['video'], limit: 50 };
        if (cursor) body.cursor = cursor;
        const res = await axios.post<{
          assets: AirAsset[];
          cursor?: string;
          hasMore?: boolean;
        }>(`${AIR_API_BASE}/assets/search`, body, { timeout: 30_000 });

        assets.push(...(res.data.assets ?? []));
        cursor = res.data.cursor;
        hasMore = res.data.hasMore ?? false;
      } catch (err) {
        if (!cursor) {
          this.logger.warn(
            `paginateAirAssetsPublic: POST /assets/search failed, trying GET fallback: ${(err as Error)?.message}`,
          );
          const fallback = await this.paginatePublicClipsFallback(boardId);
          assets.push(...fallback);
          break;
        }
        throw err;
      }
    }

    return assets;
  }

  private async paginatePublicClipsFallback(boardId: string): Promise<AirAsset[]> {
    const assets: AirAsset[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const url = cursor
        ? `${AIR_API_BASE}/boards/${boardId}/clips?limit=50&cursor=${cursor}`
        : `${AIR_API_BASE}/boards/${boardId}/clips?limit=50`;

      const res = await axios.get<{
        clips?: AirAsset[];
        assets?: AirAsset[];
        cursor?: string;
        hasMore?: boolean;
      }>(url, { timeout: 30_000 });

      const page = res.data.clips ?? res.data.assets ?? [];
      assets.push(...page);
      cursor = res.data.cursor;
      hasMore = res.data.hasMore ?? false;
    }

    return assets;
  }

  private async streamAirToS3(
    asset: AirAsset,
    libId: string,
    userId: string,
    autoIndex: boolean,
  ): Promise<void> {
    const downloadUrl = asset.source?.downloadUrl;
    if (!downloadUrl) {
      throw new Error(`Asset ${asset.id} has no downloadUrl`);
    }

    const ext = asset.ext ? `.${asset.ext.replace(/^\./, '')}` : '.mp4';
    const filename = asset.title ? `${asset.title}${ext}` : `${asset.id}${ext}`;
    const mimeType = asset.mimeType ?? 'video/mp4';
    const videoId = uuidv4();
    const key = this.storageService.buildObjectKey(userId, videoId, 'broll', `input${ext}`);

    // Insert video row in 'importing' transient status
    await this.dataSource.query(
      `INSERT INTO broll_videos (id, file_path, filename, status, library_id, user_id)
       VALUES ($1, $2, $3, 'importing', $4, $5)`,
      [videoId, key, filename, libId, userId],
    );

    let uploadId: string | null = null;
    try {
      uploadId = await this.storageService.createMultipartUpload(key, mimeType);
      const parts = await this.uploadStreamInParts(downloadUrl, key, uploadId);
      await this.storageService.completeMultipartUpload(key, uploadId, parts);

      // Mark as uploaded so it can be indexed
      await this.dataSource.query(
        `UPDATE broll_videos SET status = 'uploaded', filename = $2 WHERE id = $1`,
        [videoId, filename],
      );

      if (autoIndex) {
        await this.triggerIngestionSilent(libId, videoId, key, filename);
      }
    } catch (err) {
      // Clean up multipart upload on failure
      if (uploadId) {
        try {
          await this.storageService.abortMultipartUpload(key, uploadId);
        } catch (abortErr) {
          this.logger.warn(
            `streamAirToS3: abort failed for ${videoId}: ${(abortErr as Error)?.message}`,
          );
        }
      }
      // Mark video as error
      await this.dataSource.query(
        `UPDATE broll_videos SET status = 'error', error_message = $2 WHERE id = $1`,
        [videoId, (err as Error)?.message ?? 'Import failed'],
      );
      throw err;
    }
  }

  private async uploadStreamInParts(
    downloadUrl: string,
    key: string,
    uploadId: string,
  ): Promise<{ PartNumber: number; ETag: string }[]> {
    const response = await axios.get<Readable>(downloadUrl, {
      responseType: 'stream',
      timeout: 0, // no timeout for large files
    });

    const stream: Readable = response.data;
    const parts: { PartNumber: number; ETag: string }[] = [];
    let partNumber = 1;
    let buffer = Buffer.alloc(0);

    return new Promise<{ PartNumber: number; ETag: string }[]>((resolve, reject) => {
      stream.on('data', (chunk: Buffer | string) => {
        buffer = Buffer.concat([buffer, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);

        // Upload each complete 50MB part
        const flushParts: Promise<void>[] = [];
        while (buffer.length >= PART_SIZE) {
          const partBuf = buffer.slice(0, PART_SIZE);
          buffer = buffer.slice(PART_SIZE);
          const currentPart = partNumber++;

          flushParts.push(
            this.storageService
              .uploadPartDirect(key, uploadId, currentPart, partBuf)
              .then((etag) => {
                parts.push({ PartNumber: currentPart, ETag: etag });
              }),
          );
        }

        if (flushParts.length > 0) {
          stream.pause();
          Promise.all(flushParts)
            .then(() => stream.resume())
            .catch(reject);
        }
      });

      stream.on('end', async () => {
        try {
          // Upload remaining bytes as the last part
          if (buffer.length > 0) {
            const currentPart = partNumber++;
            const etag = await this.storageService.uploadPartDirect(
              key,
              uploadId,
              currentPart,
              buffer,
            );
            parts.push({ PartNumber: currentPart, ETag: etag });
          }
          // Sort parts by PartNumber before completing
          parts.sort((a, b) => a.PartNumber - b.PartNumber);
          resolve(parts);
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', reject);
    });
  }

  private async triggerIngestionSilent(
    libId: string,
    videoId: string,
    s3Key: string,
    filename: string,
  ): Promise<void> {
    try {
      const signedUrl = await this.storageService.getSignedUrl(s3Key, 3600, {
        promptDownload: true,
      });
      // Lazy import to avoid circular dependency
      // Insert a queued job row — caller can rely on polling existing mechanism
      await this.dataSource.query(
        `INSERT INTO broll_ingestion_jobs (video_id, library_id, status)
         VALUES ($1, $2, 'queued')`,
        [videoId, libId],
      );
      this.logger.log(
        `triggerIngestionSilent: queued job for video ${videoId} (${filename}) url=${signedUrl.substring(0, 80)}...`,
      );
    } catch (err) {
      this.logger.warn(`triggerIngestionSilent: failed for ${videoId}: ${(err as Error)?.message}`);
    }
  }

  private async recalcStats(libId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE broll_libraries
       SET video_count   = (SELECT COUNT(*) FROM broll_videos WHERE library_id = $1 AND status != 'importing'),
           indexed_count = (SELECT COUNT(*) FROM broll_videos WHERE library_id = $1 AND status = 'indexed'),
           scene_count   = (SELECT COALESCE(SUM(frame_count), 0) FROM broll_videos WHERE library_id = $1 AND status = 'indexed'),
           updated_at    = now()
       WHERE id = $1`,
      [libId],
    );
  }
}
