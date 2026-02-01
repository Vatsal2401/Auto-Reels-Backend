export interface StorageUploadParams {
  userId?: string;
  mediaId: string;
  type: string; // 'audio', 'caption', 'image', 'video', 'avatar', 'script'
  buffer: Buffer;
  fileName?: string; // Optional: specific filename
  step?: string;     // Optional: specific step name
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
   * Downloads multiple buffers from storage
   */
  downloadMultiple(objectIds: string[]): Promise<Buffer[]>;

  /**
   * Generates a signed URL for the Object ID
   */
  getSignedUrl(objectId: string, expiresIn?: number, options?: { promptDownload?: boolean; filename?: string }): Promise<string>;
}
