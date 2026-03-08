import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class BrollEnabledGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId: string = req.user?.userId ?? req.user?.id;
    const rows = await this.dataSource.query(
      'SELECT broll_enabled FROM user_settings WHERE user_id = $1',
      [userId],
    ) as { broll_enabled: boolean }[];
    if (!rows[0]?.broll_enabled) {
      throw new ForbiddenException('B-roll feature not enabled');
    }
    return true;
  }
}
