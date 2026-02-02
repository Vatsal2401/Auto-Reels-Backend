import { Injectable } from '@nestjs/common';
import { IStorageService, StorageUploadParams } from '../interfaces/storage.interface';
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  createReadStream,
  createWriteStream,
} from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
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
    const { userId, mediaId, type, buffer, stream, fileName, step } = params;

    const absolutePath = this.getStoragePath(userId, mediaId, type, fileName, step);
    const absoluteDir = dirname(absolutePath);

    if (!existsSync(absoluteDir)) {
      mkdirSync(absoluteDir, { recursive: true });
    }

    if (buffer) {
      writeFileSync(absolutePath, buffer);
    } else if (stream) {
      await pipeline(stream, createWriteStream(absolutePath));
    } else {
      throw new Error('Neither buffer nor stream provided for upload');
    }

    // Return the relative Object ID (path from storage base)
    return absolutePath.replace(this.storageBasePath + '/', '').replace(this.storageBasePath, '');
  }

  async downloadToFile(objectId: string, targetPath: string): Promise<void> {
    const sourcePath = this.getAbsolutePath(objectId);
    if (!existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    await pipeline(createReadStream(sourcePath), createWriteStream(targetPath));
  }

  getLocalPath(objectId: string): string {
    return this.getAbsolutePath(objectId);
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

  async getSignedUrl(objectId: string, _expiresIn: number = 3600): Promise<string> {
    // For local storage, return a file:// URL
    const absolutePath = this.getAbsolutePath(objectId);
    return `file://${absolutePath}`;
  }

  private getStoragePath(
    userId: string,
    mediaId: string,
    type: string,
    fileName?: string,
    step?: string,
  ): string {
    const safeUserId = userId && userId !== 'null' ? userId : 'anonymous';
    const extension = this.getExtensionForType(type);
    const actualFileName = fileName || `${uuidv4()}${extension}`;
    const stepPart = step ? step : '';

    return join(
      this.storageBasePath,
      'users',
      safeUserId,
      'media',
      mediaId,
      type,
      stepPart,
      actualFileName,
    );
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
      case 'audio':
        return '.mp3';
      case 'caption':
        return '.srt';
      case 'image':
        return '.jpg';
      case 'video':
        return '.mp4';
      case 'script':
        return '.json';
      default:
        return '';
    }
  }
}
