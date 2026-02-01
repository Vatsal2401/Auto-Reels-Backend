import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { MediaStep, StepStatus } from './entities/media-step.entity';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaStatus, MediaAssetType } from './media.constants';
import { IStorageService, StorageUploadParams } from '../storage/interfaces/storage.interface';
import { IVideoRenderer } from '../render/interfaces/video-renderer.interface';
import { AiProviderFactory } from '../ai/ai-provider.factory';
import { ScriptJSON } from '../ai/interfaces/script-generator.interface';

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
        @Inject('IStorageService') private storageService: IStorageService,
        @Inject('IVideoRenderer') private videoRenderer: IVideoRenderer,
    ) { }

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

            // Finalize media status if all steps succeeded
            const allSteps = await this.stepRepository.find({ where: { media_id: mediaId } });
            const failedStep = allSteps.find(s => s.status === StepStatus.FAILED);

            if (failedStep) {
                await this.mediaRepository.update(mediaId, {
                    status: MediaStatus.FAILED,
                    error_message: failedStep.error_message
                });
            } else if (allSteps.every(s => s.status === StepStatus.SUCCESS)) {
                // Find the final video asset if any
                const videoAsset = await this.assetRepository.findOne({
                    where: { media_id: mediaId, type: MediaAssetType.VIDEO },
                    order: { created_at: 'DESC' }
                });

                await this.mediaRepository.update(mediaId, {
                    status: MediaStatus.COMPLETED,
                    blob_storage_id: videoAsset?.blob_storage_id || media.blob_storage_id,
                    completed_at: new Date()
                });
            }
        } catch (error) {
            this.logger.error(`Flow execution failed for ${mediaId}:`, error);
            await this.mediaRepository.update(mediaId, {
                status: MediaStatus.FAILED,
                error_message: error.message || 'Unknown orchestration error'
            });
        }
    }

    private async runFlow(mediaId: string): Promise<void> {
        const steps = await this.stepRepository.find({ where: { media_id: mediaId } });

        // Find steps that are PENDING and dependencies are met
        const executableSteps = steps.filter(step => {
            if (step.status !== StepStatus.PENDING) return false;
            const dependencies = step.depends_on || [];
            return dependencies.every(depName => {
                const depStep = steps.find(s => s.step === depName);
                return depStep && depStep.status === StepStatus.SUCCESS;
            });
        });

        if (executableSteps.length === 0) {
            const anyProcessing = steps.some(s => s.status === StepStatus.PROCESSING);
            const anyFailed = steps.some(s => s.status === StepStatus.FAILED);
            const allSuccess = steps.every(s => s.status === StepStatus.SUCCESS);

            if (!anyProcessing && !anyFailed && !allSuccess) {
                this.logger.error(`Deadlock or missing steps in flow for ${mediaId}`);
            }
            return;
        }

        // Run executable steps in parallel
        await Promise.all(executableSteps.map(step => this.executeStep(mediaId, step)));

        // Recursively run next available steps
        await this.runFlow(mediaId);
    }

    private async executeStep(mediaId: string, step: MediaStep): Promise<void> {
        this.logger.log(`Executing step: ${step.step} for media: ${mediaId}`);

        await this.stepRepository.update(step.id, {
            status: StepStatus.PROCESSING,
            started_at: new Date()
        });

        try {
            const media = await this.mediaRepository.findOne({ where: { id: mediaId } });
            let resultBlobIds: string | string[] = null;

            switch (step.step) {
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
                status: StepStatus.SUCCESS,
                blob_storage_id: resultBlobIds,
                completed_at: new Date()
            });
        } catch (error) {
            this.logger.error(`Step ${step.step} failed for media ${mediaId}:`, error);
            await this.stepRepository.update(step.id, {
                status: StepStatus.FAILED,
                error_message: error.message || 'Unknown error'
            });
            throw error; // Propagate to stop flow
        }
    }

    // --- Step Handlers ---

    private async handleScriptStep(media: Media): Promise<string> {
        const provider = process.env.GEMINI_API_KEY ? 'gemini' : 'mock';
        const scriptProvider = this.aiFactory.getScriptGenerator(provider);

        const config = media.input_config || {};
        const durationMap: Record<string, number> = { '30-60': 45, '60-90': 75, '90-120': 105 };

        const scriptJSON = await scriptProvider.generateScriptJSON({
            topic: config.topic || 'Inspiration',
            language: config.language || 'English (US)',
            targetDurationSeconds: durationMap[config.duration] || 45,
        });

        const scriptText = scriptJSON.scenes.map(s => s.audio_text).join(' ');

        const blobId = await this.storageService.upload({
            userId: media.user_id,
            mediaId: media.id,
            type: 'script',
            step: 'script',
            buffer: Buffer.from(JSON.stringify({ text: scriptText, json: scriptJSON })),
            fileName: 'script.json'
        });

        // Update media with the script text for easy access
        await this.mediaRepository.update(media.id, { script: scriptText });

        await this.addAsset(media.id, MediaAssetType.SCRIPT, blobId, {
            duration: scriptJSON.total_duration,
            text: scriptText
        });
        return blobId;
    }

    private async handleAudioStep(media: Media): Promise<string> {
        const scriptAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.SCRIPT } });
        if (!scriptAsset) throw new Error('Script asset missing');

        const scriptData = JSON.parse((await this.storageService.download(scriptAsset.blob_storage_id)).toString());
        const audioProvider = this.aiFactory.getTextToSpeech(process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai');

        const audioBuffer = await audioProvider.textToSpeech({
            text: scriptData.text,
            voiceId: media.input_config?.voiceId,
            language: media.input_config?.language,
        });

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
        const audioAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.AUDIO } });
        const scriptAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.SCRIPT } });
        if (!audioAsset || !scriptAsset) throw new Error('Audio or script asset missing');

        const audioBuffer = await this.storageService.download(audioAsset.blob_storage_id);
        const scriptData = JSON.parse((await this.storageService.download(scriptAsset.blob_storage_id)).toString());

        const captionProvider = this.aiFactory.getCaptionGenerator('replicate');
        const captionBuffer = await captionProvider.generateCaptions(audioBuffer, scriptData.text);

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
        const scriptAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.SCRIPT } });
        if (!scriptAsset) throw new Error('Script asset missing');

        const scriptData = JSON.parse((await this.storageService.download(scriptAsset.blob_storage_id)).toString());
        const scriptJson: ScriptJSON = scriptData.json;

        const imageProvider = this.aiFactory.getImageGenerator(media.input_config?.imageProvider || 'gemini');
        const masterPrompt = `Cinematic video about ${media.input_config?.topic}. ` + scriptJson.scenes.map(s => s.image_prompt).join('. ');

        const sceneCount = scriptJson.scenes.length;
        const blobIds: string[] = [];
        const batchSize = 4;

        for (let i = 0; i < sceneCount; i += batchSize) {
            const count = Math.min(batchSize, sceneCount - i);
            const buffers = await imageProvider.generateImages({
                prompt: masterPrompt,
                style: media.input_config?.imageStyle,
                aspectRatio: media.input_config?.imageAspectRatio as any,
                count
            });

            for (const buffer of buffers) {
                const blobId = await this.storageService.upload({
                    userId: media.user_id,
                    mediaId: media.id,
                    type: 'image',
                    step: 'images',
                    buffer
                });
                await this.addAsset(media.id, MediaAssetType.IMAGE, blobId);
                blobIds.push(blobId);
            }
        }
        return blobIds;
    }

    private async handleRenderStep(media: Media): Promise<string> {
        const audioAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.AUDIO } });
        const captionAsset = await this.assetRepository.findOne({ where: { media_id: media.id, type: MediaAssetType.CAPTION } });
        const imageAssets = await this.assetRepository.find({ where: { media_id: media.id, type: MediaAssetType.IMAGE } });

        if (!audioAsset || !captionAsset || imageAssets.length === 0) {
            throw new Error('Assets missing for rendering');
        }

        const [audioBuffer, captionBuffer, ...imageBuffers] = await Promise.all([
            this.storageService.download(audioAsset.blob_storage_id),
            this.storageService.download(captionAsset.blob_storage_id),
            ...imageAssets.map(a => this.storageService.download(a.blob_storage_id))
        ]);

        const finalBuffer = await this.videoRenderer.compose({
            audio: audioBuffer,
            caption: captionBuffer,
            assets: imageBuffers,
        });

        const blobId = await this.storageService.upload({
            userId: media.user_id,
            mediaId: media.id,
            type: 'video',
            step: 'render',
            buffer: finalBuffer
        });

        await this.addAsset(media.id, MediaAssetType.VIDEO, blobId);
        return blobId;
    }

    private async addAsset(mediaId: string, type: MediaAssetType, blobId: string, metadata?: any): Promise<void> {
        const asset = this.assetRepository.create({
            media_id: mediaId,
            type,
            blob_storage_id: blobId,
            metadata,
        });
        await this.assetRepository.save(asset);
    }
}
