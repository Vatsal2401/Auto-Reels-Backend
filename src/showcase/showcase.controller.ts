import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShowcaseService, ShowcaseResponse } from './showcase.service';

@Controller('showcase')
export class ShowcaseController {
  constructor(private readonly showcaseService: ShowcaseService) {}

  @Get()
  async getShowcase(): Promise<ShowcaseResponse> {
    return this.showcaseService.getShowcase();
  }

  @Patch()
  async updateShowcase(
    @Body()
    body: {
      reel_clip_blob_id?: string | null;
      graphic_motion_clip_blob_id?: string | null;
      text_to_image_url?: string | null;
      reel_media_id?: string | null;
      graphic_motion_project_id?: string | null;
    },
  ) {
    return this.showcaseService.update(body);
  }

  @Post('clips/:type')
  @UseInterceptors(FileInterceptor('file'))
  async uploadClip(@Param('type') type: string, @UploadedFile() file: Express.Multer.File) {
    if (type !== 'reel' && type !== 'graphic_motion') {
      throw new BadRequestException('type must be "reel" or "graphic_motion"');
    }
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    return this.showcaseService.uploadClip(type as 'reel' | 'graphic_motion', file.buffer);
  }
}
