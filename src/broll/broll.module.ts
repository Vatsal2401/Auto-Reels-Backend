import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { BrollService } from './broll.service';
import { BrollController } from './broll.controller';
import { BrollAdminController } from './broll.admin.controller';
import { BrollLibraryController } from './controllers/broll-library.controller';
import { BrollScriptController } from './controllers/broll-script.controller';
import { BrollLibraryService } from './services/broll-library.service';
import { BrollScriptService } from './services/broll-script.service';
import { BrollPythonService } from './services/broll-python.service';
import { BrollAirImportService } from './services/broll-air-import.service';
import { BrollLibrary } from './entities/broll-library.entity';
import { BrollScript } from './entities/broll-script.entity';
import { BrollMatchResult } from './entities/broll-match-result.entity';
import { BrollIngestionJob } from './entities/broll-ingestion-job.entity';
import { BrollAirImport } from './entities/broll-air-import.entity';

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    TypeOrmModule.forFeature([
      BrollLibrary,
      BrollScript,
      BrollMatchResult,
      BrollIngestionJob,
      BrollAirImport,
    ]),
  ],
  providers: [
    BrollService,
    BrollPythonService,
    BrollLibraryService,
    BrollScriptService,
    BrollAirImportService,
  ],
  controllers: [
    BrollController,
    BrollAdminController,
    BrollLibraryController,
    BrollScriptController,
  ],
})
export class BrollModule {}
