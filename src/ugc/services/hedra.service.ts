import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HedraJobResult {
  jobId: string;
  videoUrl: string;
}

@Injectable()
export class HedraService {
  private readonly logger = new Logger(HedraService.name);
  private readonly baseUrl = 'https://mercury.dev.dream-machine.io/v1';
  private readonly pollIntervalMs = 4000;
  private readonly timeoutMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('HEDRA_API_KEY');
    if (!key) throw new Error('HEDRA_API_KEY not configured');
    return key;
  }

  /**
   * Submit a character generation job to Hedra.
   * avatar_image_url: signed S3 URL for actor portrait
   * audio_url: signed S3 URL for voice-over audio
   * Returns job_id for polling.
   */
  async submitJob(params: {
    avatarImageUrl: string;
    audioUrl: string;
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/characters`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_image_url: params.avatarImageUrl,
        audio_url: params.audioUrl,
        aspect_ratio: '9:16',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hedra submit failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { job_id: string };
    this.logger.log(`Hedra job submitted: ${data.job_id}`);
    return data.job_id;
  }

  /**
   * Poll Hedra until the job completes or times out.
   * Returns the final video URL.
   */
  async pollUntilComplete(jobId: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;

    while (Date.now() < deadline) {
      const response = await fetch(`${this.baseUrl}/characters/${jobId}`, {
        headers: { 'X-API-Key': this.apiKey },
      });

      if (!response.ok) {
        throw new Error(`Hedra poll failed (${response.status}) for job ${jobId}`);
      }

      const data = (await response.json()) as {
        status: 'pending' | 'processing' | 'complete' | 'error';
        video_url?: string;
        error?: string;
      };

      this.logger.debug(`Hedra job ${jobId}: status=${data.status}`);

      if (data.status === 'complete') {
        if (!data.video_url) throw new Error(`Hedra job ${jobId} complete but no video_url`);
        return data.video_url;
      }

      if (data.status === 'error') {
        throw new Error(`Hedra job ${jobId} failed: ${data.error || 'unknown error'}`);
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }

    throw new Error(`Hedra job ${jobId} timed out after ${this.timeoutMs / 1000}s`);
  }
}
