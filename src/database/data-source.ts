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
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
