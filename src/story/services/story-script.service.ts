import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildStoryScriptPrompt } from '../prompts/story-script.prompt';
import { StoryScriptJSON } from '../interfaces/story-script.interface';
import { Story } from '../entities/story.entity';
import { StoryCharacter } from '../entities/story-character.entity';
import { StoryScene } from '../entities/story-scene.entity';

@Injectable()
export class StoryScriptService {
  private readonly logger = new Logger(StoryScriptService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Story)
    private readonly storyRepo: Repository<Story>,
    @InjectRepository(StoryCharacter)
    private readonly characterRepo: Repository<StoryCharacter>,
    @InjectRepository(StoryScene)
    private readonly sceneRepo: Repository<StoryScene>,
  ) {}

  async generateScript(params: {
    mediaId: string;
    userId: string;
    genre: string;
    sceneCount: number;
    userPrompt: string;
  }): Promise<StoryScriptJSON> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const { systemPrompt, userPrompt } = buildStoryScriptPrompt({
      genre: params.genre,
      sceneCount: params.sceneCount,
      userPrompt: params.userPrompt,
    });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    this.logger.log(`Generating story script for media ${params.mediaId} (genre: ${params.genre})`);

    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/[\u0000-\u001F\u007F]/g, '');

    let script: StoryScriptJSON;
    try {
      script = JSON.parse(jsonText);
    } catch {
      this.logger.error(`Failed to parse story script response: ${text.slice(0, 300)}`);
      throw new Error('Failed to parse story script from Gemini');
    }

    // Recompute start_time_seconds
    let elapsed = 0;
    for (const scene of script.scenes) {
      scene.start_time_seconds = elapsed;
      elapsed += scene.duration_seconds;
    }
    script.total_duration_seconds = elapsed;

    // Persist to DB
    const story = this.storyRepo.create({
      media_id: params.mediaId,
      user_id: params.userId,
      title: script.title,
      prompt: params.userPrompt,
      genre: params.genre,
      scene_count: script.scenes.length,
    });
    const savedStory = await this.storyRepo.save(story);

    if (script.characters?.length > 0) {
      const chars = script.characters.map((c) =>
        this.characterRepo.create({
          story_id: savedStory.id,
          name: c.name,
          appearance: c.appearance,
          clothing: c.clothing,
          style: c.style,
          consistency_anchor: c.consistency_anchor,
        }),
      );
      await this.characterRepo.save(chars);
    }

    if (script.scenes?.length > 0) {
      const scenes = script.scenes.map((s) =>
        this.sceneRepo.create({
          story_id: savedStory.id,
          scene_number: s.scene_number,
          description: s.description,
          image_prompt: s.image_prompt,
          subtitle: s.subtitle,
          narration: s.narration,
          camera_motion: s.camera_motion,
          duration_seconds: s.duration_seconds,
          start_time_seconds: s.start_time_seconds,
        }),
      );
      await this.sceneRepo.save(scenes);
    }

    this.logger.log(
      `Story script generated: ${script.scenes.length} scenes, ${script.total_duration_seconds}s`,
    );

    return script;
  }

  async updateSceneImageUrl(storyId: string, sceneNumber: number, imageUrl: string): Promise<void> {
    await this.sceneRepo.update(
      { story_id: storyId, scene_number: sceneNumber },
      { image_url: imageUrl },
    );
  }

  async findStoryByMediaId(mediaId: string): Promise<Story | null> {
    return this.storyRepo.findOne({ where: { media_id: mediaId } });
  }
}
