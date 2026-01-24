export interface IStorageService {
  uploadAudio(videoId: string, buffer: Buffer): Promise<string>;
  uploadCaption(videoId: string, buffer: Buffer): Promise<string>;
  uploadAsset(videoId: string, buffer: Buffer, contentType: string): Promise<string>;
  uploadVideo(videoId: string, buffer: Buffer): Promise<string>;
  download(s3Url: string): Promise<Buffer>;
  downloadMultiple(s3Urls: string[]): Promise<Buffer[]>;
  getSignedUrl(s3Url: string, expiresIn?: number): Promise<string>;
}
