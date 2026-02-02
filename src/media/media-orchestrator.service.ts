import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { MediaStep, StepStatus } from './entities/media-step.entity';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaStatus, MediaAssetType, CREDIT_COSTS } from './media.constants';
import { CreditsService } from '../credits/credits.service';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { RenderQueueService } from '../render/render-queue.service';
import { AiProviderFactory } from '../ai/ai-provider.factory';
import { ScriptJSON } from '../ai/interfaces/script-generator.interface';
import { GeminiTTSProvider } from '../ai/providers/gemini-tts.provider';
import { OpenAITTSProvider } from '../ai/providers/openai-tts.provider';

@Injectable()
export class MediaOrchestratorService {
  private readonly logger = new Logger(MediaOrchestratorService.name);
  private static isJobActive = false; // Production lock for memory stability

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
  ) {}

  async processMedia(mediaId: string): Promise<void> {
    if (MediaOrchestratorService.isJobActive) {
      this.logger.warn(
        `Another media job is active. Skipping for now to preserve 512MB RAM: ${mediaId}`,
      );
      return;
    }

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

    MediaOrchestratorService.isJobActive = true;
    try {
      await this.mediaRepository.update(mediaId, { status: MediaStatus.PROCESSING });
      await this.runFlow(mediaId);

      // Finalize media status if all steps succeeded
      const allSteps = await this.stepRepository.find({ where: { media_id: mediaId } });
      const failedStep = allSteps.find((s) => s.status === StepStatus.FAILED);

      if (failedStep) {
        await this.mediaRepository.update(mediaId, {
          status: MediaStatus.FAILED,
          error_message: failedStep.error_message,
        });
      } else if (allSteps.every((s) => s.status === StepStatus.SUCCESS)) {
        // Find the final video asset if any
        const videoAsset = await this.assetRepository.findOne({
          where: { media_id: mediaId, type: MediaAssetType.VIDEO },
          order: { created_at: 'DESC' },
        });

        await this.mediaRepository.update(mediaId, {
          status: MediaStatus.COMPLETED,
          blob_storage_id: videoAsset?.blob_storage_id || media.blob_storage_id,
          completed_at: new Date(),
        });

        // Deduct credits after successful completion
        if (media.user_id) {
          try {
            const topic = media.input_config?.topic || 'Media';
            const duration = media.input_config?.duration || '30-60';
            const creditCost = CREDIT_COSTS[duration] || CREDIT_COSTS['default'];

            await this.creditsService.deductCredits(
              media.user_id,
              creditCost,
              `Media generation: ${topic}`,
              media.id,
              { media_id: media.id, topic, duration, creditCost },
            );
            this.logger.log(
              `Deducted ${creditCost} credits for completed media ${mediaId} (duration: ${duration})`,
            );
          } catch (creditError) {
            this.logger.error(`Failed to deduct credits for media ${mediaId}:`, creditError);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Flow execution failed for ${mediaId}:`, error);
      await this.mediaRepository.update(mediaId, {
        status: MediaStatus.FAILED,
        error_message: error.message || 'Unknown orchestration error',
      });
    } finally {
      MediaOrchestratorService.isJobActive = false;
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
    const interpreter = this.aiFactory.getIntentInterpreter('gemini');
    const userPrompt = media.input_config?.topic || 'Inspiration';

    const interpreted = await interpreter.interpretIntent(userPrompt);

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'intent',
      step: 'intent',
      buffer: Buffer.from(JSON.stringify(interpreted)),
      fileName: 'intent.json',
    });

    await this.addAsset(media.id, MediaAssetType.INTENT, blobId, interpreted);
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
    });

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

    const captionProvider = this.aiFactory.getCaptionGenerator('replicate');
    const captionBuffer = await captionProvider.generateCaptions(
      audioBuffer,
      scriptData.text,
      intentData?.caption_prompt,
    );

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'caption',
      step: 'captions',
      buffer: captionBuffer,
    });

    await this.addAsset(media.id, MediaAssetType.CAPTION, blobId);
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
    const masterPrompt = intentData?.image_prompt
      ? `${intentData.image_prompt}. ` + scriptJson.scenes.map((s) => s.image_prompt).join('. ')
      : `Cinematic video about ${media.input_config?.topic}. ` +
        scriptJson.scenes.map((s) => s.image_prompt).join('. ');

    const sceneCount = scriptJson.scenes.length;
    const blobIds: string[] = [];
    const batchSize = 4;

    for (let i = 0; i < sceneCount; i += batchSize) {
      const count = Math.min(batchSize, sceneCount - i);
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

    // PRODUCTION CHANGE: Delegate to worker queue
    await this.renderQueueService.queueRenderJob({
      mediaId: media.id,
      stepId: (await this.stepRepository.findOne({ where: { media_id: media.id, step: 'render' } }))
        .id,
      userId: media.user_id,
      assets: {
        audio: audioAsset.blob_storage_id,
        caption: captionAsset.blob_storage_id,
        images: imageAssets.map((a) => a.blob_storage_id),
      },
      options: {
        preset: 'fast', // Default to fast
        rendering_hints: intentData?.rendering_hints,
      },
    });

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
