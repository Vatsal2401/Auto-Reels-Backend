import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScriptProcessorService } from './script-processor.service';
import { DurationAllocatorService } from './duration-allocator.service';
import { KineticTypographyService } from './kinetic-typography.service';
import { RenderModule } from '../render/render.module';
import { MediaModule } from '../media/media.module';
import { User } from '../auth/entities/user.entity';
import { ScenePlannerService } from './ai/scene-planner.service';
import { SceneIntelligenceService } from './services/scene-intelligence.service';
import { MotionEngineService } from './services/motion-engine.service';
import { LayoutEngineService } from './services/layout-engine.service';
import { SceneRhythmEngineService } from './services/scene-rhythm-engine.service';
import { TransitionManagerService } from './services/transition-manager.service';
import { TemplateEngineService } from './services/template-engine.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RenderModule, forwardRef(() => MediaModule)],
  providers: [
    ScriptProcessorService,
    DurationAllocatorService,
    ScenePlannerService,
    SceneIntelligenceService,
    MotionEngineService,
    LayoutEngineService,
    TemplateEngineService,
    SceneRhythmEngineService,
    TransitionManagerService,
    KineticTypographyService,
  ],
  exports: [ScriptProcessorService, DurationAllocatorService, KineticTypographyService],
})
export class KineticTypographyModule {}
