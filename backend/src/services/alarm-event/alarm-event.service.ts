import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AlarmEvent } from './alarm-event.entity';
import { FindManyOptions, In, Like, Repository } from 'typeorm';

@Injectable()
export class AlarmEventService {
  constructor(
    @InjectRepository(AlarmEvent)
    private alarmEventRepo: Repository<AlarmEvent>,
  ) {}

  async getList(
    withSourceCamera = false,
    withAlarmRule = false,
    current?: number,
    pageSize?: number,
    search?: {
      resolved?: boolean;
      cameraName?: string;
      alarmRuleName?: string;
      cameraID?: number;
    },
  ): Promise<{ total: number; list: AlarmEvent[] }> {
    // Validate pagination parameters
    const validatedCurrent = current && current > 0 ? current : 1;
    const validatedPageSize = pageSize && pageSize > 0 && pageSize <= 1000 ? pageSize : 20;

    const findOptions: FindManyOptions<AlarmEvent> = {
      relations: {
        sourceCamera: withSourceCamera,
        alarmRule: withAlarmRule,
      },
      skip: (validatedCurrent - 1) * validatedPageSize,
      take: validatedPageSize,
      where: {
        resolved: search?.resolved,
        sourceCamera: {
          name: search?.cameraName ? Like(`%${search.cameraName}%`) : undefined,
          id: search?.cameraID,
        },
        alarmRule: {
          name: search?.alarmRuleName
            ? Like(`%${search.alarmRuleName}%`)
            : undefined,
        },
      },
    };

    const total = await this.alarmEventRepo.count(findOptions);
    const list = await this.alarmEventRepo.find({
      ...findOptions,
      order: {
        id: 'DESC',
      },
    });

    return { total, list };
  }

  async getResolvedList() {
    return await this.alarmEventRepo.find({ where: { resolved: true } });
  }

  async getPenddingList() {
    return await this.alarmEventRepo.find({ where: { resolved: false } });
  }

  async getPendingCount() {
    return await this.alarmEventRepo.count({ where: { resolved: false } });
  }

  async resolve(id: number) {
    await this.alarmEventRepo.update({ id }, { resolved: true });
  }

  async resolveAll(ids?: number[]) {
    if (ids && ids.length > 0) {
      await this.alarmEventRepo.update({ id: In(ids) }, { resolved: true });
    } else {
      await this.alarmEventRepo.update({ resolved: false }, { resolved: true });
    }
  }

  async deleteByIds(ids: number[]) {
    if (ids.length > 0) {
      await this.alarmEventRepo.delete({ id: In(ids) });
    }
  }

  async addEvent(event: Partial<AlarmEvent>) {
    return await this.alarmEventRepo.save(event);
  }
}
