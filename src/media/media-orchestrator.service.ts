import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { MediaStep, StepStatus } from './entities/media-step.entity';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaStatus, MediaAssetType } from './media.constants';
import { CreditsService } from '../credits/credits.service';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { RenderQueueService } from '../render/render-queue.service';
import { RemotionQueueService } from '../render/remotion-queue.service';
import { AiProviderFactory } from '../ai/ai-provider.factory';
import { ScriptJSON } from '../ai/interfaces/script-generator.interface';
import { GeminiTTSProvider } from '../ai/providers/gemini-tts.provider';
import { OpenAITTSProvider } from '../ai/providers/openai-tts.provider';
import { BackgroundMusic } from './entities/background-music.entity';

@Injectable()
export class MediaOrchestratorService {
  private readonly logger = new Logger(MediaOrchestratorService.name);

  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(MediaStep)
    private stepRepository: Repository<MediaStep>,
    @InjectRepository(MediaAsset)
    private assetRepository: Repository<MediaAsset>,
    private aiFactory: AiProviderFactory,
    private readonly creditsService: CreditsService,
    private readonly geminiTTS: GeminiTTSProvider,
    private readonly openAITTS: OpenAITTSProvider,
    @Inject('IStorageService') private storageService: IStorageService,
    @Inject('IVideoRenderer') private videoRenderer: IVideoRenderer,
    private readonly renderQueueService: RenderQueueService,
    private readonly remotionQueueService: RemotionQueueService,
    @InjectRepository(BackgroundMusic)
    private musicRepository: Repository<BackgroundMusic>,
  ) {}

  async processMedia(mediaId: string): Promise<void> {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
      relations: ['steps', 'assets'],
    });

    if (!media) {
      this.logger.error(`Media ${mediaId} not found`);
      return;
    }

    if (media.status === MediaStatus.COMPLETED || media.status === MediaStatus.FAILED) {
      this.logger.warn(`Media ${mediaId} is already in state ${media.status}`);
      return;
    }

    try {
      await this.mediaRepository.update(mediaId, { status: MediaStatus.PROCESSING });
      await this.runFlow(mediaId);

      // DELEGATED TO WORKER:
      // Final status update and credit deduction are now handled
      // by the render-worker upon successful job completion.
    } catch (error) {
      this.logger.error(`Flow execution failed for ${mediaId}:`, error);
      await this.mediaRepository.update(mediaId, {
        status: MediaStatus.FAILED,
        error_message: error.message || 'Unknown orchestration error',
      });
    }
  }

  private async runFlow(mediaId: string): Promise<void> {
    const steps = await this.stepRepository.find({ where: { media_id: mediaId } });

    // Find steps that are PENDING and dependencies are met
    const executableSteps = steps.filter((step) => {
      if (step.status !== StepStatus.PENDING) return false;
      const dependencies = step.depends_on || [];
      return dependencies.every((depName) => {
        const depStep = steps.find((s) => s.step === depName);
        return depStep && depStep.status === StepStatus.SUCCESS;
      });
    });

    if (executableSteps.length === 0) {
      const anyProcessing = steps.some((s) => s.status === StepStatus.PROCESSING);
      const anyFailed = steps.some((s) => s.status === StepStatus.FAILED);
      const allSuccess = steps.every((s) => s.status === StepStatus.SUCCESS);

      if (!anyProcessing && !anyFailed && !allSuccess) {
        this.logger.error(`Deadlock or missing steps in flow for ${mediaId}`);
      }
      return;
    }

    // Run executable steps in parallel
    await Promise.all(executableSteps.map((step) => this.executeStep(mediaId, step)));

    // Recursively run next available steps
    await this.runFlow(mediaId);
  }

  private async executeStep(mediaId: string, step: MediaStep): Promise<void> {
    this.logger.log(`Executing step: ${step.step} for media: ${mediaId}`);

    await this.stepRepository.update(step.id, {
      status: StepStatus.PROCESSING,
      started_at: new Date(),
    });

    try {
      const media = await this.mediaRepository.findOne({ where: { id: mediaId } });
      let resultBlobIds: string | string[] = null;

      switch (step.step) {
        case 'intent':
          resultBlobIds = await this.handleIntentStep(media);
          break;
        case 'script':
          resultBlobIds = await this.handleScriptStep(media);
          break;
        case 'audio':
          resultBlobIds = await this.handleAudioStep(media);
          break;
        case 'captions':
          resultBlobIds = await this.handleCaptionsStep(media);
          break;
        case 'images':
          resultBlobIds = await this.handleImagesStep(media);
          break;
        case 'render':
          resultBlobIds = await this.handleRenderStep(media);
          break;
        default:
          throw new Error(`Unknown step type: ${step.step}`);
      }

      await this.stepRepository.update(step.id, {
        status: step.step === 'render' ? StepStatus.PROCESSING : StepStatus.SUCCESS,
        blob_storage_id: resultBlobIds,
        completed_at: step.step === 'render' ? null : new Date(),
      });
    } catch (error) {
      this.logger.error(`Step ${step.step} failed for media ${mediaId}:`, error);
      await this.stepRepository.update(step.id, {
        status: StepStatus.FAILED,
        error_message: error.message || 'Unknown error',
      });
      throw error; // Propagate to stop flow
    }
  }

  // --- Step Handlers ---

  private async handleIntentStep(media: Media): Promise<string> {
    // UNIFIED STEP OPTIMIZATION:
    // We skip the explicit Intent AI call here to save time.
    // The "Script" step will now handle "intent interpretation" implicitly.
    // We just create a placeholder asset so dependencies in the DAG are satisfied.

    const placeholderIntent = {
      script_prompt: media.input_config?.topic || 'Inspiration',
      image_prompt: '', // Will be populated by Script Step
      audio_prompt: '', // Will be populated by Script Step
      caption_prompt: '', // Will be populated by Script Step
      rendering_hints: { fast_mode: true },
    };

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'intent',
      step: 'intent',
      buffer: Buffer.from(JSON.stringify(placeholderIntent)),
      fileName: 'intent.json',
    });

    await this.addAsset(media.id, MediaAssetType.INTENT, blobId, placeholderIntent);
    return blobId;
  }

  private async handleScriptStep(media: Media): Promise<string> {
    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    const provider = process.env.GEMINI_API_KEY ? 'gemini' : 'mock';
    const scriptProvider = this.aiFactory.getScriptGenerator(provider);

    const config = media.input_config || {};
    const durationMap: Record<string, number> = { '30-60': 45, '60-90': 75, '90-120': 105 };

    // Use interpreted script prompt if available
    const topic = intentData?.script_prompt || config.topic || 'Inspiration';

    const scriptJSON = await scriptProvider.generateScriptJSON({
      topic,
      language: config.language || 'English (US)',
      targetDurationSeconds: durationMap[config.duration] || 45,
      audioPrompt: intentData?.audio_prompt,
      visualStyle: config.imageStyle || 'Cinematic', // Pass user selection
    } as any);

    const scriptText = scriptJSON.scenes.map((s) => s.audio_text).join(' ');

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'script',
      step: 'script',
      buffer: Buffer.from(JSON.stringify({ text: scriptText, json: scriptJSON })),
      fileName: 'script.json',
    });

    // Update media with the script text for easy access
    await this.mediaRepository.update(media.id, { script: scriptText });

    await this.addAsset(media.id, MediaAssetType.SCRIPT, blobId, {
      duration: scriptJSON.total_duration,
      text: scriptText,
    });

    // UNIFIED STEP: Back-propagate generated style metadata to the INTENT asset
    if (intentAsset && scriptJSON.visual_style) {
      const updatedIntent = {
        ...intentData,
        image_prompt: scriptJSON.visual_style,
        audio_prompt: scriptJSON.audio_mood,
        caption_prompt: scriptJSON.caption_style,
      };

      // 1. Update Asset Metadata in DB
      await this.assetRepository.update(intentAsset.id, { metadata: updatedIntent });

      // 2. Update Blob Content (Optional, but good for consistency)
      await this.storageService.upload({
        userId: media.user_id,
        mediaId: media.id,
        type: 'intent',
        step: 'intent',
        buffer: Buffer.from(JSON.stringify(updatedIntent)),
        fileName: 'intent.json',
      });
    }

    return blobId;
  }

  private async handleAudioStep(media: Media): Promise<string> {
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.SCRIPT },
    });
    if (!scriptAsset) throw new Error('Script asset missing');

    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );
    const scriptText = (scriptData.text || '').trim();

    if (!scriptText) {
      this.logger.error(
        `Media ${media.id}: Script text is empty or missing. Cannot generate audio.`,
      );
      throw new Error('Audio Fail: Script text is empty. Please check the "script" step output.');
    }

    const audioProvider = this.aiFactory.getTextToSpeech(
      process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai',
    );

    // Primary: ElevenLabs
    this.logger.log(`Generating audio for media ${media.id} using ElevenLabs...`);
    let audioBuffer: Buffer;

    try {
      audioBuffer = await audioProvider.textToSpeech({
        text: scriptData.text,
        voiceId: media.input_config?.voiceId,
        language: media.input_config?.language,
        prompt: intentData?.audio_prompt,
      });
    } catch (error) {
      this.logger.warn(`Secondary Provider Fallback Enabled for Media ${media.id}`);
      this.logger.error(`ElevenLabs Failed: ${error.message}`);

      // Fallback 1: Gemini TTS (Google Journey Voices)
      try {
        this.logger.log(`Attempting Fallback 1: Gemini TTS (Google Journey Voices)...`);
        audioBuffer = await this.geminiTTS.textToSpeech({
          text: scriptData.text,
          prompt: intentData?.audio_prompt, // Helps select gender
        });
      } catch (geminiError) {
        this.logger.error(`Gemini TTS Failed: ${geminiError.message}`);

        // Fallback 2: OpenAI TTS (Last Resort)
        this.logger.log(`Attempting Fallback 2: OpenAI TTS...`);
        audioBuffer = await this.openAITTS.textToSpeech({
          text: scriptData.text,
        });
      }
    }

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'audio',
      step: 'audio',
      buffer: audioBuffer,
    });

    await this.addAsset(media.id, MediaAssetType.AUDIO, blobId);
    return blobId;
  }

  private async handleCaptionsStep(media: Media): Promise<string> {
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.AUDIO },
    });
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.SCRIPT },
    });
    if (!audioAsset || !scriptAsset) throw new Error('Audio or script asset missing');

    const audioBuffer = await this.storageService.download(audioAsset.blob_storage_id);
    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    // --- CAPTIONS TOGGLE ---
    const captionsConfig = media.input_config?.captions || {};
    // Default to enabled if not specified, for backward compatibility
    const captionsEnabled = captionsConfig.enabled !== false;

    let captionBuffer: Buffer;

    if (!captionsEnabled) {
      this.logger.log(`Captions disabled for media ${media.id}. Skipping generation.`);
      captionBuffer = Buffer.from('', 'utf-8'); // Empty file
    } else {
      // Logic Switch: Use 'Karaoke' provider if style matches, otherwise default 'local'
      const isKaraoke = captionsConfig.style?.toLowerCase() === 'karaoke';
      const providerKey = isKaraoke ? 'karaoke' : 'local';

      const captionProvider = this.aiFactory.getCaptionGenerator(providerKey);

      captionBuffer = await captionProvider.generateCaptions(
        audioBuffer,
        scriptData.text,
        intentData?.caption_prompt,
        isKaraoke ? 'word' : captionsConfig.timing || 'sentence', // Force word timing for Karaoke
        captionsConfig,
      );
    }

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'caption',
      step: 'captions',
      buffer: captionBuffer,
      fileName: `captions.json`,
    });

    await this.addAsset(media.id, MediaAssetType.CAPTION, blobId, {
      // Store config in metadata for Render step to read easily if needed
      // (though Render step reads input_config usually)
      skipped: !captionsEnabled,
    });
    return blobId;
  }

  private async handleImagesStep(media: Media): Promise<string[]> {
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.SCRIPT },
    });
    if (!scriptAsset) throw new Error('Script asset missing');

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );
    const scriptJson: ScriptJSON = scriptData.json;

    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    const imageProvider = this.aiFactory.getImageGenerator(
      media.input_config?.imageProvider || 'gemini',
    );

    // Use interpreted image prompt if available
    // Use the primary style prompt from Intent.
    // We avoid joining ALL scene prompts to prevent the AI from creating a 2x2 grid/collage.
    const masterPrompt =
      intentData?.image_prompt || `Cinematic video about ${media.input_config?.topic}`;

    // --- REEL FAST MODE LOGIC ---
    // Enforce strict image counts based on duration to minimize batches
    // 30-60s -> 4 images (1 batch)
    // 60-90s -> 6 images (2 batches)
    // 90-120s -> 8 images (2 batches)
    const durationStr = media.input_config?.duration || '30-60';
    let targetImageCount = 4;
    if (durationStr === '60-90') targetImageCount = 6;
    if (durationStr === '90-120') targetImageCount = 8;

    this.logger.log(
      `Reel Fast Mode: Generating strictly ${targetImageCount} images for duration ${durationStr}`,
    );

    const blobIds: string[] = [];
    const batchSize = 4;

    for (let i = 0; i < targetImageCount; i += batchSize) {
      const count = Math.min(batchSize, targetImageCount - i);
      const buffers = await imageProvider.generateImages({
        prompt: masterPrompt,
        style: media.input_config?.imageStyle,
        aspectRatio: media.input_config?.imageAspectRatio as any,
        count,
      });

      for (const buffer of buffers) {
        const blobId = await this.storageService.upload({
          userId: media.user_id,
          mediaId: media.id,
          type: 'image',
          step: 'images',
          buffer,
        });
        await this.addAsset(media.id, MediaAssetType.IMAGE, blobId);
        blobIds.push(blobId);
      }
    }
    return blobIds;
  }

  private async handleRenderStep(media: Media): Promise<string> {
    // PRODUCTION CHANGE: Delegate to worker queue
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.AUDIO },
    });
    const captionAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.CAPTION },
    });
    const imageAssets = await this.assetRepository.find({
      where: { media_id: media.id, type: MediaAssetType.IMAGE },
    });

    if (!audioAsset || !captionAsset || imageAssets.length === 0) {
      throw new Error('Assets missing for rendering');
    }

    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    // Handle Background Music
    let musicBlobId: string | undefined;
    const musicConfig = media.input_config?.music;
    if (musicConfig?.id) {
      const musicEntity = await this.musicRepository.findOne({ where: { id: musicConfig.id } });
      if (musicEntity) {
        musicBlobId = musicEntity.blob_storage_id;
      }
    }

    const durationCategory = media.input_config?.duration ?? '30-60';
    const step = await this.stepRepository.findOne({
      where: { media_id: media.id, step: 'render' },
    });
    const payload = {
      mediaId: media.id,
      stepId: step.id,
      userId: media.user_id,
      assets: {
        audio: audioAsset.blob_storage_id,
        caption: captionAsset.blob_storage_id,
        images: imageAssets.map((a) => a.blob_storage_id),
        music: musicBlobId,
      },
      options: {
        preset: 'superfast',
        rendering_hints: {
          ...intentData?.rendering_hints,
          fast_mode: true,
          smart_micro_scenes: true,
          captions: media.input_config?.captions,
          musicVolume: typeof musicConfig?.volume === 'number' ? musicConfig.volume : 0.2,
          width:
            media.input_config?.aspectRatio === '1:1'
              ? 1080
              : media.input_config?.aspectRatio === '16:9'
                ? 1280
                : 720,
          height:
            media.input_config?.aspectRatio === '1:1'
              ? 1080
              : media.input_config?.aspectRatio === '16:9'
                ? 720
                : 1280,
        },
      },
    };

    const useRemotionForShort =
      process.env.REMOTION_QUEUE_ENABLED !== 'false' && durationCategory === '30-60';
    if (useRemotionForShort) {
      await this.remotionQueueService.queueRemotionJob(payload);
    } else {
      await this.renderQueueService.queueRenderJob(payload);
    }

    return null; // Will be updated by worker on completion
  }

  private async addAsset(
    mediaId: string,
    type: MediaAssetType,
    blobId: string,
    metadata?: any,
  ): Promise<void> {
    const asset = this.assetRepository.create({
      media_id: mediaId,
      type,
      blob_storage_id: blobId,
      metadata,
    });
    await this.assetRepository.save(asset);
  }
}
