import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation,
} from 'typeorm';
import { Media } from './media.entity';
import { MediaAssetType } from '../media.constants';

@Entity('media_assets')
export class MediaAsset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    media_id: string;

    @ManyToOne(() => Media, (media) => media.assets)
    @JoinColumn({ name: 'media_id' })
    media: Relation<Media>;

    @Column({
        type: 'enum',
        enum: MediaAssetType,
    })
    type: MediaAssetType;

    @Column({ type: 'text' })
    blob_storage_id: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any> | null;

    @CreateDateColumn()
    created_at: Date;
}
