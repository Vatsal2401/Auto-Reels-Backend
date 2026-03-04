import {
  Controller,
  Post,
  UploadedFiles,
  Body,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LipSyncEnabledGuard } from './guards/lipsync-enabled.guard';
import { LipSyncService } from './lipsync.service';
import { LipSyncDto } from './dto/lipsync.dto';

@ApiTags('lipsync')
@ApiBearerAuth()
@Controller('lipsync')
@UseGuards(JwtAuthGuard, LipSyncEnabledGuard)
export class LipSyncController {
  constructor(private readonly lipSyncService: LipSyncService) {}

  @Post()
  @ApiOperation({ summary: 'Animate a face image with audio using MuseTalk' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'face', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      { limits: { fileSize: 50 * 1024 * 1024 } },
    ),
  )
  async lipsync(
    @UploadedFiles() files: { face?: Express.Multer.File[]; audio?: Express.Multer.File[] },
    @Body() body: { data?: string },
  ) {
    const faceFile = files?.face?.[0];
    const audioFile = files?.audio?.[0];

    if (!faceFile) throw new BadRequestException('Face image is required.');
    if (!audioFile) throw new BadRequestException('Audio file is required.');

    let params: LipSyncDto = {};
    if (body.data) {
      try {
        params = JSON.parse(body.data) as LipSyncDto;
      } catch {
        throw new BadRequestException('Invalid JSON in data field.');
      }
    }

    return this.lipSyncService.lipsync(
      faceFile.buffer,
      faceFile.mimetype,
      audioFile.buffer,
      audioFile.originalname || 'audio.wav',
      params,
    );
  }
}
