import { MigrationInterface, QueryRunner } from 'typeorm';

const CREDIT_COSTS: Record<string, number> = {
  '30-60': 1,
  '60-90': 2,
  '90-120': 3,
  default: 1,
};

function mapMediaStatusToProjectStatus(mediaStatus: string): string {
  if (mediaStatus === 'completed') return 'completed';
  if (mediaStatus === 'failed') return 'failed';
  return 'processing';
}

function getCreditCost(inputConfig: Record<string, unknown> | null): number {
  if (!inputConfig || typeof inputConfig !== 'object') return 1;
  const duration = inputConfig.duration;
  if (typeof duration === 'string' && CREDIT_COSTS[duration] != null) {
    return CREDIT_COSTS[duration];
  }
  return CREDIT_COSTS.default;
}

export class BackfillProjectsFromMedia1770800000000 implements MigrationInterface {
  name = 'BackfillProjectsFromMedia1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT id, user_id, status, blob_storage_id, input_config, error_message, created_at, updated_at, completed_at
       FROM media
       WHERE project_id IS NULL`,
    );

    for (const row of rows) {
      const projectStatus = mapMediaStatusToProjectStatus(row.status);
      const creditCost = getCreditCost(row.input_config);
      const metadata =
        row.input_config && typeof row.input_config === 'object'
          ? JSON.stringify(row.input_config)
          : null;

      const insertResult = await queryRunner.query(
        `INSERT INTO projects (
          user_id, tool_type, status, output_url, metadata, credit_cost,
          error_message, created_at, updated_at, completed_at
        ) VALUES ($1, 'reel', $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          row.user_id,
          projectStatus,
          row.blob_storage_id,
          metadata,
          creditCost,
          row.error_message,
          row.created_at,
          row.updated_at,
          row.completed_at,
        ],
      );

      const projectId = insertResult[0]?.id;
      if (projectId) {
        await queryRunner.query(`UPDATE media SET project_id = $1 WHERE id = $2`, [
          projectId,
          row.id,
        ]);
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data backfill cannot be safely reverted (would remove all reel projects).
    // No-op; run a separate script if you need to undo.
  }
}
