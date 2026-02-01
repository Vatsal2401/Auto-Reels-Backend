import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation,
} from 'typeorm';
import { Media } from './media.entity';

export enum StepStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUCCESS = 'success',
    FAILED = 'failed',
}

@Entity('media_steps')
export class MediaStep {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    media_id: string;

    @ManyToOne(() => Media, (media) => media.steps)
    @JoinColumn({ name: 'media_id' })
    media: Relation<Media>;

    @Column({ type: 'text' })
    step: string;

    @Column({
        type: 'enum',
        enum: StepStatus,
        default: StepStatus.PENDING,
    })
    status: StepStatus;

    @Column({ type: 'jsonb', nullable: true })
    depends_on: string[] | null;

    @Column({ type: 'jsonb', nullable: true })
    blob_storage_id: string | string[] | null;

    @Column({ type: 'int', default: 0 })
    retry_count: number;

    @Column({ type: 'text', nullable: true })
    error_message: string | null;

    @Column({ type: 'timestamp', nullable: true })
    started_at: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date | null;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
