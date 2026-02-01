import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoStatus } from './entities/video.entity';
import { ScriptJSON, ScriptScene } from '../ai/interfaces/script-generator.interface';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { AiProviderFactory } from '../ai/ai-provider.factory';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { Readable } from 'stream';

@Injectable()
export class VideoGenerationService {
    private readonly logger = new Logger(VideoGenerationService.name);
    private static isJobActive = false; // Simple lock for single-job concurrency

    constructor(
        private readonly videoService: VideoService,
        private readonly aiFactory: AiProviderFactory,
        @Inject('IStorageService') private readonly storageService: IStorageService,
        @Inject('IVideoRenderer') private readonly videoRenderer: IVideoRenderer,
    ) { }

    /**
     * Starts the video generation process for a given video ID.
     * This method is async but "fire-and-forget" - it runs in the background.
     */
    async startGeneration(videoId: string): Promise<void> {
        if (VideoGenerationService.isJobActive) {
            this.logger.warn(`Another job is already active. Skipping or queuing for ${videoId}.`);
            // In a real prod env, we'd use a queue (BullMQ), but for 512MB RAM stability, we enforce 1 at a time.
            return;
        }

        VideoGenerationService.isJobActive = true;
        this.logger.log(`Starting generation for video ${videoId}`);

        const sessionDir = this.getSessionDir(videoId);
        if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

        try {
            // 1. Script Generation
            await this.generateScriptStep(videoId);

            // 2. Image Generation
            await this.generateImagesStep(videoId, sessionDir);

            // 3. Audio Generation
            const audioBuffer = await this.generateAudioStep(videoId, sessionDir);

            // 4. Caption Generation (Needs Audio)
            await this.generateCaptionsStep(videoId, audioBuffer, sessionDir);

            // 5. Final Rendering
            await this.renderFinalVideoStep(videoId, sessionDir);

            this.logger.log(`Video generation COMPLETED for ${videoId}`);
        } catch (error) {
            this.logger.error(`Video generation FAILED for ${videoId}:`, error);
            await this.videoService.failVideo(videoId, error instanceof Error ? error.message : 'Unknown error');
        } finally {
            VideoGenerationService.isJobActive = false;
            this.cleanupSession(sessionDir);
        }
    }

    private getSessionDir(videoId: string): string {
        return join(tmpdir(), `reels-session-${videoId}`);
    }

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

    private async generateScriptStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideoRaw(videoId);
        if (video.script && video.script_json) {
            this.logger.log(`Script already exists for ${videoId}, skipping.`);
            return;
        }

        this.logger.log(`Generating script for ${videoId}...`);
        await this.videoService.updateStatus(videoId, VideoStatus.SCRIPT_GENERATING);

        // Determine Provider based on available keys
        let provider = 'mock';
        if (process.env.GEMINI_API_KEY) provider = 'gemini';
        else if (process.env.OPENAI_API_KEY) provider = 'openai';

        const scriptProvider = this.aiFactory.getScriptGenerator(provider);

        // Generate JSON first (structured data is reliable)
        const durationMap: Record<string, number> = {
            '30-60': 45,
            '60-90': 75,
            '90-120': 105,
        };
        const targetDuration = durationMap[video.metadata?.duration] || 45;
        const language = video.metadata?.language || 'English (US)';

        const scriptJSON = await scriptProvider.generateScriptJSON({
            topic: video.topic,
            language,
            targetDurationSeconds: targetDuration,
        });

        // Construct clean script text from JSON scenes (stateless/pure)
        // This avoids the raw output from 'generateScript' which often contains instructions/markdown.
        const scriptText = scriptJSON.scenes.map(s => s.audio_text).join(' ');

        await this.videoService.updateScriptJSON(videoId, scriptJSON);
        await this.videoService.updateScript(videoId, scriptText);
    }

    private async generateImagesStep(videoId: string, sessionDir: string): Promise<void> {
        const video = await this.videoService.getVideoRaw(videoId);
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

        // Get Provider from Factory
        const imageProviderName = video.metadata?.imageProvider || 'gemini';
        const imageProvider = this.aiFactory.getImageGenerator(imageProviderName as any);

        // CREATE ONE MASTER PROMPT FOR ALL IMAGES
        // We combine the topic and all scene descriptions to give the AI context for consistency
        const masterPrompt = `Cinematic video about ${video.topic}. ` +
            scriptJson.scenes.map(s => s.image_prompt).join('. ');

        this.logger.log(`Using single-prompt batch generation for ${imageProviderName}`);

        // Generate images in batches (Gemini/Replicate usually max 4 per call)
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
                count: currentBatchCount
            });

            // Upload this batch AND Cache Locally
            const uploadPromises = buffers.map(async (buffer, idx) => {
                const globalIdx = i + idx;
                const fileName = `image-${globalIdx}.jpg`;

                // Cache locally for renderer
                writeFileSync(join(sessionDir, fileName), buffer);

                return this.storageService.upload({
                    userId: video.user_id || 'system',
                    mediaId: videoId,
                    type: 'image',
                    buffer,
                    fileName
                });
            });
            const urls = await Promise.all(uploadPromises);
            imageUrls.push(...urls);
        }

        // If we got fewer images than scenes (shouldn't happen with the loop above, but safety first), 
        // we might need to pad or log warning.
        if (imageUrls.length < sceneCount) {
            this.logger.warn(`Only generated ${imageUrls.length} images for ${sceneCount} scenes.`);
        }

        await this.videoService.updateImageUrls(videoId, imageUrls);
    }

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

        // Get Provider from Factory
        const videoProviderName = process.env.GEMINI_API_KEY ? 'gemini' : (process.env.REPLICATE_API_TOKEN ? 'replicate' : 'free');
        const videoProvider = this.aiFactory.getImageToVideo(videoProviderName);

        // Construct a single master prompt from the script
        // We combine the topic and key visual details to get a cohesive video
        const masterPrompt = `Cinematic video about ${video.topic}. ` +
            scriptJson.scenes.map(s => s.image_prompt).join('. ');

        // Truncate to avoid context limits if necessary (Veo 3 has reasonable limits)
        const safePrompt = masterPrompt.substring(0, 1000); // Safe limit

        this.logger.log(`Video Prompt: "${safePrompt.substring(0, 100)}..."`);

        // Duration: Sum of all scenes
        // Note: Veo preview might be limited to 5-10s regardless.
        const totalDuration = scriptJson.scenes.reduce((acc, s) => acc + (s.duration || 5), 0);

        // Pass empty buffer for Text-to-Video
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

    private async generateAudioStep(videoId: string, sessionDir: string): Promise<Buffer> {
        const video = await this.videoService.getVideoRaw(videoId);
        const audioFile = join(sessionDir, 'audio.mp3');

        if (video.audio_url) {
            this.logger.log(`Audio already exists for ${videoId}, downloading to cache.`);
            const buffer = await this.storageService.download(video.audio_url);
            writeFileSync(audioFile, buffer);
            return buffer;
        }

        if (!video.script) throw new Error('No script for audio generation');

        this.logger.log(`Generating audio for ${videoId}...`);

        // Get Provider from Factory (default: elevenlabs)
        const audioProviderName = process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : (process.env.OPENAI_API_KEY ? 'openai' : 'mock');
        const audioProvider = this.aiFactory.getTextToSpeech(audioProviderName);

        const audioBuffer = await audioProvider.textToSpeech({
            text: video.script,
            voiceId: video.metadata?.voiceId,
            language: video.metadata?.language,
        });

        // Cache Locally
        writeFileSync(audioFile, audioBuffer);

        const audioUrl = await this.storageService.upload({
            userId: video.user_id || 'system',
            mediaId: videoId,
            type: 'audio',
            buffer: audioBuffer,
            fileName: 'audio.mp3'
        });

        await this.videoService.updateAudioUrl(videoId, audioUrl);
        return audioBuffer;
    }

    private async generateCaptionsStep(videoId: string, audioBuffer: Buffer, sessionDir: string): Promise<void> {
        const video = await this.videoService.getVideoRaw(videoId);
        const captionFile = join(sessionDir, 'captions.srt');

        if (video.caption_url) {
            this.logger.log(`Captions already exist for ${videoId}, downloading to cache.`);
            const buffer = await this.storageService.download(video.caption_url);
            writeFileSync(captionFile, buffer);
            return;
        }

        if (!video.script) throw new Error('No script for caption generation');

        this.logger.log(`Generating captions for ${videoId}...`);

        // Get Provider from Factory (default: replicate)
        const captionProvider = this.aiFactory.getCaptionGenerator('replicate');

        // Pass actual audio buffer to provider
        const captionBuffer = await captionProvider.generateCaptions(audioBuffer, video.script);

        // Cache Locally
        writeFileSync(captionFile, captionBuffer);

        const captionUrl = await this.storageService.upload({
            userId: video.user_id || 'system',
            mediaId: videoId,
            type: 'caption',
            buffer: captionBuffer,
            fileName: 'captions.srt'
        });

        await this.videoService.updateCaptionUrl(videoId, captionUrl);
    }

    private async renderFinalVideoStep(videoId: string, sessionDir: string): Promise<void> {
        const video = await this.videoService.getVideoRaw(videoId);
        if (video.final_video_url) {
            this.logger.log(`Final video already exists for ${videoId}, skipping.`);
            return;
        }

        this.logger.log(`Rendering final video (720p Optimized) for ${videoId}...`);
        await this.videoService.updateStatus(videoId, VideoStatus.RENDERING);

        // Prepare File Paths
        const audioPath = join(sessionDir, 'audio.mp3');
        const captionPath = join(sessionDir, 'captions.srt');
        const scriptJson = video.script_json as unknown as ScriptJSON;
        const imageCount = scriptJson.scenes.length;
        const assetPaths = Array.from({ length: imageCount }, (_, i) => join(sessionDir, `image-${i}.jpg`));

        // Verify assets exist in session, if not download them (consistency fallback)
        if (!existsSync(audioPath)) await this.storageService.downloadToFile(video.audio_url, audioPath);
        if (!existsSync(captionPath)) await this.storageService.downloadToFile(video.caption_url, captionPath);
        for (let i = 0; i < imageCount; i++) {
            if (!existsSync(assetPaths[i])) {
                await this.storageService.downloadToFile(video.image_urls[i], assetPaths[i]);
            }
        }

        this.logger.log(`Rendering with Local Paths: Audio=${audioPath}, Assets=${assetPaths.length}`);

        const videoStream = await this.videoRenderer.compose({
            audioPath,
            captionPath,
            assetPaths,
        });

        // Upload using Stream to save memory
        const finalUrl = await this.storageService.upload({
            userId: video.user_id || 'system',
            mediaId: videoId,
            type: 'video',
            stream: videoStream as unknown as Readable,
            fileName: 'final_reel.mp4'
        });

        await this.videoService.completeVideo(videoId, finalUrl);
    }
}
