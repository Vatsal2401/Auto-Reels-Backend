import { Controller, Get } from '@nestjs/common';
import { ElevenLabsService, NormalizedVoice } from '../elevenlabs.service';

@Controller('voices')
export class VoicesController {
  constructor(private readonly elevenLabsService: ElevenLabsService) {}

  @Get()
  async getVoices(): Promise<NormalizedVoice[]> {
    return this.elevenLabsService.getVoices();
  }
}
