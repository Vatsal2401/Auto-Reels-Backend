import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { LipSyncDto } from './dto/lipsync.dto';

export interface LipSyncResult {
  video_base64: string;
  duration: number;
  fps: number;
}

@Injectable()
export class LipSyncService {
  private readonly serverUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.serverUrl = this.configService.get<string>('MUSETALK_SERVER_URL', 'http://musetalk.autoreels.in');
  }

  async lipsync(
    faceBuffer: Buffer,
    faceMimetype: string,
    audioBuffer: Buffer,
    audioFilename: string,
    params: LipSyncDto,
  ): Promise<LipSyncResult> {
    const form = new FormData();

    form.append('face', faceBuffer, { filename: 'face.jpg', contentType: faceMimetype });
    form.append('audio', audioBuffer, { filename: audioFilename });
    form.append('data', JSON.stringify({
      bbox_shift:  params.bbox_shift  ?? 0,
      fps:         params.fps         ?? 25,
      batch_size:  params.batch_size  ?? 8,
    }));

    try {
      const response = await axios.post<LipSyncResult>(
        `${this.serverUrl}/lipsync`,
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 600_000, // 10 min — MuseTalk can be slow on long audio
        },
      );
      return response.data;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : err?.message ?? 'MuseTalk server error';
      throw new BadGatewayException(`Lip-sync failed: ${message}`);
    }
  }
}
