import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoStatus } from './entities/video.entity';
import { ScriptJSON } from '../ai/interfaces/script-generator.interface';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { AiProviderFactory } from '../ai/ai-provider.factory';

@Injectable()
export class VideoGenerationService {
    private readonly logger = new Logger(VideoGenerationService.name);

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
        this.logger.log(`Starting generation for video ${videoId}`);

        try {
            // 1. Script Generation
            await this.generateScriptStep(videoId);

            // 2. Image Generation
            await this.generateImagesStep(videoId);

            // 3. Image-to-Video
            await this.generateVideoSegmentsStep(videoId);

            // 4. Parallel: Audio & Captions
            await Promise.all([
                this.generateAudioStep(videoId),
                this.generateCaptionsStep(videoId),
            ]);

            // 5. Final Rendering
            await this.renderFinalVideoStep(videoId);

            this.logger.log(`Video generation COMPLETED for ${videoId}`);
        } catch (error) {
            this.logger.error(`Video generation FAILED for ${videoId}:`, error);
            await this.videoService.failVideo(videoId, error instanceof Error ? error.message : 'Unknown error');
        }
    }

    private async generateScriptStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.script && video.script_json) {
            this.logger.log(`Script already exists for ${videoId}, skipping.`);
            return;
        }

        this.logger.log(`Generating script for ${videoId}...`);
        await this.videoService.updateStatus(videoId, VideoStatus.SCRIPT_GENERATING);

        // Determine Provider based on available keys
        let provider = 'mock';
        if (process.env.OPENAI_API_KEY) provider = 'openai';
        else if (process.env.GEMINI_API_KEY) provider = 'gemini';

        const scriptProvider = this.aiFactory.getScriptGenerator(provider);

        // Generate JSON and Text
        const scriptJSON = await scriptProvider.generateScriptJSON(video.topic);
        const scriptText = await scriptProvider.generateScript(video.topic);

        await this.videoService.updateScriptJSON(videoId, scriptJSON);
        await this.videoService.updateScript(videoId, scriptText);
    }

    private async generateImagesStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.image_urls && video.image_urls.length > 0) {
            this.logger.log(`Images already exist for ${videoId}, skipping.`);
            return;
        }

        const scriptJson = video.script_json as unknown as ScriptJSON;
        if (!scriptJson || !scriptJson.scenes) {
            throw new Error('Script JSON missing scenes');
        }

        this.logger.log(`Generating ${scriptJson.scenes.length} images for ${videoId}...`);
        await this.videoService.updateStatus(videoId, VideoStatus.PROCESSING);

        // Get Provider from Factory (default: dalle)
        const imageProvider = this.aiFactory.getImageGenerator(process.env.OPENAI_API_KEY ? 'dalle' : 'mock');

        const imageUrls: string[] = [];

        // Generate sequentially
        for (const scene of scriptJson.scenes) {
            this.logger.debug(`Generating image for scene ${scene.scene_number}...`);
            const imageBuffer = await imageProvider.generateImage(scene.image_prompt);
            const url = await this.storageService.uploadAsset(videoId, imageBuffer, 'image/png');
            imageUrls.push(url);
        }

        await this.videoService.updateImageUrls(videoId, imageUrls);
    }

    private async generateVideoSegmentsStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.generated_video_url) {
            this.logger.log(`Generated video already exists for ${videoId}, skipping.`);
            return;
        }

        if (!video.image_urls || video.image_urls.length === 0) {
            throw new Error('No images available for video generation');
        }

        this.logger.log(`Converting images to video for ${videoId}...`);

        // Get Provider from Factory
        const videoProviderName = process.env.REPLICATE_API_TOKEN ? 'replicate' : 'free';
        const videoProvider = this.aiFactory.getImageToVideo(videoProviderName);

        // Generate for first image only (simple approach)
        const firstImageUrl = video.image_urls[0];
        const imageBuffer = await this.storageService.download(firstImageUrl);

        const scriptJson = video.script_json as unknown as ScriptJSON;
        const duration = scriptJson?.scenes[0]?.duration || 5;

        const videoBuffer = await videoProvider.generateVideo(imageBuffer, duration);
        const videoUrl = await this.storageService.uploadAsset(videoId, videoBuffer, 'video/mp4');

        await this.videoService.updateGeneratedVideoUrl(videoId, videoUrl);
    }

    private async generateAudioStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.audio_url) {
            this.logger.log(`Audio already exists for ${videoId}, skipping.`);
            return;
        }

        if (!video.script) throw new Error('No script for audio generation');

        this.logger.log(`Generating audio for ${videoId}...`);

        // Get Provider from Factory (default: openai)
        const audioProvider = this.aiFactory.getTextToSpeech(process.env.OPENAI_API_KEY ? 'openai' : 'mock');

        const audioBuffer = await audioProvider.textToSpeech(video.script);
        const audioUrl = await this.storageService.uploadAudio(videoId, audioBuffer);

        await this.videoService.updateAudioUrl(videoId, audioUrl);
    }

    private async generateCaptionsStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.caption_url) {
            this.logger.log(`Captions already exist for ${videoId}, skipping.`);
            return;
        }

        if (!video.script) throw new Error('No script for caption generation');

        this.logger.log(`Generating captions for ${videoId}...`);

        // Get Provider from Factory (default: replicate)
        const captionProvider = this.aiFactory.getCaptionGenerator('replicate');

        const captionBuffer = await captionProvider.generateCaptions(video.script);
        const captionUrl = await this.storageService.uploadCaption(videoId, captionBuffer);

        await this.videoService.updateCaptionUrl(videoId, captionUrl);
    }

    private async renderFinalVideoStep(videoId: string): Promise<void> {
        const video = await this.videoService.getVideo(videoId);
        if (video.final_video_url) {
            this.logger.log(`Final video already exists for ${videoId}, skipping.`);
            return;
        }

        this.logger.log(`Rendering final video for ${videoId}...`);
        await this.videoService.updateStatus(videoId, VideoStatus.RENDERING);

        if (!video.audio_url || !video.caption_url || !video.generated_video_url) {
            throw new Error('Missing assets for final render');
        }

        const [audioBuffer, captionBuffer, videoBuffer] = await Promise.all([
            this.storageService.download(video.audio_url),
            this.storageService.download(video.caption_url),
            this.storageService.download(video.generated_video_url),
        ]);

        const finalBuffer = await this.videoRenderer.compose({
            audio: audioBuffer,
            caption: captionBuffer,
            video: videoBuffer,
        });

        const finalUrl = await this.storageService.uploadVideo(videoId, finalBuffer);

        await this.videoService.completeVideo(videoId, finalUrl);
    }
}
