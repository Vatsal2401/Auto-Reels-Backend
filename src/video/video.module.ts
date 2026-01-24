import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Video } from './entities/video.entity';
import { Job } from './entities/job.entity';
import { Asset } from './entities/asset.entity';
import { QueueModule } from '../queue/queue.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, Job, Asset]),
    forwardRef(() => QueueModule),
    CreditsModule,
  ],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
