import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('admin_impersonation_logs')
export class AdminImpersonationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  admin_id: string;

  @Column()
  user_id: string;

  @Column({ nullable: true })
  ip_address: string | null;

  @CreateDateColumn()
  created_at: Date;
}
