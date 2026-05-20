import { Inject, Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getUserList(): Promise<User[]> {
    return await this.userRepo.find({
      select: { password: false },
    });
  }

  /**
   * 用户登录验证
   * 支持两种方式:
   * 1. 密码哈希验证 (bcrypt) - 新注册用户
   * 2. 明文密码验证 - 兼容旧数据
   */
  async authLogin(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) return null;

    // 先尝试 bcrypt 验证 (新密码格式)
    if (user.password.startsWith('$2') || user.password.startsWith('$')) {
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValid) return user;
    }

    // 兼容旧数据: 直接比对明文密码
    // 注意: 生产环境强烈建议使用哈希密码
    if (user.password === password) {
      return user;
    }

    return null;
  }

  /**
   * 创建用户 (密码自动哈希)
   */
  async createUser(userData: Partial<User>): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    return await this.userRepo.save({
      ...userData,
      password: hashedPassword,
    });
  }

  async genToken(user: User): Promise<string> {
    const token = await this.jwtService.signAsync({ ...user });
    await this.cache.set(user.username, token);
    return 'Bearer ' + token;
  }

  async getByUsername(username: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { username } });
  }

  async updateUser(user: Partial<User>) {
    if (!user.username) return;
    
    // 如果更新了密码，需要哈希
    if (user.password && !user.password.startsWith('$2')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    
    await this.userRepo.update({ username: user.username }, user);
  }

  async addUser(user: Partial<User>) {
    // 密码自动哈希
    if (user.password && !user.password.startsWith('$2')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    return await this.userRepo.save(user);
  }

  async deleteUser(username: string) {
    await this.userRepo.softDelete({ username });
    await this.cache.del(username);
  }
}