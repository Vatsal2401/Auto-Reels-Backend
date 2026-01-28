import { Injectable } from '@nestjs/common';
import { IStorageService } from '../interfaces/storage.interface';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Local Storage Provider
 * 
 * Stores files locally on the filesystem instead of S3
 * Perfect for testing and development without AWS credentials
 * 
 * Files are stored in: storage/
 *   - storage/audio/{videoId}/
 *   - storage/captions/{videoId}/
 *   - storage/assets/{videoId}/
 *   - storage/videos/{videoId}/
 */
@Injectable()
export class LocalStorageProvider implements IStorageService {
  private storageBasePath: string;

  constructor() {
    // Use storage directory in project root, or fallback to temp
    this.storageBasePath = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'storage');
    
    // Create storage directories if they don't exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const directories = [
      join(this.storageBasePath, 'audio'),
      join(this.storageBasePath, 'captions'),
      join(this.storageBasePath, 'assets'),
      join(this.storageBasePath, 'videos'),
    ];

    directories.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  private getFilePath(type: 'audio' | 'captions' | 'assets' | 'videos', videoId: string, filename: string): string {
    const dir = join(this.storageBasePath, type, videoId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return join(dir, filename);
  }

  private parseFileUrl(fileUrl: string): string {
    // Handle both file:// and local:// URLs
    if (fileUrl.startsWith('file://')) {
      // Remove file:// protocol
      const path = fileUrl.replace('file://', '');
      return path;
    }
    if (fileUrl.startsWith('local://')) {
      // local://audio/videoId/filename -> storage/audio/videoId/filename
      const relativePath = fileUrl.replace('local://', '');
      return join(this.storageBasePath, relativePath);
    }
    // Handle s3:// URLs (for backward compatibility)
    if (fileUrl.startsWith('s3://')) {
      throw new Error('S3 URLs not supported in local storage. Use local:// URLs instead.');
    }
    // If it's already an absolute path, return as-is
    if (fileUrl.startsWith('/') || fileUrl.startsWith(this.storageBasePath)) {
      return fileUrl;
    }
    // Default: assume it's a relative path from storage base
    return join(this.storageBasePath, fileUrl);
  }

  async uploadAudio(videoId: string, buffer: Buffer): Promise<string> {
    const filename = `${uuidv4()}.mp3`;
    const filePath = this.getFilePath('audio', videoId, filename);
    writeFileSync(filePath, buffer);
    return `local://audio/${videoId}/${filename}`;
  }

  async uploadCaption(videoId: string, buffer: Buffer): Promise<string> {
    const filename = `${uuidv4()}.srt`;
    const filePath = this.getFilePath('captions', videoId, filename);
    writeFileSync(filePath, buffer);
    return `local://captions/${videoId}/${filename}`;
  }

  async uploadAsset(videoId: string, buffer: Buffer, contentType: string): Promise<string> {
    const extension = contentType.includes('video') ? 'mp4' : contentType.includes('png') ? 'png' : 'jpg';
    const filename = `${uuidv4()}.${extension}`;
    const filePath = this.getFilePath('assets', videoId, filename);
    writeFileSync(filePath, buffer);
    return `local://assets/${videoId}/${filename}`;
  }

  async uploadVideo(videoId: string, buffer: Buffer): Promise<string> {
    const filename = `${uuidv4()}.mp4`;
    const filePath = this.getFilePath('videos', videoId, filename);
    writeFileSync(filePath, buffer);
    return `local://videos/${videoId}/${filename}`;
  }

  async download(fileUrl: string): Promise<Buffer> {
    const filePath = this.parseFileUrl(fileUrl);
    
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return readFileSync(filePath);
  }

  async downloadMultiple(fileUrls: string[]): Promise<Buffer[]> {
    return Promise.all(fileUrls.map((url) => this.download(url)));
  }

  async getSignedUrl(fileUrl: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, return a file:// URL
    // In production, you might want to serve files via HTTP endpoint
    const filePath = this.parseFileUrl(fileUrl);
    
    // Return file:// URL for local access
    // Note: In a real app, you'd want to serve these via HTTP
    return `file://${filePath}`;
  }
}
