import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { ScriptProcessor } from '../src/queue/processors/script.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('ScriptWorker');
  
  // Get processor to ensure it's registered
  app.get(ScriptProcessor);
  
  logger.log('Script worker started and listening for jobs');
  
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start script worker:', error);
  process.exit(1);
});
