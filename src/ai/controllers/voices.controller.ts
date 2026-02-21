import { Controller, Get, Inject } from '@nestjs/common';
import { NormalizedVoice } from '../elevenlabs.service';
import { IVoiceManagementService } from '../interfaces/voice-management.interface';

@Controller('voices')
export class VoicesController {
  constructor(
    @Inject('IVoiceManagementService') private readonly voiceService: IVoiceManagementService,
  ) {}

  @Get()
  async getVoices(): Promise<NormalizedVoice[]> {
    return this.voiceService.getVoices();
  }
}
