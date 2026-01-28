import { Module } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';

// Check if S3 credentials are available
const hasS3Credentials =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME &&
  process.env.AWS_ACCESS_KEY_ID.trim() !== '' &&
  process.env.AWS_SECRET_ACCESS_KEY.trim() !== '' &&
  process.env.S3_BUCKET_NAME.trim() !== '';

const isDevelopment = process.env.NODE_ENV !== 'production';

@Module({
  providers: [
    {
      provide: 'IStorageService',
      useClass: hasS3Credentials ? S3StorageProvider : LocalStorageProvider,
    },
  ],
  exports: ['IStorageService'],
})
export class StorageModule {
  constructor() {
    if (!hasS3Credentials && isDevelopment) {
      console.warn('⚠️  AWS S3 credentials not set. Using LOCAL storage provider for testing.');
      console.warn('💡 Files will be stored in: ./storage/');
      console.warn('💡 To use S3, set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME');
    }
  }
}
