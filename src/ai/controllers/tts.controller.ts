import { Controller, Post, Body, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { IVoiceManagementService } from '../interfaces/voice-management.interface';
import { ElevenLabsService } from '../elevenlabs.service';

const MAD_SCIENTIST_LABEL = 'Mad Scientist - Energetic';
const MAD_SCIENTIST_ELEVENLABS_ID = 'yjJ45q8TVCrtMhEKurxY';

@Controller('tts')
export class TTSController {
  constructor(
    @Inject('IVoiceManagementService') private readonly voiceService: IVoiceManagementService,
    private readonly elevenLabsService: ElevenLabsService,
  ) {}

  @Post('preview')
  async generatePreview(
    @Body() body: { voiceId: string; language: string; voiceLabel?: string },
    @Res() res: Response,
  ) {
    try {
      const isMadScientist = body.voiceLabel === MAD_SCIENTIST_LABEL;
      const audioBuffer = isMadScientist
        ? await this.elevenLabsService.generatePreview(MAD_SCIENTIST_ELEVENLABS_ID, body.language)
        : await this.voiceService.generatePreview(body.voiceId, body.language);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });

      res.send(audioBuffer);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const details = error.response?.data
        ? Buffer.from(error.response.data).toString()
        : error.message;

      res.status(status).json({
        message: 'Failed to generate TTS preview',
        details: details,
      });
    }
  }
}
