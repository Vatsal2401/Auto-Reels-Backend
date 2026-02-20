import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShowcaseService, ShowcaseResponse } from './showcase.service';
import { ShowcaseItem } from './entities/showcase-item.entity';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';

/** File from multipart upload (FileInterceptor). We only use buffer. */
type UploadedFileType = { buffer?: Buffer } | undefined;

@Controller('showcase')
export class ShowcaseController {
  constructor(private readonly showcaseService: ShowcaseService) {}

  @Get()
  async getShowcase(): Promise<ShowcaseResponse> {
    return this.showcaseService.getShowcase();
  }

  @UseGuards(AdminJwtGuard)
  @Post('items')
  async createItem(
    @Body()
    body: {
      type: 'reel' | 'graphic_motion' | 'text_to_image';
      mediaId?: string | null;
      projectId?: string | null;
      imageUrl?: string | null;
      sortOrder?: number;
    },
  ): Promise<ShowcaseItem> {
    return this.showcaseService.createItem(body);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('items/:id')
  async updateItem(
    @Param('id') id: string,
    @Body()
    body: {
      type?: 'reel' | 'graphic_motion' | 'text_to_image';
      mediaId?: string | null;
      projectId?: string | null;
      imageUrl?: string | null;
      clipBlobId?: string | null;
      sortOrder?: number;
    },
  ): Promise<ShowcaseItem> {
    return this.showcaseService.updateItem(id, body);
  }

  @UseGuards(AdminJwtGuard)
  @Delete('items/:id')
  async deleteItem(@Param('id') id: string): Promise<void> {
    return this.showcaseService.deleteItem(id);
  }

  @UseGuards(AdminJwtGuard)
  @Post('items/:id/clip')
  @UseInterceptors(FileInterceptor('file'))
  async uploadClipForItem(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileType,
  ): Promise<{ blobId: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    return this.showcaseService.uploadClipForItem(id, file.buffer);
  }
}
