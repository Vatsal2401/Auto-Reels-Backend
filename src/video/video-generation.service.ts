import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoStatus } from './entities/video.entity';
import { ScriptJSON } from '../ai/interfaces/script-generator.interface';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { HyperFramesRendererProvider } from '../render/providers/hyperframes-renderer.provider';
import { AiProviderFactory } from '../ai/ai-provider.factory';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { MusicService } from '../media/music.service';

// VideoGenerationService — reel generation pipeline ચલાવે છે
// Steps: Script → Images → Audio → Captions → Final Video Render
@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  // Simple lock: RAM બચાવવા એક સમયે ફક્ત 1 job run થાય
  private static isJobActive = false;

  constructor(
    private readonly videoService: VideoService,
    private readonly aiFactory: AiProviderFactory,
    @Inject('IStorageService') private readonly storageService: IStorageService,
    @Inject('IVideoRenderer') private readonly videoRenderer: IVideoRenderer, // FFmpeg renderer
    private readonly hyperFramesRenderer: HyperFramesRendererProvider, // HyperFrames renderer
    private readonly musicService: MusicService,
  ) {}

  // Main entry point: video generation start કરે છે (background task)
  async startGeneration(videoId: string): Promise<void> {
    // બીજી job ચાલતી હોય તો skip — 512MB RAM limit ના કારણે
    if (VideoGenerationService.isJobActive) {
      this.logger.warn(`Another job is already active. Skipping or queuing for ${videoId}.`);
      return;
    }

    VideoGenerationService.isJobActive = true;
    this.logger.log(`Starting generation for video ${videoId}`);

    // temporary folder બનાવો — audio, images, captions cache થશે
    const sessionDir = this.getSessionDir(videoId);
    if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

    try {
      // Step 1: Gemini/OpenAI વડે script JSON generate કરો
      await this.generateScriptStep(videoId);

      // Step 2: Replicate/Gemini વડે scene images generate કરો
      await this.generateImagesStep(videoId, sessionDir);

      // Step 3: Sarvam/ElevenLabs/OpenAI વડે audio generate કરો
      const audioBuffer = await this.generateAudioStep(videoId, sessionDir);

      // Step 4: audio ના based captions (subtitles) generate કરો
      await this.generateCaptionsStep(videoId, audioBuffer, sessionDir);

      // Step 5: FFmpeg અથવા HyperFrames વડે final video render કરો
      await this.renderFinalVideoStep(videoId, sessionDir);

      this.logger.log(`Video generation COMPLETED for ${videoId}`);
    } catch (error) {
      this.logger.error(`Video generation FAILED for ${videoId}:`, error);
      await this.videoService.failVideo(
        videoId,
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      VideoGenerationService.isJobActive = false;
      this.cleanupSession(sessionDir); // temporary files delete કરો
    }
  }

  // session directory path return કરે (tmp folder)
  private getSessionDir(videoId: string): string {
    return join(tmpdir(), `reels-session-${videoId}`);
  }

  // generation પૂરી થાય ત્યારે temporary folder delete કરે
  private cleanupSession(dir: string): void {
    try {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        this.logger.log(`Cleaned up session directory: ${dir}`);
      }
    } catch (e) {
      this.logger.error(`Failed to cleanup session ${dir}:`, e);
    }
  }

  // Step 1: Topic લઈને JSON script generate કરે (scenes, image prompts, audio text)
  private async generateScriptStep(videoId: string): Promise<void> {
    const video = await this.videoService.getVideoRaw(videoId);

    // script already exist કરે તો skip
    if (video.script && video.script_json) {
      this.logger.log(`Script already exists for ${videoId}, skipping.`);
      return;
    }

    this.logger.log(`Generating script for ${videoId}...`);
    await this.videoService.updateStatus(videoId, VideoStatus.SCRIPT_GENERATING);

    // available API key ના based provider choose: gemini > openai > mock
    let provider = 'mock';
    if (process.env.GEMINI_API_KEY) provider = 'gemini';
    else if (process.env.OPENAI_API_KEY) provider = 'openai';

    const scriptProvider = this.aiFactory.getScriptGenerator(provider);

    // duration string ને seconds માં convert: "30-60" → 45 seconds
    const durationMap: Record<string, number> = {
      '30-60': 45,
      '60-90': 75,
      '90-120': 105,
    };
    const targetDuration = durationMap[video.metadata?.duration] || 45;
    const language = video.metadata?.language || 'English (US)';
    const visualStyle = video.metadata?.imageStyle || 'Cinematic';
    const audioPrompt = video.metadata?.audioStyle || '';

    // Gemini/OpenAI ને structured JSON script generate કરવા call કરો
    const scriptJSON = await scriptProvider.generateScriptJSON({
      topic: video.topic,
      language,
      targetDurationSeconds: targetDuration,
      visualStyle,
      audioPrompt,
    });

    // JSON scenes ના audio_text join કરીને plain script text બનાવો
    // (raw AI output avoid — markdown/instructions ન આવે)
    const scriptText = scriptJSON.scenes.map((s) => s.audio_text).join(' ');

    await this.videoService.updateScriptJSON(videoId, scriptJSON);
    await this.videoService.updateScript(videoId, scriptText);
  }

  // Step 2: Script ના image_prompts વડે scene images generate કરે
  private async generateImagesStep(videoId: string, sessionDir: string): Promise<void> {
    const video = await this.videoService.getVideoRaw(videoId);

    // images already exist કરે તો skip
    if (video.image_urls && video.image_urls.length > 0) {
      this.logger.log(`Images already exist for ${videoId}, skipping.`);
      return;
    }

    const scriptJson = video.script_json as unknown as ScriptJSON;
    if (!scriptJson || !scriptJson.scenes) {
      throw new Error('Script JSON missing scenes');
    }

    const sceneCount = scriptJson.scenes.length;
    this.logger.log(`Generating images for ${sceneCount} scenes...`);
    await this.videoService.updateStatus(videoId, VideoStatus.PROCESSING);

    // imageProvider metadata ના based choose: default = replicate (Gemini Imagen paid-only)
    const imageProviderName = video.metadata?.imageProvider || 'replicate';
    const imageProvider = this.aiFactory.getImageGenerator(imageProviderName as any);

    // topic + scene descriptions combine કરીને master prompt બનાવો
    const masterPrompt =
      `Cinematic video about ${video.topic}. ` +
      scriptJson.scenes.map((s) => s.image_prompt).join('. ');

    this.logger.log(`Using single-prompt batch generation for ${imageProviderName}`);

    // 4 images ની batch માં generate કરો (API limit)
    const batchSize = 4;
    const totalImagesNeeded = sceneCount;
    const imageUrls: string[] = [];

    for (let i = 0; i < totalImagesNeeded; i += batchSize) {
      const currentBatchCount = Math.min(batchSize, totalImagesNeeded - i);
      this.logger.log(`Requesting batch of ${currentBatchCount} images (Offset: ${i})...`);

      const buffers = await imageProvider.generateImages({
        prompt: masterPrompt,
        style: video.metadata?.imageStyle,
        aspectRatio: video.metadata?.imageAspectRatio as any,
        count: currentBatchCount,
      });

      // images upload કરો (S3/storage) અને locally cache કરો
      const uploadPromises = buffers.map(async (buffer, idx) => {
        const globalIdx = i + idx;
        const fileName = `image-${globalIdx}.jpg`;
        writeFileSync(join(sessionDir, fileName), buffer); // local cache
        return this.storageService.upload({
          userId: video.user_id || 'system',
          mediaId: videoId,
          type: 'image',
          buffer,
          fileName,
        });
      });
      const urls = await Promise.all(uploadPromises);
      imageUrls.push(...urls);
    }

    if (imageUrls.length < sceneCount) {
      this.logger.warn(`Only generated ${imageUrls.length} images for ${sceneCount} scenes.`);
    }

    await this.videoService.updateImageUrls(videoId, imageUrls);
  }

  // (legacy) image-to-video step — Veo/Gemini text-to-video (paid feature)
  private async generateVideoSegmentsStep(videoId: string): Promise<void> {
    const video = await this.videoService.getVideoRaw(videoId);
    if (video.generated_video_url) {
      this.logger.log(`Generated video already exists for ${videoId}, skipping.`);
      return;
    }

    const scriptJson = video.script_json as unknown as ScriptJSON;
    if (!scriptJson || !scriptJson.scenes) {
      throw new Error('Script JSON missing scenes');
    }

    this.logger.log(`Generating SINGLE video from full script (Text-to-Video)...`);

    const videoProviderName = process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.REPLICATE_API_TOKEN
        ? 'replicate'
        : 'free';
    const videoProvider = this.aiFactory.getImageToVideo(videoProviderName);

    const masterPrompt =
      `Cinematic video about ${video.topic}. ` +
      scriptJson.scenes.map((s) => s.image_prompt).join('. ');

    const safePrompt = masterPrompt.substring(0, 1000);
    this.logger.log(`Video Prompt: "${safePrompt.substring(0, 100)}..."`);

    const totalDuration = scriptJson.scenes.reduce((acc, s) => acc + (s.duration || 5), 0);
    const emptyBuffer = Buffer.from([]);
    const videoBuffer = await videoProvider.generateVideo(emptyBuffer, safePrompt, totalDuration);

    const videoUrl = await this.storageService.upload({
      userId: video.user_id || 'system',
      mediaId: videoId,
      type: 'video',
      buffer: videoBuffer,
    });

    await this.videoService.updateGeneratedVideoUrl(videoId, videoUrl);
  }

  // Step 3: Script text ને audio (mp3) માં convert કરે
  private async generateAudioStep(videoId: string, sessionDir: string): Promise<Buffer> {
    const video = await this.videoService.getVideoRaw(videoId);
    const audioFile = join(sessionDir, 'audio.mp3');

    // audio already exist કરે તો cache download કરો
    if (video.audio_url) {
      this.logger.log(`Audio already exists for ${videoId}, downloading to cache.`);
      const buffer = await this.storageService.download(video.audio_url);
      writeFileSync(audioFile, buffer);
      return buffer;
    }

    if (!video.script || !video.script.trim()) {
      this.logger.error(
        `Video ${videoId}: Script text is empty or missing. Cannot generate audio.`,
      );
      throw new Error('Audio Fail: Script text is empty.');
    }

    const scriptText = video.script.trim();
    this.logger.log(`Generating audio for ${videoId}...`);

    // TTS provider priority: sarvam > elevenlabs > openai > mock
    const audioProviderName = process.env.SARVAM_API_KEY
      ? 'sarvam'
      : process.env.ELEVENLABS_API_KEY
        ? 'elevenlabs'
        : process.env.OPENAI_API_KEY
          ? 'openai'
          : 'mock';
    const audioProvider = this.aiFactory.getTextToSpeech(audioProviderName);

    const audioBuffer = await audioProvider.textToSpeech({
      text: scriptText,
      voiceId: video.metadata?.voiceId,
      language: video.metadata?.language,
    });

    // locally cache અને S3 upload
    writeFileSync(audioFile, audioBuffer);
    const audioUrl = await this.storageService.upload({
      userId: video.user_id || 'system',
      mediaId: videoId,
      type: 'audio',
      buffer: audioBuffer,
      fileName: 'audio.mp3',
    });

    await this.videoService.updateAudioUrl(videoId, audioUrl);
    return audioBuffer;
  }

  // Step 4: Audio ના based captions (.ass format) generate કરે
  private async generateCaptionsStep(
    videoId: string,
    audioBuffer: Buffer,
    sessionDir: string,
  ): Promise<void> {
    const video = await this.videoService.getVideoRaw(videoId);
    const captionFile = join(sessionDir, 'captions.srt');

    // captions already exist કરે તો download
    if (video.caption_url) {
      this.logger.log(`Captions already exist for ${videoId}, downloading to cache.`);
      const buffer = await this.storageService.download(video.caption_url);
      writeFileSync(captionFile, buffer);
      return;
    }

    if (!video.script) throw new Error('No script for caption generation');

    this.logger.log(`Generating captions for ${videoId}...`);

    // Replicate Whisper વડે audio transcribe કરીને captions generate
    const captionProvider = this.aiFactory.getCaptionGenerator('replicate');
    const captionBuffer = await captionProvider.generateCaptions(
      audioBuffer,
      video.script,
      undefined,
      video.metadata?.captions?.timing === 'word' ? 'word' : 'sentence',
      {
        preset: video.metadata?.captions?.preset || 'bold-stroke',
        position: video.metadata?.captions?.position || 'bottom',
      },
    );

    // .ass format (SubStation Alpha) — rich styling support
    const captionFileAss = join(sessionDir, 'captions.ass');
    writeFileSync(captionFileAss, captionBuffer);

    const captionUrl = await this.storageService.upload({
      userId: video.user_id || 'system',
      mediaId: videoId,
      type: 'caption',
      buffer: captionBuffer,
      fileName: 'captions.ass',
    });

    await this.videoService.updateCaptionUrl(videoId, captionUrl);
  }

  // Step 5: Audio + Images + Captions + Music combine કરીને final MP4 render
  private async renderFinalVideoStep(videoId: string, sessionDir: string): Promise<void> {
    const video = await this.videoService.getVideoRaw(videoId);

    if (video.final_video_url) {
      this.logger.log(`Final video already exists for ${videoId}, skipping.`);
      return;
    }

    this.logger.log(`Rendering final video (720p Optimized) for ${videoId}...`);
    await this.videoService.updateStatus(videoId, VideoStatus.RENDERING);

    // session directory ના file paths prepare
    const audioPath = join(sessionDir, 'audio.mp3');
    const captionPath = join(sessionDir, 'captions.ass');
    const scriptJson = video.script_json as unknown as ScriptJSON;
    const imageCount = scriptJson.scenes.length;
    const assetPaths = Array.from({ length: imageCount }, (_, i) =>
      join(sessionDir, `image-${i}.jpg`),
    );

    // locally cached ન હોય તો S3 storage થી download કરો
    if (!existsSync(audioPath))
      await this.storageService.downloadToFile(video.audio_url, audioPath);
    if (!existsSync(captionPath))
      await this.storageService.downloadToFile(video.caption_url, captionPath);
    for (let i = 0; i < imageCount; i++) {
      if (!existsSync(assetPaths[i])) {
        await this.storageService.downloadToFile(video.image_urls[i], assetPaths[i]);
      }
    }

    // background music prepare (optional)
    let musicPath: string | undefined;
    const musicConfig = video.metadata?.music;
    if (musicConfig?.id) {
      this.logger.log(`Preparing background music: ${musicConfig.id}`);
      const musicEntity = await this.musicService.findById(musicConfig.id);
      if (musicEntity) {
        musicPath = join(sessionDir, 'music.mp3');
        if (!existsSync(musicPath)) {
          const musicBuffer = await this.storageService.download(musicEntity.blob_storage_id);
          writeFileSync(musicPath, musicBuffer);
        }
      } else {
        this.logger.warn(`Background music entity not found for ID: ${musicConfig.id}`);
      }
    }

    // renderer choose: HyperFrames (HTML-based) અથવા FFmpeg (default)
    const useHyperFrames = video.metadata?.renderer === 'hyperframes';
    const renderer = useHyperFrames ? this.hyperFramesRenderer : this.videoRenderer;

    this.logger.log(
      `Rendering with ${useHyperFrames ? 'HyperFrames' : 'FFmpeg'} — Audio=${audioPath}, Assets=${assetPaths.length}, Music=${musicPath || 'None'}`,
    );

    // renderer ને compose call કરો — readable stream return
    const videoStream = await renderer.compose({
      audioPath,
      captionPath,
      assetPaths,
      captions: video.metadata?.captions,
      musicPath,
      musicVolume: musicConfig?.volume,
      scenes: scriptJson?.scenes?.map((s) => ({ audio_text: s.audio_text, duration: s.duration })),
      hyperframesTemplate: video.metadata?.hyperframesTemplate || 'cinematic',
    });

    // stream directly upload — memory efficient (buffer ન બનાવો)
    const finalUrl = await this.storageService.upload({
      userId: video.user_id || 'system',
      mediaId: videoId,
      type: 'video',
      stream: videoStream as unknown as Readable,
      fileName: 'final_reel.mp4',
    });

    await this.videoService.completeVideo(videoId, finalUrl);
  }
}
