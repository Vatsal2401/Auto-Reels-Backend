# AI Providers

This directory contains implementations of AI service interfaces. To swap providers:

## Adding a New Script Generator

1. Create a new provider class implementing `IScriptGenerator`:
```typescript
@Injectable()
export class AnthropicScriptProvider implements IScriptGenerator {
  async generateScript(topic: string): Promise<string> {
    // Your implementation
  }
}
```

2. Update `ai.module.ts`:
```typescript
{
  provide: 'IScriptGenerator',
  useClass: AnthropicScriptProvider, // Change this
}
```

## Adding a New TTS Provider

1. Create a new provider implementing `ITextToSpeech`
2. Update the provider in `ai.module.ts`

## Adding a New Caption Generator

1. Create a new provider implementing `ICaptionGenerator`
2. Update the provider in `ai.module.ts`

## Example: Switching from OpenAI to Anthropic

```typescript
// Create src/ai/providers/anthropic-script.provider.ts
@Injectable()
export class AnthropicScriptProvider implements IScriptGenerator {
  // Implementation
}

// Update ai.module.ts
{
  provide: 'IScriptGenerator',
  useClass: AnthropicScriptProvider, // Changed from OpenAIScriptProvider
}
```

No changes needed in processors - they depend on the interface, not the implementation!
