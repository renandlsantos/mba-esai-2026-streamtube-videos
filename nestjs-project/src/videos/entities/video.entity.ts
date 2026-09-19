import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import type { VideoStatus } from '../video.constants';

@Entity('videos')
@Index(['status', 'enqueue_pending'])
export class Video {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) slug: string;
  @Column({ type: 'uuid' }) channel_id: string;
  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: VideoStatus;
  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  size_bytes: number;
  @Column({ type: 'varchar', length: 100 }) content_type: string;
  @Column({ type: 'text' }) object_key: string;
  @Column({ type: 'text', nullable: true }) thumbnail_key: string | null;
  @Column({ type: 'text', nullable: true }) upload_id: string | null;
  @Column({ type: 'double precision', nullable: true }) duration_seconds:
    | number
    | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: {
    width?: number;
    height?: number;
    codec?: string;
    format?: string;
  } | null;
  @Column({ type: 'text', nullable: true }) error_code: string | null;
  @Column({ default: false }) enqueue_pending: boolean;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
