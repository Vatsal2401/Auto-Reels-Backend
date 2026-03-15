import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UgcActor } from './entities/ugc-actor.entity';
import { UgcContentLibrary } from './entities/ugc-content-library.entity';
import { UgcAbTest } from './entities/ugc-ab-test.entity';
import { UgcService } from './services/ugc.service';
import { UgcScriptService } from './services/ugc-script.service';
import { HedraService } from './services/hedra.service';
import { BrollLibraryService } from './services/broll-library.service';
import { UgcComposeService } from './services/ugc-compose.service';
import { UgcRenderQueueService } from './queues/ugc-render-queue.service';
import { UgcController } from './controllers/ugc.controller';
import { UgcAdminController } from './controllers/ugc-admin.controller';
import { CreditsModule } from '../credits/credits.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { Media } from '../media/entities/media.entity';
import { MediaStep } from '../media/entities/media-step.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UgcActor, UgcContentLibrary, UgcAbTest, Media, MediaStep]),
    CreditsModule,
    StorageModule,
    UserSettingsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => MediaModule),
  ],
  controllers: [UgcController, UgcAdminController],
  providers: [
    UgcService,
    UgcScriptService,
    HedraService,
    BrollLibraryService,
    UgcComposeService,
    UgcRenderQueueService,
  ],
  exports: [
    UgcScriptService,
    HedraService,
    BrollLibraryService,
    UgcComposeService,
    UgcRenderQueueService,
  ],
})
export class UgcModule {}
