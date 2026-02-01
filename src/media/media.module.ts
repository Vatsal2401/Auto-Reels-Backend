import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { MediaStep } from './entities/media-step.entity';
import { MediaAsset } from './entities/media-asset.entity';
import { MediaService } from './media.service';
import { MediaOrchestratorService } from './media-orchestrator.service';
import { MediaController } from './media.controller';
import { CreditsModule } from '../credits/credits.module';
import { StorageModule } from '../storage/storage.module';
import { AIModule } from '../ai/ai.module';
import { RenderModule } from '../render/render.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Media, MediaStep, MediaAsset, User]),
        CreditsModule,
        StorageModule,
        AIModule,
        RenderModule,
        forwardRef(() => AuthModule),
    ],
    providers: [MediaService, MediaOrchestratorService],
    controllers: [MediaController],
    exports: [MediaService, MediaOrchestratorService],
})
export class MediaModule { }
