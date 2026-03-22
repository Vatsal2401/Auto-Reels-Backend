import { Injectable, Logger } from '@nestjs/common';
import { IIntentInterpreter, InterpretedIntent } from '../interfaces/intent-interpreter.interface';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { IntentSchema } from '../../langchain/schemas/intent.schema';
import { getIntentSystemPrompt } from '../prompts/intent-prompts';
import { ChatPromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class GeminiIntentProvider implements IIntentInterpreter {
  private readonly logger = new Logger(GeminiIntentProvider.name);

  constructor(private readonly registry: LangChainRegistry) {}

  async interpretIntent(userPrompt: string): Promise<InterpretedIntent> {
    const systemPrompt = getIntentSystemPrompt(userPrompt);

    const promptTemplate = ChatPromptTemplate.fromMessages([['human', '{systemPrompt}']]);

    const chain = promptTemplate.pipe(this.registry.getStructuredGemini(IntentSchema));

    try {
      const result = await chain.invoke({ systemPrompt });
      return result as InterpretedIntent;
    } catch (err) {
      this.logger.error(
        `interpretIntent.error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
