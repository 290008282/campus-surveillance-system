import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AlarmEvent } from '../alarm-event/alarm-event.entity';
import { AlarmRule } from '../alarm-rule/alarm-rule.entity';

@Entity()
export class Camera {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column()
  name: string;

  @Column({ name: 'status', type: 'bool', default: false })
  online: boolean;

  @Column({ name: 'code' })
  code: string;

  @Column({ name: 'rtsp_url', default: '' })
  rtspUrl: string;

  @Column({ name: 'map_latitude', type: 'double' })
  latitude: number;

  @Column({ name: 'map_longitude', type: 'double' })
  longitude: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @OneToMany(() => AlarmEvent, (alarmEvent) => alarmEvent.sourceCamera)
  @JoinColumn()
  alarmEvents?: AlarmEvent[];

  @ManyToMany(() => AlarmRule, (alarmRule) => alarmRule.relatedCameras)
  alarmRules?: AlarmRule[];
}
