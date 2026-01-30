import { Injectable } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

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
      });
      this.bucketName = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
    }
  }

  async uploadAudio(videoId: string, buffer: Buffer): Promise<string> {
    const key = `videos/${videoId}/audio/${uuidv4()}.mp3`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'audio/mpeg',
      }),
    );
    return `s3://${this.bucketName}/${key}`;
  }

  async uploadCaption(videoId: string, buffer: Buffer): Promise<string> {
    const key = `videos/${videoId}/captions/${uuidv4()}.srt`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'text/plain',
      }),
    );
    return `s3://${this.bucketName}/${key}`;
  }

  async uploadAsset(videoId: string, buffer: Buffer, contentType: string): Promise<string> {
    const extension = contentType.includes('video') ? 'mp4' : 'jpg';
    // 'assets' usually implies raw inputs (images/videos generated for the scenes)
    const key = `videos/${videoId}/assets/${uuidv4()}.${extension}`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `s3://${this.bucketName}/${key}`;
  }

  async uploadVideo(videoId: string, buffer: Buffer): Promise<string> {
    // This is the final rendered video
    const key = `videos/${videoId}/final/${uuidv4()}.mp4`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
      }),
    );
    return `s3://${this.bucketName}/${key}`;
  }

  async download(s3Url: string): Promise<Buffer> {
    const key = s3Url.replace(`s3://${this.bucketName}/`, '');
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async downloadMultiple(s3Urls: string[]): Promise<Buffer[]> {
    return Promise.all(s3Urls.map((url) => this.download(url)));
  }

  async getSignedUrl(s3Url: string, expiresIn: number = 3600, options?: { promptDownload?: boolean; filename?: string }): Promise<string> {
    const key = s3Url.replace(`s3://${this.bucketName}/`, '');
    const commandInput: any = {
      Bucket: this.bucketName,
      Key: key,
    };

    if (options?.promptDownload) {
      const filename = options.filename ? ` filename="${options.filename}"` : '';
      commandInput.ResponseContentDisposition = `attachment;${filename}`;
    }

    const command = new GetObjectCommand(commandInput);
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
