import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { Media } from '../media/entities/media.entity';
import { MediaStep } from '../media/entities/media-step.entity';
import { BackgroundMusic } from '../media/entities/background-music.entity';
import { MediaAsset } from '../media/entities/media-asset.entity';
import { User } from '../auth/entities/user.entity';
import { CreditPlan } from '../payment/entities/credit-plan.entity';
import { Payment } from '../payment/entities/payment.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';
import { Project } from '../projects/entities/project.entity';
import { ShowcaseItem } from '../showcase/entities/showcase-item.entity';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AdminImpersonationLog } from '../admin/entities/admin-impersonation-log.entity';
import { PseoPage } from '../pseo/entities/pseo-page.entity';
import { PseoSeedDimension } from '../pseo/entities/pseo-seed-dimension.entity';
import { PseoPlaybookConfig } from '../pseo/entities/pseo-playbook-config.entity';
import { UserNotification } from '../user-notifications/entities/user-notification.entity';
import { BlogPost } from '../blog/entities/blog-post.entity';
import { BlogComment } from '../blog/entities/blog-comment.entity';
import { BlogLike } from '../blog/entities/blog-like.entity';
import { BlogAdminNote } from '../blog/entities/blog-admin-note.entity';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { ConnectedAccount } from '../social/entities/connected-account.entity';
import { ScheduledPost } from '../social/entities/scheduled-post.entity';
import { UploadLog } from '../social/entities/upload-log.entity';
import { UgcActor } from '../ugc/entities/ugc-actor.entity';
import { UgcContentLibrary } from '../ugc/entities/ugc-content-library.entity';
import { UgcAbTest } from '../ugc/entities/ugc-ab-test.entity';
import { Story } from '../story/entities/story.entity';
import { StoryCharacter } from '../story/entities/story-character.entity';
import { StoryScene } from '../story/entities/story-scene.entity';
import { BrollLibrary } from '../broll/entities/broll-library.entity';
import { BrollScript } from '../broll/entities/broll-script.entity';
import { BrollMatchResult } from '../broll/entities/broll-match-result.entity';
import { BrollIngestionJob } from '../broll/entities/broll-ingestion-job.entity';
import { BrollAirImport } from '../broll/entities/broll-air-import.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_reels',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    Media,
    MediaStep,
    MediaAsset,
    User,
    BackgroundMusic,
    CreditPlan,
    Payment,
    CreditTransaction,
    Project,
    ShowcaseItem,
    AdminUser,
    AdminImpersonationLog,
    PseoPage,
    PseoSeedDimension,
    PseoPlaybookConfig,
    UserNotification,
    BlogPost,
    BlogComment,
    BlogLike,
    BlogAdminNote,
    UserSettings,
    ConnectedAccount,
    ScheduledPost,
    UploadLog,
    UgcActor,
    UgcContentLibrary,
    UgcAbTest,
    Story,
    StoryCharacter,
    StoryScene,
    BrollLibrary,
    BrollScript,
    BrollMatchResult,
    BrollIngestionJob,
    BrollAirImport,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
