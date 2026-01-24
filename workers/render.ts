import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { RenderProcessor } from '../src/queue/processors/render.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('RenderWorker');
  
  app.get(RenderProcessor);
  
  logger.log('Render worker started and listening for jobs');
  
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start render worker:', error);
  process.exit(1);
});
