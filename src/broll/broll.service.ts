import { BadGatewayException, Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { MatchScriptDto } from './dto/match-script.dto';
import { IngestDto } from './dto/ingest.dto';
import { BrollPythonService } from './services/broll-python.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BrollService {
  private readonly logger = new Logger(BrollService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject('IStorageService') private readonly storageService: IStorageService,
    private readonly brollPythonService: BrollPythonService,
  ) {}

  async presignUpload(userId: string, filename: string, contentType?: string): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    const ext = filename.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '.mp4';
    const result = await this.storageService.getPresignedPutUrl(
      { userId, mediaId: uuidv4(), type: 'broll', fileName: `input${ext}` },
      900,
      contentType ?? 'video/mp4',
    );
    return { uploadUrl: result.uploadUrl, s3Key: result.objectId, expiresIn: 900 };
  }

  async ingestVideo(s3Key: string, filename: string): Promise<{ s3Key: string; filename: string; status: string }> {
    const presignedUrl = await this.storageService.getSignedUrl(s3Key, 3600);
    await this.brollPythonService.ingestFromUrl(presignedUrl, filename);
    return { s3Key, filename, status: 'processing' };
  }

  async matchScript(dto: MatchScriptDto) {
    return this.brollPythonService.match(dto.scriptLines, dto.topK ?? 2);
  }

  async getIngestionStatus() {
    return this.brollPythonService.getIngestionStatus();
  }

  async startIngestion(dto: IngestDto) {
    return this.brollPythonService.startIngestion(dto.videoDir ?? '/broll', dto.forceReingest ?? false);
  }

  async rebuildIndex() {
    return this.brollPythonService.rebuildIndex();
  }

  async listVideos() {
    return this.brollPythonService.listVideos();
  }
}
