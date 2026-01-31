import { Injectable } from '@nestjs/common';
import { IScriptGenerator, ScriptJSON, ScriptGenerationOptions } from '../interfaces/script-generator.interface';

@Injectable()
export class MockScriptProvider implements IScriptGenerator {
  async generateScript(topic: string): Promise<string> {
    // Return a mock script for testing
    return `🎬 Welcome to this video about ${topic}!

In the next 60 seconds, I'm going to share some amazing insights that will change how you think about this topic.

Here's what you need to know:
1. First key point about ${topic}
2. Second important aspect
3. Actionable takeaway

Remember: ${topic} is all about understanding the fundamentals and applying them consistently.

If you found this helpful, make sure to like and follow for more content like this!

#${topic.replace(/\s+/g, '')} #Shorts #Tips`;
  }

  async generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON> {
    const topic = typeof optionsOrTopic === 'string' ? optionsOrTopic : optionsOrTopic.topic;
    // Return a mock JSON script for testing
    return {
      scenes: [
        {
          scene_number: 1,
          description: 'Introduction scene with engaging visual',
          image_prompt: `Professional, modern scene related to ${topic}, clean background, engaging composition, high quality, 4K`,
          duration: 5,
          audio_text: `Welcome to this video about ${topic}!`,
        },
        {
          scene_number: 2,
          description: 'Main content scene',
          image_prompt: `Visual representation of ${topic} concepts, informative, clear, professional`,
          duration: 10,
          audio_text: `In the next 60 seconds, I'm going to share some amazing insights about ${topic}.`,
        },
        {
          scene_number: 3,
          description: 'Key points scene',
          image_prompt: `Key points and takeaways about ${topic}, organized, visual, engaging`,
          duration: 10,
          audio_text: `Here's what you need to know: First key point, second important aspect, and actionable takeaways.`,
        },
        {
          scene_number: 4,
          description: 'Conclusion scene',
          image_prompt: `Conclusion and call to action related to ${topic}, motivational, clear message`,
          duration: 5,
          audio_text: `Remember: ${topic} is all about understanding the fundamentals. If you found this helpful, like and follow!`,
        },
      ],
      total_duration: 30,
      topic: topic,
    };
  }
}
