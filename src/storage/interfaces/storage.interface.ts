import { Readable } from 'stream';

export interface StorageUploadParams {
  userId?: string;
  mediaId: string;
  type: string; // 'audio', 'caption', 'image', 'video', 'avatar', 'script'
  buffer?: Buffer;
  stream?: Readable;
  fileName?: string; // Optional: specific filename
  step?: string; // Optional: specific step name
}

export interface IStorageService {
  /**
   * Uploads a buffer to storage and returns the Object ID (Storage Key)
   */
  upload(params: StorageUploadParams): Promise<string>;

  /**
   * Downloads a buffer from storage using the Object ID
   */
  download(objectId: string): Promise<Buffer>;

  /**
   * Downloads a file to a specific local path
   */
  downloadToFile(objectId: string, targetPath: string): Promise<void>;

  /**
   * Gets the local absolute path for an objectId if it exists in the mirror
   */
  getLocalPath(objectId: string): string;

  /**
   * Downloads multiple buffers from storage
   */
  downloadMultiple(objectIds: string[]): Promise<Buffer[]>;

  /**
   * Generates a signed URL for the Object ID
   */
  getSignedUrl(
    objectId: string,
    expiresIn?: number,
    options?: { promptDownload?: boolean; filename?: string },
  ): Promise<string>;

  /**
   * Generates a presigned PUT URL for direct client upload to the given key.
   * Returns the URL; the key (objectId) is the same as built from params.
   */
  getPresignedPutUrl(
    params: { userId: string; mediaId: string; type: string; fileName: string },
    expiresIn?: number,
    contentType?: string,
  ): Promise<{ uploadUrl: string; objectId: string }>;
}
