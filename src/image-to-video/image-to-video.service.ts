import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import { AnimateDto } from './dto/animate.dto';

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
    form.append('image', imageBuffer, { filename: 'image', contentType: mimetype });

    // Append each param individually so the server receives them as form fields
    const defaults: Required<AnimateDto> = {
      num_frames: 25,
      num_inference_steps: 15,
      fps: 7,
      motion_bucket_id: 127,
      noise_aug_strength: 0.02,
      seed: -1,
    };

    form.append('num_frames',           String(params.num_frames           ?? defaults.num_frames));
    form.append('num_inference_steps',  String(params.num_inference_steps  ?? defaults.num_inference_steps));
    form.append('fps',                  String(params.fps                  ?? defaults.fps));
    form.append('motion_bucket_id',     String(params.motion_bucket_id     ?? defaults.motion_bucket_id));
    form.append('noise_aug_strength',   String(params.noise_aug_strength   ?? defaults.noise_aug_strength));
    form.append('seed',                 String(params.seed                 ?? defaults.seed));

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
      const message = err?.response?.data?.detail || err?.message || 'SVD server error';
      throw new BadGatewayException(`Image-to-video failed: ${message}`);
    }
  }
}
