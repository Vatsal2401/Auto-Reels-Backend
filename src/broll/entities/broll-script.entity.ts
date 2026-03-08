import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrollMatchResult } from './broll-match-result.entity';

@Entity('broll_scripts')
export class BrollScript {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'library_id' })
  libraryId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 255, default: 'Untitled Script' })
  name: string;

  @Column({ name: 'script_text', type: 'text', default: '' })
  scriptText: string;

  @Column({ default: 1 })
  version: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'total_lines', default: 0 })
  totalLines: number;

  @Column({ name: 'matched_lines', default: 0 })
  matchedLines: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => BrollMatchResult, (r) => r.script, { cascade: ['remove'] })
  results: BrollMatchResult[];
}
