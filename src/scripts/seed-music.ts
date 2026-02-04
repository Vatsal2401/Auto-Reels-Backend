import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MusicService } from '../media/music.service';
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
      name: 'Rise Above',
      category: 'Motivational',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    },
    {
      name: 'Solitude',
      category: 'Sad',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    },
    {
      name: 'Urban Pulse',
      category: 'Energetic',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    },
    {
      name: 'Serenity',
      category: 'Calm',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    },
    {
      name: 'Epic Journey',
      category: 'Cinematic',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    },
    {
      name: 'Midnight Study',
      category: 'Lo-fi',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    },
    {
      name: 'Dark Alley',
      category: 'Suspense',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    },
    {
      name: 'Joyful Day',
      category: 'Happy',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
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
