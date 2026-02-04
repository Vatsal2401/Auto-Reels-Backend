import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundMusic } from './entities/background-music.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';

@Injectable()
export class MusicService {
  constructor(
    @InjectRepository(BackgroundMusic)
    private musicRepository: Repository<BackgroundMusic>,
    @Inject('IStorageService') private storageService: IStorageService,
  ) {}

  async findAllSystemMusic() {
    return this.musicRepository.find({
      where: { is_system: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async findUserMusic(userId: string) {
    return this.musicRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string) {
    return this.musicRepository.findOne({ where: { id } });
  }

  async uploadMusic(userId: string, file: any, name: string) {
    const blobId = await this.storageService.upload({
      userId,
      mediaId: 'library',
      type: 'audio',
      buffer: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
    });

    const music = this.musicRepository.create({
      name,
      blob_storage_id: blobId,
      user_id: userId,
      is_system: false,
    });

    return this.musicRepository.save(music);
  }

  async getMusicUrl(blobId: string) {
    return this.storageService.getSignedUrl(blobId);
  }
}
