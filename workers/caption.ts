import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { CaptionProcessor } from '../src/queue/processors/caption.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('CaptionWorker');

  app.get(CaptionProcessor);

  logger.log('Caption worker started and listening for jobs');

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start caption worker:', error);
  process.exit(1);
});
