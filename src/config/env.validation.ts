import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUrl,
  ValidateNested,
  validateSync,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class DatabaseConfig {
  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsOptional()
  @IsString()
  DB_SSL?: string;
}

class RedisConfig {
  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;
}

class AuthConfig {
  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;
}

class AppConfig {
  @IsString()
  NODE_ENV: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;

  @IsOptional()
  @IsString()
  API_PREFIX?: string;
}

class AIConfig {
  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  REPLICATE_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  HUGGINGFACE_API_KEY?: string;
}

class StorageConfig {
  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  S3_BUCKET_NAME: string;

  @IsOptional()
  @IsString()
  AWS_REGION?: string;
}

class OAuthConfig {
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  MICROSOFT_CLIENT_SECRET?: string;
}

export class EnvironmentVariables {
  @ValidateNested()
  @Type(() => DatabaseConfig)
  database: DatabaseConfig;

  @ValidateNested()
  @Type(() => RedisConfig)
  redis: RedisConfig;

  @ValidateNested()
  @Type(() => AuthConfig)
  auth: AuthConfig;

  @ValidateNested()
  @Type(() => AppConfig)
  app: AppConfig;

  @ValidateNested()
  @Type(() => AIConfig)
  ai: AIConfig;

  @ValidateNested()
  @Type(() => StorageConfig)
  storage: StorageConfig;

  @ValidateNested()
  @Type(() => OAuthConfig)
  oauth: OAuthConfig;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  // In development, allow missing OPENAI_API_KEY (will use mock providers)
  const isDevelopment = config.NODE_ENV !== 'production';
  const skipMissingProperties = isDevelopment;

  const errors = validateSync(validatedConfig, {
    skipMissingProperties,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
