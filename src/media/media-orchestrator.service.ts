import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
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
import { User } from '../auth/entities/user.entity';
import { getWatermarkConfig } from '../render/watermark.util';
import {
  ViralCaptionOptimizerService,
  ViralCaptionLine,
} from '../ai/services/viral-caption-optimizer.service';
import { UgcScriptService } from '../ugc/services/ugc-script.service';
import { HedraService } from '../ugc/services/hedra.service';
import { BrollLibraryService } from '../ugc/services/broll-library.service';
import { UgcComposeService } from '../ugc/services/ugc-compose.service';
import { UgcScene } from '../ugc/services/ugc-script.service';
import { StoryScriptService } from '../story/services/story-script.service';
import { StoryRenderQueueService } from '../story/queues/story-render-queue.service';

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
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    private readonly viralCaptionOptimizer: ViralCaptionOptimizerService,
    @Optional() private readonly ugcScriptService: UgcScriptService,
    @Optional() private readonly hedraService: HedraService,
    @Optional() private readonly brollLibraryService: BrollLibraryService,
    @Optional() private readonly ugcComposeService: UgcComposeService,
    @Optional() private readonly storyScriptService: StoryScriptService,
    @Optional() private readonly storyRenderQueueService: StoryRenderQueueService,
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
        case 'voice':
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
        case 'product':
          resultBlobIds = await this.handleUgcProductStep(media);
          break;
        case 'ugcScript':
          resultBlobIds = await this.handleUgcScriptStep(media);
          break;
        case 'broll':
          resultBlobIds = await this.handleUgcBrollStep(media);
          break;
        case 'actor':
          resultBlobIds = await this.handleUgcActorStep(media);
          break;
        case 'ugcCompose':
          resultBlobIds = await this.handleUgcComposeStep(media);
          break;
        case 'storyScript':
          resultBlobIds = await this.handleStoryScriptStep(media);
          break;
        case 'storyImages':
          resultBlobIds = await this.handleStoryImagesStep(media);
          break;
        case 'storyAudio':
          resultBlobIds = await this.handleStoryAudioStep(media);
          break;
        case 'storyCaptions':
          resultBlobIds = await this.handleStoryCaptionsStep(media);
          break;
        case 'storyRender':
          await this.handleStoryRenderStep(media, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.step}`);
      }

      const isWorkerHandled =
        step.step === 'render' || step.step === 'ugcCompose' || step.step === 'storyRender';
      await this.stepRepository.update(step.id, {
        status: isWorkerHandled ? StepStatus.PROCESSING : StepStatus.SUCCESS,
        blob_storage_id: resultBlobIds,
        completed_at: isWorkerHandled ? null : new Date(),
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
      tone: config.tone,
      hookType: config.hookType,
      cta: config.cta,
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
    // For UGC flows, use ugc_script which contains voiceover_text
    let scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.SCRIPT },
    });
    if (!scriptAsset) {
      scriptAsset = await this.assetRepository.findOne({
        where: { media_id: media.id, type: MediaAssetType.UGC_SCRIPT },
      });
    }
    if (!scriptAsset) throw new Error('Script asset missing');

    const intentAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.INTENT },
    });
    const intentData = intentAsset ? (intentAsset.metadata as any) : null;

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );
    // Support both standard script format ({text}) and UGC format ({voiceover_text})
    const scriptText = (scriptData.text || scriptData.voiceover_text || '').trim();

    if (!scriptText) {
      this.logger.error(
        `Media ${media.id}: Script text is empty or missing. Cannot generate audio.`,
      );
      throw new Error('Audio Fail: Script text is empty. Please check the "script" step output.');
    }

    // Mad Scientist - Energetic is an ElevenLabs-exclusive voice.
    // All other voices use Sarvam (if key available) → ElevenLabs → OpenAI.
    const MAD_SCIENTIST_ELEVENLABS_ID = 'yjJ45q8TVCrtMhEKurxY';
    const voiceLabel = media.input_config?.voiceLabel || '';
    const isMadScientist = voiceLabel === 'Mad Scientist - Energetic';

    let providerKey: string;
    let resolvedVoiceId: string = media.input_config?.voiceId;

    if (isMadScientist && process.env.ELEVENLABS_API_KEY) {
      providerKey = 'elevenlabs';
      resolvedVoiceId = MAD_SCIENTIST_ELEVENLABS_ID;
    } else if (process.env.SARVAM_API_KEY) {
      providerKey = 'sarvam';
    } else if (process.env.ELEVENLABS_API_KEY) {
      providerKey = 'elevenlabs';
    } else {
      providerKey = 'openai';
    }

    const audioProvider = this.aiFactory.getTextToSpeech(providerKey);
    const primaryProviderName =
      providerKey === 'elevenlabs' ? 'ElevenLabs' : providerKey === 'sarvam' ? 'Sarvam' : 'OpenAI';

    // Primary: Mad Scientist → ElevenLabs | Others → Sarvam > ElevenLabs > OpenAI
    this.logger.log(
      `Generating audio for media ${media.id} via ${primaryProviderName} (voice: ${voiceLabel || resolvedVoiceId})...`,
    );
    let audioBuffer: Buffer;

    try {
      audioBuffer = await audioProvider.textToSpeech({
        text: scriptText,
        voiceId: resolvedVoiceId,
        language: media.input_config?.language,
        prompt: intentData?.audio_prompt,
      });
    } catch (error) {
      this.logger.warn(`Secondary Provider Fallback Enabled for Media ${media.id}`);
      this.logger.error(`${primaryProviderName} TTS Failed: ${error.message}`);

      // Fallback 1: Gemini TTS (Google Journey Voices)
      try {
        this.logger.log(`Attempting Fallback 1: Gemini TTS (Google Journey Voices)...`);
        audioBuffer = await this.geminiTTS.textToSpeech({
          text: scriptText,
          prompt: intentData?.audio_prompt, // Helps select gender
        });
      } catch (geminiError) {
        this.logger.error(`Gemini TTS Failed: ${geminiError.message}`);

        // Fallback 2: OpenAI TTS (Last Resort)
        this.logger.log(`Attempting Fallback 2: OpenAI TTS...`);
        audioBuffer = await this.openAITTS.textToSpeech({
          text: scriptText,
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

    // --- VIRAL CAPTION OPTIMIZER ---
    let preOptimizedLines: ViralCaptionLine[] | undefined;
    let hookStrength: number | undefined;
    if (captionsEnabled) {
      const optimized = await this.viralCaptionOptimizer.optimize(scriptData.text);
      if (optimized) {
        preOptimizedLines = optimized.captions;
        hookStrength = optimized.hook_strength;
        this.logger.log(
          `Viral optimizer: hook_strength=${hookStrength}, lines=${preOptimizedLines.length}`,
        );
      } else {
        this.logger.warn('Viral optimizer failed or returned null — using heuristic splitting');
      }
    }

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
        { ...captionsConfig, preOptimizedLines },
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
      skipped: !captionsEnabled,
      hook_strength: hookStrength ?? null,
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
    // 30-60s -> 8 images (2 parallel bulk calls of 4)
    // 60-90s -> 6 images (2 batches)
    // 90-120s -> 8 images (2 batches)
    const durationStr = media.input_config?.duration || '30-60';
    let targetImageCount = 8;
    if (durationStr === '60-90') targetImageCount = 6;
    if (durationStr === '90-120') targetImageCount = 8;

    this.logger.log(
      `Reel Fast Mode: Generating strictly ${targetImageCount} images for duration ${durationStr}`,
    );

    // Build per-scene prompts with shared style anchor for visual continuity
    const scenes = scriptJson?.scenes ?? [];
    const styleAnchor = [scriptJson?.visual_style, scriptJson?.audio_mood]
      .filter(Boolean)
      .join(', ');
    const sceneIndices = this.selectSceneIndices(scenes.length, targetImageCount);

    const scenePrompts: string[] =
      sceneIndices.length > 0
        ? sceneIndices.map((idx) => {
            const base = scenes[idx]?.image_prompt || masterPrompt;
            return styleAnchor ? `${base}. Visual style: ${styleAnchor}` : base;
          })
        : Array.from({ length: targetImageCount }, () => masterPrompt);

    this.logger.debug(`Per-scene prompts for media ${media.id}: ${JSON.stringify(scenePrompts)}`);

    // Generate images via 2 parallel bulk calls (4 images each) for 30-60s videos
    const batchSize = 4;
    const batch1Prompt = scenePrompts[0];
    const batch2Prompt = scenePrompts[batchSize] ?? scenePrompts[0];

    this.logger.log(
      `Reel Fast Mode: 2 parallel bulk calls (${batchSize} images each) for media ${media.id}`,
    );

    const [batch1Buffers, batch2Buffers] = await Promise.all([
      imageProvider.generateImages({
        prompt: batch1Prompt,
        style: media.input_config?.imageStyle,
        aspectRatio: media.input_config?.imageAspectRatio as any,
        count: batchSize,
      }),
      imageProvider.generateImages({
        prompt: batch2Prompt,
        style: media.input_config?.imageStyle,
        aspectRatio: media.input_config?.imageAspectRatio as any,
        count: batchSize,
      }),
    ]);

    const bufferArrays = [[...batch1Buffers], [...batch2Buffers]];

    const blobIds: string[] = [];
    for (const buffers of bufferArrays) {
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

  private selectSceneIndices(sceneCount: number, imageCount: number): number[] {
    if (sceneCount === 0) return [];
    if (sceneCount <= imageCount) return Array.from({ length: sceneCount }, (_, i) => i);
    const step = (sceneCount - 1) / (imageCount - 1);
    return Array.from({ length: imageCount }, (_, i) => Math.round(i * step));
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

    const user = await this.userRepository.findOne({ where: { id: media.user_id } });

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
          ...(!intentData?.rendering_hints?.motion_preset &&
            (!Array.isArray(intentData?.rendering_hints?.motion_presets) ||
              intentData.rendering_hints.motion_presets.length === 0) && {
              motion_preset: 'kenBurns',
            }),
          fast_mode: true,
          smart_micro_scenes: true,
          captions: media.input_config?.captions,
          language: media.input_config?.language,
          pacing_style:
            media.input_config?.pacing_style ?? intentData?.rendering_hints?.pacing_style,
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
      monetization: getWatermarkConfig(user?.is_premium ?? false),
    };

    const allowedUserIds = (process.env.REMOTION_ALLOWED_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const useRemotionForShort =
      durationCategory === '30-60' &&
      (process.env.REMOTION_QUEUE_ENABLED !== 'false' || allowedUserIds.includes(media.user_id));
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

  // ─── UGC Step Handlers ───────────────────────────────────────────────────

  /** product: parse and store the product brief JSON to S3 */
  private async handleUgcProductStep(media: Media): Promise<string> {
    const config = media.input_config || {};
    const brief = {
      productName: config.productName,
      productDescription: config.productDescription,
      benefits: config.benefits || [],
      targetAudience: config.targetAudience,
      callToAction: config.callToAction,
      ugcStyle: config.ugcStyle,
      actorId: config.actorId,
      voiceId: config.voiceId,
    };

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'ugc_brief',
      step: 'product',
      buffer: Buffer.from(JSON.stringify(brief)),
      fileName: 'product-brief.json',
    });

    await this.addAsset(media.id, MediaAssetType.UGC_BRIEF, blobId, brief);
    return blobId;
  }

  /** ugcScript: Gemini generates the UgcScriptJSON */
  private async handleUgcScriptStep(media: Media): Promise<string> {
    if (!this.ugcScriptService) throw new Error('UgcScriptService not available');

    const briefAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.UGC_BRIEF },
    });
    if (!briefAsset) throw new Error('UGC brief asset missing');

    const brief = briefAsset.metadata as any;
    const script = await this.ugcScriptService.generateScript({
      productName: brief.productName,
      productDescription: brief.productDescription,
      benefits: brief.benefits || [],
      targetAudience: brief.targetAudience,
      callToAction: brief.callToAction,
      ugcStyle: brief.ugcStyle,
    });

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'ugc_script',
      step: 'ugcScript',
      buffer: Buffer.from(JSON.stringify(script)),
      fileName: 'ugc-script.json',
    });

    await this.addAsset(media.id, MediaAssetType.UGC_SCRIPT, blobId, {
      hook: script.hook,
      hook_strength: script.hook_strength,
      total_duration_seconds: script.total_duration_seconds,
    });

    // Update script field on media for easy access
    await this.mediaRepository.update(media.id, { script: script.voiceover_text });

    return blobId;
  }

  /** broll: Find b-roll clips for each broll_cutaway scene */
  private async handleUgcBrollStep(media: Media): Promise<string> {
    if (!this.brollLibraryService) throw new Error('BrollLibraryService not available');

    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.UGC_SCRIPT },
    });
    if (!scriptAsset) throw new Error('UGC script asset missing');

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    const brollScenes = scriptData.scenes.filter(
      (s: UgcScene) => s.type === 'broll_cutaway' || s.type === 'product_close',
    );

    const brollMatches: any[] = [];
    for (const scene of brollScenes) {
      const match = await this.brollLibraryService.findClip({
        query: scene.broll_query || 'lifestyle product',
        clipType: scene.type === 'product_close' ? 'product_close' : 'broll',
      });
      brollMatches.push({
        sceneNumber: scene.scene_number,
        s3Key: match?.s3Key || '',
        pexelsUrl: match?.pexelsUrl,
        durationSeconds: match?.durationSeconds ?? scene.duration_seconds,
        source: match?.source || 'none',
      });
    }

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'broll',
      step: 'broll',
      buffer: Buffer.from(JSON.stringify(brollMatches)),
      fileName: 'broll-matches.json',
    });

    await this.addAsset(media.id, MediaAssetType.BROLL, blobId, { count: brollMatches.length });
    return blobId;
  }

  /** actor: Submit and poll Hedra API to generate actor talking-head video */
  private async handleUgcActorStep(media: Media): Promise<string> {
    if (!this.hedraService) throw new Error('HedraService not available');

    const briefAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.UGC_BRIEF },
    });
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.AUDIO },
    });
    if (!briefAsset || !audioAsset) throw new Error('Brief or audio asset missing for actor step');

    const brief = briefAsset.metadata as any;

    // Get signed URLs for Hedra API (requires public-ish URLs)
    const actorPortraitKey = `ugc/actors/${brief.actorId}/portrait.jpg`;
    const avatarImageUrl = await this.storageService.getSignedUrl(actorPortraitKey, 600);
    const audioUrl = await this.storageService.getSignedUrl(audioAsset.blob_storage_id, 600);

    const jobId = await this.hedraService.submitJob({ avatarImageUrl, audioUrl });
    const videoUrl = await this.hedraService.pollUntilComplete(jobId);

    // Download Hedra video and re-upload to S3
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Failed to download Hedra video: ${videoResponse.status}`);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'actor_video',
      step: 'actor',
      buffer: videoBuffer,
      fileName: 'actor-video.mp4',
    });

    await this.addAsset(media.id, MediaAssetType.ACTOR_VIDEO, blobId, { hedra_job_id: jobId });
    return blobId;
  }

  // ─── Story Step Handlers ──────────────────────────────────────────────────

  /** storyScript: Gemini generates StoryScriptJSON; persists Story + characters + scenes to DB */
  private async handleStoryScriptStep(media: Media): Promise<string> {
    if (!this.storyScriptService) throw new Error('StoryScriptService not available');

    const config = media.input_config || {};
    const script = await this.storyScriptService.generateScript({
      mediaId: media.id,
      userId: media.user_id,
      genre: config.genre || 'horror',
      sceneCount: config.sceneCount || 5,
      userPrompt: config.prompt || config.topic || '',
    });

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'story_script',
      step: 'storyScript',
      buffer: Buffer.from(JSON.stringify(script)),
      fileName: 'story-script.json',
    });

    await this.addAsset(media.id, MediaAssetType.STORY_SCRIPT, blobId, {
      title: script.title,
      scene_count: script.scenes.length,
      total_duration_seconds: script.total_duration_seconds,
    });

    return blobId;
  }

  /** storyImages: Generate one image per scene using the per-scene image_prompt */
  private async handleStoryImagesStep(media: Media): Promise<string[]> {
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_SCRIPT },
    });
    if (!scriptAsset) throw new Error('Story script asset missing');

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    const imageProvider = this.aiFactory.getImageGenerator('gemini');
    const story = await this.storyScriptService.findStoryByMediaId(media.id);

    const blobIds: string[] = [];
    for (const scene of scriptData.scenes) {
      const [buffer] = await imageProvider.generateImages({
        prompt: scene.image_prompt,
        aspectRatio: '9:16' as any,
        count: 1,
      });

      const blobId = await this.storageService.upload({
        userId: media.user_id,
        mediaId: media.id,
        type: 'story_images',
        step: 'storyImages',
        buffer,
        fileName: `scene_${scene.scene_number}.jpg`,
      });

      await this.addAsset(media.id, MediaAssetType.STORY_IMAGES, blobId, {
        scene_number: scene.scene_number,
      });
      blobIds.push(blobId);

      // Update story_scenes.image_url
      if (story) {
        await this.storyScriptService.updateSceneImageUrl(story.id, scene.scene_number, blobId);
      }
    }

    return blobIds;
  }

  /** storyAudio: Concatenate all scene narrations into a single TTS audio */
  private async handleStoryAudioStep(media: Media): Promise<string> {
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_SCRIPT },
    });
    if (!scriptAsset) throw new Error('Story script asset missing');

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    const fullNarration = scriptData.scenes
      .map((s: any) => s.narration || '')
      .filter(Boolean)
      .join(' ');

    if (!fullNarration) throw new Error('No narration text found in story scenes');

    // Use same provider chain as handleAudioStep
    let providerKey: string;
    const voiceId = media.input_config?.voiceId;
    if (process.env.SARVAM_API_KEY) {
      providerKey = 'sarvam';
    } else if (process.env.ELEVENLABS_API_KEY) {
      providerKey = 'elevenlabs';
    } else {
      providerKey = 'openai';
    }

    const audioProvider = this.aiFactory.getTextToSpeech(providerKey);
    let audioBuffer: Buffer;

    try {
      audioBuffer = await audioProvider.textToSpeech({
        text: fullNarration,
        voiceId,
        language: media.input_config?.language,
      });
    } catch (error) {
      this.logger.warn(`Primary TTS failed for story ${media.id}, falling back: ${error.message}`);
      try {
        audioBuffer = await this.geminiTTS.textToSpeech({ text: fullNarration });
      } catch (geminiError) {
        audioBuffer = await this.openAITTS.textToSpeech({ text: fullNarration });
      }
    }

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'story_audio',
      step: 'storyAudio',
      buffer: audioBuffer,
      fileName: 'narration.mp3',
    });

    await this.addAsset(media.id, MediaAssetType.STORY_AUDIO, blobId);
    return blobId;
  }

  /** storyCaptions: Generate captions from the story audio */
  private async handleStoryCaptionsStep(media: Media): Promise<string> {
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_AUDIO },
    });
    if (!audioAsset) throw new Error('Story audio asset missing');

    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_SCRIPT },
    });
    if (!scriptAsset) throw new Error('Story script asset missing');

    const audioBuffer = await this.storageService.download(audioAsset.blob_storage_id);
    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    const fullNarration = scriptData.scenes
      .map((s: any) => s.narration || '')
      .filter(Boolean)
      .join(' ');

    const captionProvider = this.aiFactory.getCaptionGenerator('local');
    const captionBuffer = await captionProvider.generateCaptions(
      audioBuffer,
      fullNarration,
      undefined,
      'sentence',
      { enabled: true, preset: 'bold-stroke', position: 'bottom', timing: 'sentence' },
    );

    const blobId = await this.storageService.upload({
      userId: media.user_id,
      mediaId: media.id,
      type: 'story_captions',
      step: 'storyCaptions',
      buffer: captionBuffer,
      fileName: 'captions.json',
    });

    await this.addAsset(media.id, MediaAssetType.STORY_CAPTIONS, blobId);
    return blobId;
  }

  /** storyRender: Enqueue FFmpeg story composition to story-render-tasks */
  private async handleStoryRenderStep(media: Media, step: MediaStep): Promise<void> {
    if (!this.storyRenderQueueService) throw new Error('StoryRenderQueueService not available');

    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_SCRIPT },
    });
    const imageAssets = await this.assetRepository.find({
      where: { media_id: media.id, type: MediaAssetType.STORY_IMAGES },
    });
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_AUDIO },
    });
    const captionAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.STORY_CAPTIONS },
    });

    if (!scriptAsset || !audioAsset || !captionAsset || imageAssets.length === 0) {
      throw new Error('Required story assets missing for storyRender step');
    }

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );

    // Sort image assets by scene_number (stored in metadata)
    const sortedImageAssets = [...imageAssets].sort(
      (a, b) => ((a.metadata as any)?.scene_number ?? 0) - ((b.metadata as any)?.scene_number ?? 0),
    );

    // Handle background music
    let musicBlobId: string | undefined;
    const musicId = media.input_config?.musicId;
    if (musicId) {
      const musicEntity = await this.musicRepository.findOne({ where: { id: musicId } });
      if (musicEntity) musicBlobId = musicEntity.blob_storage_id;
    }

    const user = await this.userRepository.findOne({ where: { id: media.user_id } });

    await this.storyRenderQueueService.queueStoryRenderJob({
      mediaId: media.id,
      stepId: step.id,
      userId: media.user_id,
      scenes: scriptData.scenes.map((s: any) => ({
        subtitle: s.subtitle || '',
        duration_seconds: s.duration_seconds,
        camera_motion: s.camera_motion || 'zoom_in',
      })),
      assets: {
        images: sortedImageAssets.map((a) => a.blob_storage_id),
        audio: audioAsset.blob_storage_id,
        caption: captionAsset.blob_storage_id,
        music: musicBlobId,
      },
      watermark: getWatermarkConfig(user?.is_premium ?? false).watermark,
    });
  }

  /** ugcCompose: Enqueue FFmpeg composition job to ugc-render-tasks */
  private async handleUgcComposeStep(media: Media): Promise<string> {
    if (!this.ugcComposeService) throw new Error('UgcComposeService not available');

    const actorAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.ACTOR_VIDEO },
    });
    const audioAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.AUDIO },
    });
    const brollAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.BROLL },
    });
    const scriptAsset = await this.assetRepository.findOne({
      where: { media_id: media.id, type: MediaAssetType.UGC_SCRIPT },
    });

    if (!actorAsset || !audioAsset || !brollAsset || !scriptAsset) {
      throw new Error('Required assets missing for ugcCompose step');
    }

    const scriptData = JSON.parse(
      (await this.storageService.download(scriptAsset.blob_storage_id)).toString(),
    );
    const brollData = JSON.parse(
      (await this.storageService.download(brollAsset.blob_storage_id)).toString(),
    );

    const step = await this.stepRepository.findOne({
      where: { media_id: media.id, step: 'ugcCompose' },
    });
    const user = await this.userRepository.findOne({ where: { id: media.user_id } });

    const musicConfig = media.input_config?.music;
    let musicBlobId: string | undefined;
    if (musicConfig?.id) {
      const musicEntity = await this.musicRepository.findOne({ where: { id: musicConfig.id } });
      if (musicEntity) musicBlobId = musicEntity.blob_storage_id;
    }

    await this.ugcComposeService.enqueueComposition({
      mediaId: media.id,
      stepId: step.id,
      userId: media.user_id,
      assets: {
        actorVideo: actorAsset.blob_storage_id,
        voice: audioAsset.blob_storage_id,
        brollClips: brollData,
        music: musicBlobId,
      },
      scenes: scriptData.scenes,
      options: {
        musicVolume: typeof musicConfig?.volume === 'number' ? musicConfig.volume : 0.15,
      },
      monetization: getWatermarkConfig(user?.is_premium ?? false),
    });

    return null; // Worker updates this on completion
  }
}
