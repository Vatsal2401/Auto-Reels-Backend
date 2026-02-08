import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('credit_plans')
export class CreditPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string; // Starter, Creator, Influencer, Enterprise

  @Column({ type: 'integer' })
  credits: number;

  @Column({ type: 'integer' })
  price_inr: number; // in paise

  @Column({ type: 'integer' })
  price_usd: number; // in cents

  @Column({ type: 'varchar', length: 50, nullable: true })
  tag: string | null; // e.g., "Most Popular"

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
