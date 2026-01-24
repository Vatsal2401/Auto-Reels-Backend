# Storage Providers

This directory contains implementations of storage service interfaces. To swap storage providers:

## Adding a New Storage Provider (e.g., Google Cloud Storage)

1. Create a new provider implementing `IStorageService`:
```typescript
@Injectable()
export class GCSStorageProvider implements IStorageService {
  async uploadAudio(videoId: string, buffer: Buffer): Promise<string> {
    // Your GCS implementation
  }
  // ... implement all interface methods
}
```

2. Update `storage.module.ts`:
```typescript
{
  provide: 'IStorageService',
  useClass: GCSStorageProvider, // Changed from S3StorageProvider
}
```

## Example: Switching from S3 to Azure Blob Storage

```typescript
// Create src/storage/providers/azure-storage.provider.ts
@Injectable()
export class AzureStorageProvider implements IStorageService {
  // Implementation
}

// Update storage.module.ts
{
  provide: 'IStorageService',
  useClass: AzureStorageProvider,
}
```

No changes needed in processors - they depend on the interface!
