import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { AnimateDto, VideoFormat } from './dto/animate.dto';

const FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  horizontal: { width: 1024, height: 576 },
  vertical:   { width: 576,  height: 1024 },
  square:     { width: 576,  height: 576  },
};

export interface AnimateResult {
  video_base64: string;
  frames: number;
  seed_used: number;
}

@Injectable()
export class ImageToVideoService {
  private readonly serverUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.serverUrl = this.configService.get<string>('SVD_SERVER_URL', 'http://sdm.autoreels.in');
  }

  async animate(imageBuffer: Buffer, mimetype: string, params: AnimateDto): Promise<AnimateResult> {
    const form = new FormData();

    const { width, height } = FORMAT_DIMENSIONS[params.format ?? 'horizontal'];

    // SVD server expects field name "file" and a JSON-encoded "data" string
    form.append('file', imageBuffer, { filename: 'image', contentType: mimetype });
    form.append('data', JSON.stringify({
      num_frames:          params.num_frames          ?? 25,
      num_inference_steps: params.num_inference_steps ?? 15,
      fps:                 params.fps                 ?? 7,
      motion_bucket_id:    params.motion_bucket_id    ?? 127,
      noise_aug_strength:  params.noise_aug_strength  ?? 0.02,
      seed:                params.seed                ?? -1,
      width,
      height,
    }));

    try {
      const response = await axios.post<AnimateResult>(
        `${this.serverUrl}/animate`,
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 300_000, // 5 min — SVD generation can take ~100s
        },
      );
      return response.data;
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : err?.message ?? 'SVD server error';
      throw new BadGatewayException(`Image-to-video failed: ${message}`);
    }
  }
}
