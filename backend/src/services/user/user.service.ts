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

    // If stored password starts with $, it's bcrypt hashed
    if (user.password.startsWith('$')) {
      // Try bcrypt comparison with plaintext password
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValid) return user;
      
      // Try bcrypt comparison with decoded Base64 password
      try {
        const decoded = Buffer.from(password, 'base64').toString('utf8');
        const isValidDecoded = await bcrypt.compare(decoded, user.password).catch(() => false);
        if (isValidDecoded) return user;
      } catch {}
    }

    // Plain text comparison (both plaintext and Base64)
    if (user.password === password) {
      return user;
    }
    
    // Try decoded Base64 password
    try {
      const decoded = Buffer.from(password, 'base64').toString('utf8');
      if (user.password === decoded) {
        return user;
      }
    } catch {}

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