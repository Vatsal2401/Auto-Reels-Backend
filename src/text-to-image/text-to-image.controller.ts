import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TextToImageService, GenerateImageDto } from './text-to-image.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('text-to-image')
export class TextToImageController {
  constructor(private readonly textToImageService: TextToImageService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  async generate(@Body() dto: GenerateImageDto, @Req() req: any) {
    return this.textToImageService.generate(req.user.userId, dto);
  }
}
