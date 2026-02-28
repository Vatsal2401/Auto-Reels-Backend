import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class TokenEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string, keyVersion = 'v1'): string {
    const key = this.getKeyForVersion(keyVersion);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: version:iv_hex:tag_hex:ciphertext_hex
    return [
      keyVersion,
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }
    const [version, ivHex, tagHex, ctHex] = parts;
    const key = this.getKeyForVersion(version);

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ctHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKeyForVersion(version: string): Buffer {
    const keys: Record<string, string | undefined> = {
      v1: this.configService.get<string>('TOKEN_ENCRYPTION_KEY_V1'),
      v2: this.configService.get<string>('TOKEN_ENCRYPTION_KEY_V2'),
    };
    const keyHex = keys[version];
    if (!keyHex) {
      throw new Error(`Unknown or unconfigured encryption key version: ${version}`);
    }
    return Buffer.from(keyHex, 'hex');
  }
}
