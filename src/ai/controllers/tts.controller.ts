import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ElevenLabsService } from '../elevenlabs.service';

@Controller('tts')
export class TTSController {
  constructor(private readonly elevenLabsService: ElevenLabsService) {}

  @Post('preview')
  async generatePreview(@Body() body: { voiceId: string; language: string }, @Res() res: Response) {
    try {
      const audioBuffer = await this.elevenLabsService.generatePreview(body.voiceId, body.language);

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
