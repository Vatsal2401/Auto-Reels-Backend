import {
  Controller,
  Post,
  UploadedFile,
  Body,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageToVideoEnabledGuard } from './guards/image-to-video-enabled.guard';
import { ImageToVideoService } from './image-to-video.service';
import { AnimateDto } from './dto/animate.dto';

@ApiTags('image-to-video')
@ApiBearerAuth()
@Controller('image-to-video')
@UseGuards(JwtAuthGuard, ImageToVideoEnabledGuard)
export class ImageToVideoController {
  constructor(private readonly imageToVideoService: ImageToVideoService) {}

  @Post('animate')
  @ApiOperation({ summary: 'Animate an image into a short video using Stable Video Diffusion' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async animate(@UploadedFile() file: Express.Multer.File, @Body() body: { data?: string }) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    let params: AnimateDto = {};
    if (body.data) {
      try {
        params = JSON.parse(body.data) as AnimateDto;
      } catch {
        throw new BadRequestException('Invalid JSON in data field.');
      }
    }

    return this.imageToVideoService.animate(file.buffer, file.mimetype, params);
  }
}
