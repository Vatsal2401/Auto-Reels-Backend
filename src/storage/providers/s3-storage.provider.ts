import { Injectable } from '@nestjs/common';
import { IStorageService, StorageUploadParams } from '../interfaces/storage.interface';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class S3StorageProvider implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const storageType = process.env.CURRENT_BLOB_STORAGE || 's3';

    if (storageType === 'supabase') {
      const endpoint = process.env.SUPABASE_STORAGE_ENDPOINT; // e.g. https://<project>.storage.supabase.co/storage/v1/s3
      const region = process.env.SUPABASE_STORAGE_REGION || 'us-east-1';

      console.log(`🔌 Initializing Supabase Storage (S3 Compatible) at ${region}`);

      this.s3Client = new S3Client({
        region: region,
        endpoint: endpoint,
        credentials: {
          accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
        },
        forcePathStyle: true, // Often required for S3-compatible endpoints
        requestChecksumCalculation: 'WHEN_REQUIRED', // Presigned PUT URLs must not require checksum headers (browser uploads)
      });

      this.bucketName = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';
    } else {
      // Default to AWS S3
      console.log(`🔌 Initializing AWS S3 Storage`);
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
        requestChecksumCalculation: 'WHEN_REQUIRED', // Presigned PUT URLs must not require checksum headers (browser uploads)
      });
      this.bucketName = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
    }
  }

  async upload(params: StorageUploadParams): Promise<string> {
    const { userId, mediaId, type, buffer, stream, fileName, step } = params;

    // Construct user-isolated path: users/{userId}/media/{mediaId}/{type}/{fileName or random}
    const safeUserId = userId && userId !== 'null' ? userId : 'anonymous';
    const extension = this.getExtensionForType(type);
    const actualFileName = fileName || `${uuidv4()}${extension}`;
    const stepPart = step ? `${step}/` : '';
    const key = `users/${safeUserId}/media/${mediaId}/${type}/${stepPart}${actualFileName}`;

    if (stream) {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: stream,
          ContentType: this.getContentTypeForType(type),
        },
      });
      await upload.done();
    } else {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: this.getContentTypeForType(type),
        }),
      );
    }

    // Return the Object ID (Key)
    return key;
  }

  async downloadToFile(objectId: string, targetPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectId,
    });
    const response = await this.s3Client.send(command);

    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    await pipeline(response.Body as Readable, createWriteStream(targetPath));
  }

  getLocalPath(objectId: string): string {
    // For S3, we check our local mirror if we implement one,
    // but for now, we'll return the objectId to signal it's cloud-only
    // or return a path in a known /tmp/storage-cache dir if we decide to mirror everything.
    // Given the request, we should probably check if it exists in the mirror.
    const storageBasePath = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'storage');
    return join(storageBasePath, objectId);
  }

  async download(objectId: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectId,
    });
    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async downloadMultiple(objectIds: string[]): Promise<Buffer[]> {
    return Promise.all(objectIds.map((id) => this.download(id)));
  }

  async getSignedUrl(
    objectId: string,
    expiresIn: number = 3600,
    options?: { promptDownload?: boolean; filename?: string },
  ): Promise<string> {
    const commandInput: any = {
      Bucket: this.bucketName,
      Key: objectId,
    };

    if (options?.promptDownload) {
      const filename = options.filename ? ` filename="${options.filename}"` : '';
      commandInput.ResponseContentDisposition = `attachment;${filename}`;
    }

    const command = new GetObjectCommand(commandInput);
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPresignedPutUrl(
    params: { userId: string; mediaId: string; type: string; fileName: string },
    expiresIn: number = 900,
    contentType: string = 'video/mp4',
  ): Promise<{ uploadUrl: string; objectId: string }> {
    const safeUserId = params.userId && params.userId !== 'null' ? params.userId : 'anonymous';
    const key = `users/${safeUserId}/media/${params.mediaId}/${params.type}/${params.fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    return { uploadUrl, objectId: key };
  }

  private getExtensionForType(type: string): string {
    switch (type) {
      case 'audio':
        return '.mp3';
      case 'caption':
        return '.srt';
      case 'image':
        return '.jpg';
      case 'video':
      case 'video-tools':
      case 'clip':
        return '.mp4';
      case 'script':
        return '.json';
      default:
        return '';
    }
  }

  private getContentTypeForType(type: string): string {
    switch (type) {
      case 'audio':
        return 'audio/mpeg';
      case 'caption':
        return 'text/plain';
      case 'image':
        return 'image/jpeg';
      case 'video':
      case 'video-tools':
      case 'clip':
        return 'video/mp4';
      case 'script':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }
}
