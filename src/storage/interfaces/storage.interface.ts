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

  /** Build the S3 key for a given user/media/type/file combination (without uploading). */
  buildObjectKey(userId: string, mediaId: string, type: string, fileName: string): string;

  /** Initiate an S3 multipart upload. Returns the UploadId. */
  createMultipartUpload(key: string, contentType: string): Promise<string>;

  /** Generate a presigned URL for a single part of a multipart upload. */
  presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn: number): Promise<string>;

  /** Complete a multipart upload after all parts have been uploaded. */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
  ): Promise<void>;

  /** Abort an in-progress multipart upload and release all uploaded parts. */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /**
   * Upload a single Buffer as a multipart part directly (server-side, no presigned URL).
   * Returns the ETag for use in completeMultipartUpload.
   */
  uploadPartDirect(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string>;
}
