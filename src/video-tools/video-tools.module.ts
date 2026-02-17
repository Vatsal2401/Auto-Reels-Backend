import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoToolsController } from './video-tools.controller';
import { VideoToolsQueueService } from './video-tools-queue.service';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, ProjectsModule, StorageModule],
  controllers: [VideoToolsController],
  providers: [VideoToolsQueueService],
  exports: [VideoToolsQueueService],
})
export class VideoToolsModule {}
