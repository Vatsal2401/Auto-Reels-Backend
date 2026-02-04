import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MediaService } from '../media/media.service';
import { MediaOrchestratorService } from '../media/media-orchestrator.service';
import { MediaType } from '../media/media.constants';

async function verifyCaptions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const mediaService = app.get(MediaService);
  const orchestrator = app.get(MediaOrchestratorService);

  console.log('Creating Media with Captions Config...');

  const media = await mediaService.createMedia(
    {
      topic:
        'The Future of Artificial Intelligence: transform our world in the next 10 years with rapid automation and generative creativity.',
      type: MediaType.VIDEO,
      flowKey: 'videoMotion',
      captions: {
        enabled: true,
        preset: 'viral-pop',
        position: 'top',
        timing: 'word',
      },
    },
    '164979',
  ); // Using existing user ID from logs

  console.log(`Media Created: ${media.id}`);
  console.log('Triggering Orchestration...');

  // Start processing
  orchestrator.processMedia(media.id);

  console.log('Processing started. Monitor logs for "Captions MVP" details.');

  // Keep alive for a bit to see logs
  await new Promise((resolve) => setTimeout(resolve, 10000));
  await app.close();
}

verifyCaptions();
