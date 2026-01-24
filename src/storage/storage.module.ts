import { Module } from '@nestjs/common';
import { IStorageService } from './interfaces/storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  providers: [
    {
      provide: 'IStorageService',
      useClass: S3StorageProvider,
    },
  ],
  exports: ['IStorageService'],
})
export class StorageModule {}
