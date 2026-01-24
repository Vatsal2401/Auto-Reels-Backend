import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { AssetProcessor } from '../src/queue/processors/asset.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('AssetWorker');
  
  app.get(AssetProcessor);
  
  logger.log('Asset worker started and listening for jobs');
  
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start asset worker:', error);
  process.exit(1);
});
