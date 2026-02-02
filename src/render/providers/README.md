# Video Renderer Providers

This directory contains implementations of video rendering services. To swap renderers:

## Adding a New Renderer (e.g., Cloud-based rendering)

1. Create a new provider implementing `IVideoRenderer`:

```typescript
@Injectable()
export class CloudRendererProvider implements IVideoRenderer {
  async compose(options: ComposeOptions): Promise<Buffer> {
    // Your cloud rendering implementation
  }
}
```

2. Update `render.module.ts`:

```typescript
{
  provide: 'IVideoRenderer',
  useClass: CloudRendererProvider, // Changed from FFmpegRendererProvider
}
```

## Example: Switching to a Cloud Rendering Service

```typescript
// Create src/render/providers/cloud-renderer.provider.ts
@Injectable()
export class CloudRendererProvider implements IVideoRenderer {
  async compose(options: ComposeOptions): Promise<Buffer> {
    // Call cloud rendering API
  }
}

// Update render.module.ts
{
  provide: 'IVideoRenderer',
  useClass: CloudRendererProvider,
}
```

No changes needed in processors - they depend on the interface!
