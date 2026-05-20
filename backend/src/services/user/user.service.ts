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
   * 鐢ㄦ埛鐧诲綍楠岃瘉
   * 鏀寔涓ょ鏂瑰紡:
   * 1. 瀵嗙爜鍝堝笇楠岃瘉 (bcrypt) - 鏂版敞鍐岀敤鎴?   * 2. 鏄庢枃瀵嗙爜楠岃瘉 - 鍏煎鏃ф暟鎹?   */
  async authLogin(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) return null;

    // 鍏堝皾璇?bcrypt 楠岃瘉 (鏂板瘑鐮佹牸寮?
    if (user.password.startsWith('$2') || user.password.startsWith('$')) {
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValid) return user;
    }

    // 鍏煎鏃ф暟鎹? 鐩存帴姣斿鏄庢枃瀵嗙爜
    // 娉ㄦ剰: 鐢熶骇鐜寮虹儓寤鸿浣跨敤鍝堝笇瀵嗙爜
    if (user.password === password) {
      return user;
    }

    return null;
  }

  /**
   * 鍒涘缓鐢ㄦ埛 (瀵嗙爜鑷姩鍝堝笇)
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
    
    // 濡傛灉鏇存柊浜嗗瘑鐮侊紝闇€瑕佸搱甯?    if (user.password && !user.password.startsWith('$2')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    
    await this.userRepo.update({ username: user.username }, user);
  }

  async addUser(user: Partial<User>) {
    // 瀵嗙爜鑷姩鍝堝笇
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