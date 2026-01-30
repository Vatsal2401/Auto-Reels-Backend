import { Module } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

// Check if Storage Configuration is valid for S3/Supabase
const currentStorage = process.env.CURRENT_BLOB_STORAGE;
const hasS3ProviderConfig =
  (currentStorage === 's3' &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME) ||
  (currentStorage === 'supabase' &&
    process.env.SUPABASE_STORAGE_ACCESS_KEY_ID &&
    process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY &&
    process.env.SUPABASE_STORAGE_ENDPOINT &&
    process.env.SUPABASE_STORAGE_BUCKET_NAME);

const isDevelopment = process.env.NODE_ENV !== 'production';

@Module({
  providers: [
    {
      provide: 'IStorageService',
      useClass: hasS3ProviderConfig ? S3StorageProvider : LocalStorageProvider,
    },
  ],
  exports: ['IStorageService'],
})
export class StorageModule {
  constructor() {
    if (!hasS3ProviderConfig && isDevelopment) {
      console.warn('⚠️  Cloud Storage credentials not set. Using LOCAL storage provider for testing.');
      console.warn('💡 Files will be stored in: ./storage/');
      console.warn('💡 To use Cloud Storage, set: CURRENT_BLOB_STORAGE to "s3" or "supabase" and provide respective keys.');
    }
  }
}
