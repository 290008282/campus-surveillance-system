import { Inject, Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private configService: ConfigService,
  ) {}

  private getHmacKey(): string {
    return this.configService.get<string>('HMAC_KEY', 'campus-surveillance-system');
  }

  private hmacSha256(text: string): string {
    return crypto.createHmac('sha256', this.getHmacKey()).update(text).digest('base64');
  }

  async getUserList(): Promise<User[]> {
    return await this.userRepo.find({
      select: { password: false },
    });
  }

  async authLogin(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) return null;

    // Unified bcrypt validation for all password formats
    try {
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) return user;
    } catch (error) {
      console.error('Password comparison error:', error);
    }

    return null;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    if (!userData.password) throw new Error('Password required');
    const hmacResult = this.hmacSha256(userData.password);
    const hashedPassword = await bcrypt.hash(hmacResult, 10);
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
    if (user.password && !user.password.startsWith('$2')) {
      const hmacResult = this.hmacSha256(user.password);
      user.password = await bcrypt.hash(hmacResult, 10);
    }
    await this.userRepo.update({ username: user.username }, user);
  }

  async addUser(user: Partial<User>) {
    if (user.password && !user.password.startsWith('$2')) {
      const hmacResult = this.hmacSha256(user.password);
      user.password = await bcrypt.hash(hmacResult, 10);
    }
    return await this.userRepo.save(user);
  }

  async deleteUser(username: string) {
    await this.userRepo.softDelete({ username });
    await this.cache.del(username);
  }

  getJwtService(): JwtService {
    return this.jwtService;
  }

  async getCachedToken(username: string): Promise<string | undefined> {
    return await this.cache.get(username);
  }
}