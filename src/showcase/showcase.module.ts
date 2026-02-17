import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from '../media/entities/media.entity';
import { Project } from '../projects/entities/project.entity';
import { ShowcaseItem } from './entities/showcase-item.entity';
import { StorageModule } from '../storage/storage.module';
import { ShowcaseController } from './showcase.controller';
import { ShowcaseService } from './showcase.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShowcaseItem, Media, Project]), StorageModule],
  controllers: [ShowcaseController],
  providers: [ShowcaseService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
