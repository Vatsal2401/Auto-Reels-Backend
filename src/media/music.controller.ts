import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('system')
  async getSystemMusic() {
    const music = await this.musicService.findAllSystemMusic();
    return Promise.all(
      music.map(async (m) => ({
        ...m,
        url: await this.musicService.getMusicUrl(m.blob_storage_id),
      })),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserMusic(@Req() req: any) {
    const music = await this.musicService.findUserMusic(req.user.id);
    return Promise.all(
      music.map(async (m) => ({
        ...m,
        url: await this.musicService.getMusicUrl(m.blob_storage_id),
      })),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMusic(@Req() req: any, @UploadedFile() file: any, @Body('name') name: string) {
    const music = await this.musicService.uploadMusic(req.user.id, file, name);
    return {
      ...music,
      url: await this.musicService.getMusicUrl(music.blob_storage_id),
    };
  }
}
