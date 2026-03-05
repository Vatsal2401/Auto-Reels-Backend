import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from './entities/story.entity';
import { StoryCharacter } from './entities/story-character.entity';
import { StoryScene } from './entities/story-scene.entity';
import { StoryService } from './services/story.service';
import { StoryScriptService } from './services/story-script.service';
import { StoryRenderQueueService } from './queues/story-render-queue.service';
import { StoryController } from './controllers/story.controller';
import { CreditsModule } from '../credits/credits.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';
import { Media } from '../media/entities/media.entity';
import { MediaStep } from '../media/entities/media-step.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryCharacter, StoryScene, Media, MediaStep]),
    CreditsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => MediaModule),
  ],
  controllers: [StoryController],
  providers: [StoryService, StoryScriptService, StoryRenderQueueService],
  exports: [StoryScriptService, StoryRenderQueueService],
})
export class StoryModule {}
