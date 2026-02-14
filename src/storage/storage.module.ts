import { Module } from '@nestjs/common';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { AwsS3StorageProvider } from './providers/aws-s3-storage.provider';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageResolverService } from './storage-resolver.service';

const hasAwsConfig =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;

const hasSupabaseConfig =
  process.env.SUPABASE_STORAGE_ACCESS_KEY_ID &&
  process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY &&
  process.env.SUPABASE_STORAGE_ENDPOINT &&
  process.env.SUPABASE_STORAGE_BUCKET_NAME;

const currentStorage = process.env.CURRENT_BLOB_STORAGE;
const hasS3ProviderConfig =
  (currentStorage === 's3' && hasAwsConfig) || (currentStorage === 'supabase' && hasSupabaseConfig);

const isDevelopment = process.env.NODE_ENV !== 'production';

const providers: any[] = [];

if (hasAwsConfig) {
  providers.push(
    { provide: 'AwsS3Storage', useClass: AwsS3StorageProvider },
    { provide: 'IStorageService', useExisting: 'AwsS3Storage' },
  );
} else if (hasS3ProviderConfig) {
  providers.push({ provide: 'IStorageService', useClass: S3StorageProvider });
} else {
  providers.push({ provide: 'IStorageService', useClass: LocalStorageProvider });
}

if (hasSupabaseConfig) {
  providers.push({ provide: 'SupabaseStorage', useClass: SupabaseStorageProvider });
}

if (hasAwsConfig && hasSupabaseConfig) {
  providers.push(StorageResolverService);
}

@Module({
  providers,
  exports:
    hasAwsConfig && hasSupabaseConfig
      ? ['IStorageService', StorageResolverService]
      : ['IStorageService'],
})
export class StorageModule {
  constructor() {
    if (!hasS3ProviderConfig && !hasAwsConfig && isDevelopment) {
      console.warn(
        '⚠️  Cloud Storage credentials not set. Using LOCAL storage provider for testing.',
      );
      console.warn('💡 Files will be stored in: ./storage/');
      console.warn(
        '💡 To use Cloud Storage, set CURRENT_BLOB_STORAGE to "s3" or "supabase" and provide respective keys. For dual storage (legacy Supabase + new S3), set both AWS_* and SUPABASE_STORAGE_* env vars.',
      );
    }
  }
}
