import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Repository } from 'typeorm';
import { BackgroundMusic } from '../media/entities/background-music.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IStorageService } from '../storage/interfaces/storage.interface';
import axios from 'axios';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const musicRepository = app.get<Repository<BackgroundMusic>>(getRepositoryToken(BackgroundMusic));
  const storageService = app.get<IStorageService>('IStorageService');

  const categories = [
    {
      name: 'Viral Phonk',
      category: 'Trending',
      url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibe-130.mp3',
    },
    {
      name: 'Chill Aesthetic',
      category: 'Lofi',
      url: 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3',
    },
    {
      name: 'Deep Cinematic',
      category: 'Storytelling',
      url: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    },
    {
      name: 'Dark Mystery',
      category: 'Suspense',
      url: 'https://assets.mixkit.co/music/preview/mixkit-under-the-stars-491.mp3',
    },
    {
      name: 'Upbeat Vlog',
      category: 'Happy',
      url: 'https://assets.mixkit.co/music/preview/mixkit-fun-times-7.mp3',
    },
    {
      name: 'Epic Motivation',
      category: 'Power',
      url: 'https://assets.mixkit.co/music/preview/mixkit-glitchy-hip-hop-752.mp3',
    },
    {
      name: 'Retro Groove',
      category: 'Vintage',
      url: 'https://assets.mixkit.co/music/preview/mixkit-sun-and-matching-shades-177.mp3',
    },
  ];

  console.log('Clearing existing system music...');
  await musicRepository.delete({ is_system: true });

  console.log('Seeding system music with REAL sample audio...');

  for (const item of categories) {
    console.log(`Downloading ${item.name} from ${item.url}...`);
    try {
      const response = await axios.get(item.url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const blobId = await storageService.upload({
        userId: 'system',
        mediaId: 'seed-music',
        type: 'audio',
        buffer: buffer,
        fileName: `${item.category.toLowerCase()}.mp3`,
      });

      const music = musicRepository.create({
        name: item.name,
        category: item.category,
        blob_storage_id: blobId,
        is_system: true,
        metadata: {
          size: buffer.length,
          duration: 120, // Approximate
          originalUrl: item.url,
        },
      });

      await musicRepository.save(music);
      console.log(`Added: ${item.name} (${item.category}) -> ${blobId}`);
    } catch (error) {
      console.error(
        `Failed to download/upload ${item.name}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  await app.close();
  console.log('Seeding complete.');
}

bootstrap().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
