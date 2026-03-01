import { Injectable } from '@nestjs/common';
import { IStorageService, StorageUploadParams } from '../interfaces/storage.interface';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as getCFSignedUrl } from '@aws-sdk/cloudfront-signer';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

/** AWS S3 only (no Supabase). Used for writes and for URL generation when blob_storage_backend = 's3'. */
@Injectable()
export class AwsS3StorageProvider implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private cfDomain: string | undefined;
  private cfKeyPairId: string | undefined;
  private cfPrivateKey: string | undefined;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED', // Presigned PUT URLs must not require checksum headers (browser uploads)
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
    this.cfDomain = process.env.CLOUDFRONT_DOMAIN;
    this.cfKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    this.cfPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY
      ? Buffer.from(process.env.CLOUDFRONT_PRIVATE_KEY, 'base64').toString('utf-8')
      : undefined;
  }

  async upload(params: StorageUploadParams): Promise<string> {
    const { userId, mediaId, type, buffer, stream, fileName, step } = params;
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
    return key;
  }

  async downloadToFile(objectId: string, targetPath: string): Promise<void> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: objectId });
    const response = await this.s3Client.send(command);
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    await pipeline(response.Body as Readable, createWriteStream(targetPath));
  }

  getLocalPath(objectId: string): string {
    const storageBasePath = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'storage');
    return join(storageBasePath, objectId);
  }

  async download(objectId: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: objectId });
    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) chunks.push(chunk);
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
    // Use CloudFront signed URLs for streaming (not for forced downloads — those need Content-Disposition)
    if (!options?.promptDownload && this.cfDomain && this.cfKeyPairId && this.cfPrivateKey) {
      const url = `https://${this.cfDomain}/${objectId}`;
      const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();
      return getCFSignedUrl({ url, keyPairId: this.cfKeyPairId, dateLessThan, privateKey: this.cfPrivateKey });
    }
    // Fallback: S3 presigned URL (downloads or CloudFront not configured)
    const commandInput: any = { Bucket: this.bucketName, Key: objectId };
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
    const map: Record<string, string> = {
      audio: '.mp3',
      caption: '.srt',
      image: '.jpg',
      video: '.mp4',
      clip: '.mp4',
      script: '.json',
    };
    return map[type] ?? '';
  }

  private getContentTypeForType(type: string): string {
    const map: Record<string, string> = {
      audio: 'audio/mpeg',
      caption: 'text/plain',
      image: 'image/jpeg',
      video: 'video/mp4',
      clip: 'video/mp4',
      script: 'application/json',
    };
    return map[type] ?? 'application/octet-stream';
  }
}
