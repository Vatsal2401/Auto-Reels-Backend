import { Controller, Post, Body, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { IVoiceManagementService } from '../interfaces/voice-management.interface';

@Controller('tts')
export class TTSController {
  constructor(
    @Inject('IVoiceManagementService') private readonly voiceService: IVoiceManagementService,
  ) {}

  @Post('preview')
  async generatePreview(@Body() body: { voiceId: string; language: string }, @Res() res: Response) {
    try {
      const audioBuffer = await this.voiceService.generatePreview(body.voiceId, body.language);

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
