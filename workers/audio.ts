import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { AudioProcessor } from '../src/queue/processors/audio.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('AudioWorker');

  app.get(AudioProcessor);

  logger.log('Audio worker started and listening for jobs');

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start audio worker:', error);
  process.exit(1);
});
