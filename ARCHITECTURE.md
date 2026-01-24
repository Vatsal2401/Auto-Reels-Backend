# Architecture & SOLID Principles

This document explains the architecture and how SOLID principles are applied for extensibility.

## SOLID Principles Applied

### 1. Single Responsibility Principle (SRP)
Each service has a single, well-defined responsibility:
- `IScriptGenerator`: Only generates scripts
- `ITextToSpeech`: Only converts text to speech
- `ICaptionGenerator`: Only generates captions
- `IStorageService`: Only handles storage operations
- `IVideoRenderer`: Only renders videos

### 2. Open/Closed Principle (OCP)
The system is **open for extension, closed for modification**:
- To add a new AI provider, create a new class implementing the interface
- No need to modify existing processors or services
- Example: Add `AnthropicScriptProvider` without touching `ScriptProcessor`

### 3. Liskov Substitution Principle (LSP)
Any implementation of an interface can be substituted without breaking functionality:
- `OpenAIScriptProvider` and `AnthropicScriptProvider` are interchangeable
- `S3StorageProvider` and `GCSStorageProvider` are interchangeable
- Processors work with any valid implementation

### 4. Interface Segregation Principle (ISP)
Interfaces are focused and specific:
- `IScriptGenerator` only has `generateScript()`
- `ITextToSpeech` only has `textToSpeech()`
- No fat interfaces that force implementations of unused methods

### 5. Dependency Inversion Principle (DIP)
High-level modules depend on abstractions, not concretions:
- Processors depend on `IScriptGenerator` interface, not `OpenAIScriptProvider`
- Processors depend on `IStorageService` interface, not `S3StorageProvider`
- Dependency injection via NestJS providers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Processors (High-level)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Script     │  │    Audio     │  │  Caption   │   │
│  │  Processor   │  │  Processor   │  │ Processor  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │            │
│         └─────────────────┴─────────────────┘            │
│                    │ (depends on)                         │
└────────────────────┼──────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌─────▼─────┐
    │Interfaces│            │ Providers │
    │(Abstract)│            │(Concrete) │
    └─────────┘            └───────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Implementation      │
         │  (OpenAI, S3, FFmpeg) │
         └───────────────────────┘
```

## Extensibility Examples

### Example 1: Switching from OpenAI to Anthropic

**Before (Tightly Coupled)**:
```typescript
// ScriptProcessor depends on concrete class
constructor(private openaiService: OpenAIService) {}
```

**After (Loosely Coupled)**:
```typescript
// ScriptProcessor depends on interface
constructor(@Inject('IScriptGenerator') private scriptGenerator: IScriptGenerator) {}
```

**To Switch**:
```typescript
// Only change in ai.module.ts
{
  provide: 'IScriptGenerator',
  useClass: AnthropicScriptProvider, // Changed here
}
```

### Example 2: Adding Google Cloud Storage

1. Create `GCSStorageProvider` implementing `IStorageService`
2. Update `storage.module.ts`:
```typescript
{
  provide: 'IStorageService',
  useClass: GCSStorageProvider,
}
```
3. Done! All processors automatically use GCS.

### Example 3: Adding Cloud Rendering

1. Create `CloudRendererProvider` implementing `IVideoRenderer`
2. Update `render.module.ts`
3. No processor changes needed

## Benefits

1. **Easy Testing**: Mock interfaces instead of real services
2. **Vendor Flexibility**: Switch providers without code changes in processors
3. **Multiple Providers**: Support multiple providers simultaneously
4. **Future-Proof**: Add new providers without modifying existing code
5. **Team Collaboration**: Different teams can work on different providers

## Module Structure

```
src/
├── ai/
│   ├── interfaces/          # Contracts (abstractions)
│   │   ├── script-generator.interface.ts
│   │   ├── text-to-speech.interface.ts
│   │   └── caption-generator.interface.ts
│   └── providers/           # Implementations (concretions)
│       ├── openai-script.provider.ts
│       ├── openai-tts.provider.ts
│       └── replicate-caption.provider.ts
├── storage/
│   ├── interfaces/
│   │   └── storage.interface.ts
│   └── providers/
│       └── s3-storage.provider.ts
└── render/
    ├── interfaces/
    │   └── video-renderer.interface.ts
    └── providers/
        └── ffmpeg-renderer.provider.ts
```

## Best Practices

1. **Always depend on interfaces** in processors and services
2. **Use dependency injection** with `@Inject()` decorator
3. **Keep interfaces focused** - one responsibility per interface
4. **Document provider requirements** in provider READMEs
5. **Test with mocks** using interface types
