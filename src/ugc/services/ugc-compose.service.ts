import { Injectable, Logger } from '@nestjs/common';
import { UgcRenderQueueService, UgcRenderJobPayload } from '../queues/ugc-render-queue.service';

@Injectable()
export class UgcComposeService {
  private readonly logger = new Logger(UgcComposeService.name);

  constructor(private readonly ugcRenderQueue: UgcRenderQueueService) {}

  async enqueueComposition(payload: UgcRenderJobPayload): Promise<string> {
    this.logger.log(`Enqueuing UGC composition for media: ${payload.mediaId}`);
    return this.ugcRenderQueue.queueUgcRenderJob(payload);
  }
}
