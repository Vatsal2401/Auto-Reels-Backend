import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { KineticTypographyModule } from '../kinetic-typography/kinetic-typography.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), KineticTypographyModule, StorageModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
