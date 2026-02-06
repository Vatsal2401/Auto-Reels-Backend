import { DataSource } from 'typeorm';
import { Media } from '../src/media/entities/media.entity';
import { MediaStep, StepStatus } from '../src/media/entities/media-step.entity';
import { MediaAsset } from '../src/media/entities/media-asset.entity';
import { BackgroundMusic } from '../src/media/entities/background-music.entity';
import { User } from '../src/auth/entities/user.entity';
import { RenderQueueService } from '../src/render/render-queue.service';
import { ConfigService } from '@nestjs/config';
import { LocalCaptionProvider } from '../src/ai/providers/local-caption.provider';
import { AssSubtitleProvider } from '../src/ai/providers/ass-subtitle.provider';
import { SupabaseStorageService } from '../src/storage/providers/supabase-storage.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
    entities: [Media, MediaStep, MediaAsset, User, BackgroundMusic],
});

async function triggerTest() {
    try {
        await AppDataSource.initialize();
        console.log('🚀 Starting Comprehensive Video Feature Test...');

        const mediaId = 'd2114fcd-6940-45b0-9c8f-7e580c0db62d';
        const media = await AppDataSource.getRepository(Media).findOne({
            where: { id: mediaId },
            relations: ['steps', 'assets'],
        });

        if (!media) throw new Error('Media not found');

        // 1. Generate NEW Word-Timing Captions
        console.log('📝 Generating Word-Timing (Karaoke) Captions...');
        const storageService = new SupabaseStorageService(new ConfigService({
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_KEY: process.env.SUPABASE_KEY,
            SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'media-assets',
            STORAGE_S3_REGION: process.env.STORAGE_S3_REGION,
            STORAGE_S3_ACCESS_KEY_ID: process.env.STORAGE_S3_ACCESS_KEY_ID,
            STORAGE_S3_SECRET_ACCESS_KEY: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
            STORAGE_S3_ENDPOINT: process.env.STORAGE_S3_ENDPOINT,
        }));

        const audioAsset = media.assets.find(a => a.type === 'audio');
        const scriptAsset = media.assets.find(a => a.type === 'script');
        if (!audioAsset || !scriptAsset) throw new Error('Basic assets missing');

        const audioBuffer = await storageService.download(audioAsset.blob_storage_id);
        const scriptData = JSON.parse((await storageService.download(scriptAsset.blob_storage_id)).toString());

        const assProvider = new AssSubtitleProvider();
        const captionProvider = new LocalCaptionProvider(assProvider);

        const captionBuffer = await captionProvider.generateCaptions(
            audioBuffer,
            scriptData.text,
            undefined,
            'word', // KARAOKE MODE
            { preset: 'karaoke-card', position: 'center' }
        );

        const captionBlobId = await storageService.upload({
            userId: media.user_id,
            mediaId: media.id,
            type: 'caption',
            step: 'captions',
            buffer: captionBuffer,
            fileName: 'test-karaoke.ass'
        });
        console.log(`✅ Karaoke Caption uploaded: ${captionBlobId}`);

        // 2. Find Music
        const music = await AppDataSource.getRepository(BackgroundMusic).findOne({
            where: { is_system: true }
        });
        console.log(`🎵 Using Music: ${music?.title} (${music?.blob_storage_id})`);

        // 3. Update Input Config in DB (for tracking)
        await AppDataSource.getRepository(Media).update(mediaId, {
            input_config: {
                ...media.input_config,
                captions: { preset: 'karaoke-card', timing: 'word', enabled: true, position: 'center' },
                music: music ? { id: music.id, volume: 0.15 } : undefined
            }
        });

        // 4. Queue Job
        const configService = new ConfigService({ REDIS_URL: process.env.REDIS_URL });
        const renderQueue = new RenderQueueService(configService);

        const imageAssets = media.assets.filter(a => a.type === 'image');
        const step = media.steps.find(s => s.step === 'render');

        await renderQueue.queueRenderJob({
            mediaId: media.id,
            stepId: step.id,
            userId: media.user_id,
            assets: {
                audio: audioAsset.blob_storage_id,
                caption: captionBlobId, // USE THE NEW KARAOKE CAPTION
                images: imageAssets.map((a) => a.blob_storage_id),
                music: music?.blob_storage_id,
            },
            options: {
                preset: 'superfast',
                rendering_hints: {
                    fast_mode: true,
                    smart_micro_scenes: true,
                    captions: { preset: 'karaoke-card', timing: 'word', enabled: true, position: 'center' },
                    musicVolume: 0.15,
                },
            },
        });

        console.log('🚀 Test render job queued successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await AppDataSource.destroy();
        process.exit(0);
    }
}

triggerTest();
