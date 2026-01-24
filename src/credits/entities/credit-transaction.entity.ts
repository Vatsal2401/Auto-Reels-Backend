import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum TransactionType {
  PURCHASE = 'purchase',
  DEDUCTION = 'deduction',
  REFUND = 'refund',
  BONUS = 'bonus',
  EXPIRATION = 'expiration',
}

@Entity('credit_transactions')
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transaction_type: TransactionType;

  @Column({ type: 'integer' })
  amount: number; // positive for additions, negative for deductions

  @Column({ type: 'integer' })
  balance_after: number; // balance after this transaction

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  reference_id: string | null; // e.g., video_id for deductions, payment_id for purchases

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
