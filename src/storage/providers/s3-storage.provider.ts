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
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
  }

  async uploadAudio(videoId: string, buffer: Buffer): Promise<string> {
    const key = `audio/${videoId}/${uuidv4()}.mp3`;
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
    const key = `captions/${videoId}/${uuidv4()}.srt`;
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
    const key = `assets/${videoId}/${uuidv4()}.${extension}`;
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
    const key = `videos/${videoId}/${uuidv4()}.mp4`;
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

  async getSignedUrl(s3Url: string, expiresIn: number = 3600): Promise<string> {
    const key = s3Url.replace(`s3://${this.bucketName}/`, '');
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
