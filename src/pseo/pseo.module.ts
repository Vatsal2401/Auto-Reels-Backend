import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PseoPage } from './entities/pseo-page.entity';
import { PseoService } from './services/pseo.service';
import { PseoSeedService } from './services/pseo-seed.service';
import { PseoContentService } from './services/pseo-content.service';
import { PseoValidatorService } from './services/pseo-validator.service';
import { PseoLinkingService } from './services/pseo-linking.service';
import { PseoQueueService } from './pseo-queue.service';
import { PseoPublicController } from './controllers/pseo-public.controller';
import { PseoAdminController } from './controllers/pseo-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PseoPage])],
  controllers: [PseoPublicController, PseoAdminController],
  providers: [
    PseoService,
    PseoSeedService,
    PseoContentService,
    PseoValidatorService,
    PseoLinkingService,
    PseoQueueService,
  ],
  exports: [PseoService],
})
export class PseoModule {}
