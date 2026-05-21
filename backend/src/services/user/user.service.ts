import { Inject, Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as bcrypt from 'bcryptjs';

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

  async authLogin(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) return null;

    // bcrypt verification
    if (user.password.startsWith('$')) {
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValid) return user;
    }

    // Plain text comparison
    if (user.password === password) {
      return user;
    }

    // Base64 encoded password (frontend sends Base64)
    const encodedPwd = Buffer.from(password).toString('base64');
    if (user.password === encodedPwd) {
      return user;
    }

    return null;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    if (!userData.password) throw new Error('Password required');
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
    if (user.password && !user.password.startsWith('$2')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    await this.userRepo.update({ username: user.username }, user);
  }

  async addUser(user: Partial<User>) {
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