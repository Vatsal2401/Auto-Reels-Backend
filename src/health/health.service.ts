import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { Redis } from 'ioredis';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection()
    private connection: Connection,
  ) {}

  async check() {
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();

    const isHealthy = dbStatus.status === 'up' && redisStatus.status === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }

  async detailed() {
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      status: dbStatus.status === 'up' && redisStatus.status === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime)}s`,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      },
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || 'development',
      },
    };
  }

  private async checkDatabase() {
    try {
      await this.connection.query('SELECT 1');
      return {
        status: 'up',
        message: 'Database connection successful',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis() {
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null, // Don't retry on health check
      });

      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();

      return {
        status: pong === 'PONG' ? 'up' : 'down',
        message: pong === 'PONG' ? 'Redis connection successful' : 'Redis ping failed',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }
}
