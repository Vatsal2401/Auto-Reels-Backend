import { Injectable, Inject } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';

export type BlobStorageBackend = 'supabase' | 's3';

@Injectable()
export class StorageResolverService {
  constructor(
    @Inject('SupabaseStorage') private readonly supabaseStorage: IStorageService,
    @Inject('AwsS3Storage') private readonly awsS3Storage: IStorageService,
  ) {}

  async getSignedUrl(
    backend: BlobStorageBackend,
    objectId: string,
    expiresIn: number = 3600,
    options?: { promptDownload?: boolean; filename?: string },
  ): Promise<string> {
    const provider = backend === 'supabase' ? this.supabaseStorage : this.awsS3Storage;
    return provider.getSignedUrl(objectId, expiresIn, options);
  }
}
