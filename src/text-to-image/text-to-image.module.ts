import { Module } from '@nestjs/common';
import { TextToImageService } from './text-to-image.service';
import { TextToImageController } from './text-to-image.controller';
import { StorageModule } from '../storage/storage.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [StorageModule, ProjectsModule],
  providers: [TextToImageService],
  controllers: [TextToImageController],
})
export class TextToImageModule {}
