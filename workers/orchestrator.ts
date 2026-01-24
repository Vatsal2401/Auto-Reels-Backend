import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Logger } from '@nestjs/common';
import { OrchestratorProcessor } from '../src/queue/processors/orchestrator.processor';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('OrchestratorWorker');

  // Get processor to ensure it's registered
  app.get(OrchestratorProcessor);

  logger.log('Orchestrator worker started and listening for jobs');

  // Keep process alive
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start orchestrator worker:', error);
  process.exit(1);
});
