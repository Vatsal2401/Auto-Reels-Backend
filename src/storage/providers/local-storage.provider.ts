import { Injectable } from '@nestjs/common';
import { IStorageService, StorageUploadParams } from '../interfaces/storage.interface';
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
    this.storageBasePath = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'storage');
    if (!existsSync(this.storageBasePath)) {
      mkdirSync(this.storageBasePath, { recursive: true });
    }
  }

  async upload(params: StorageUploadParams): Promise<string> {
    const { userId, mediaId, type, buffer, fileName, step } = params;

    // Construct user-isolated path: users/{userId}/media/{mediaId}/{type}/{fileName or random}
    const safeUserId = (userId && userId !== 'null') ? userId : 'anonymous';
    const extension = this.getExtensionForType(type);
    const actualFileName = fileName || `${uuidv4()}${extension}`;
    const stepPart = step ? `${step}/` : '';

    const relativeDir = join('users', safeUserId, 'media', mediaId, type, stepPart);
    const absoluteDir = join(this.storageBasePath, relativeDir);

    if (!existsSync(absoluteDir)) {
      mkdirSync(absoluteDir, { recursive: true });
    }

    const relativePath = join(relativeDir, actualFileName);
    const absolutePath = join(this.storageBasePath, relativePath);

    writeFileSync(absolutePath, buffer);

    // Return the relative Object ID (path from storage base)
    return relativePath;
  }

  async download(objectId: string): Promise<Buffer> {
    const absolutePath = this.getAbsolutePath(objectId);
    if (!existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    return readFileSync(absolutePath);
  }

  async downloadMultiple(objectIds: string[]): Promise<Buffer[]> {
    return Promise.all(objectIds.map((id) => this.download(id)));
  }

  async getSignedUrl(objectId: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, return a file:// URL
    const absolutePath = this.getAbsolutePath(objectId);
    return `file://${absolutePath}`;
  }

  private getAbsolutePath(objectId: string): string {
    // Handle legacy URLs or absolute paths
    if (objectId.startsWith('local://')) {
      return join(this.storageBasePath, objectId.replace('local://', ''));
    }
    if (objectId.startsWith('/') || objectId.startsWith(this.storageBasePath)) {
      return objectId;
    }
    return join(this.storageBasePath, objectId);
  }

  private getExtensionForType(type: string): string {
    switch (type) {
      case 'audio': return '.mp3';
      case 'caption': return '.srt';
      case 'image': return '.jpg';
      case 'video': return '.mp4';
      case 'script': return '.json';
      default: return '';
    }
  }
}
