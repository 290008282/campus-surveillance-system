import { Inject, Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const HMAC_KEY = 'campus-surveillance-system';

function hmacSha256(text: string): string {
  return crypto.createHmac('sha256', HMAC_KEY).update(text).digest('base64');
}

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

    // If stored password is bcrypt hashed
    if (user.password.startsWith('$')) {
      // Frontend sends HMAC-SHA256(password, key) as Base64, try direct compare
      const isValid = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValid) return user;

      // Fallback: password might be plaintext, compute HMAC and compare
      const hmacResult = hmacSha256(password);
      const isValidHmac = await bcrypt.compare(hmacResult, user.password).catch(() => false);
      if (isValidHmac) return user;

      // Fallback: try plaintext with bcrypt
      const isValidPlain = await bcrypt.compare(password, user.password).catch(() => false);
      if (isValidPlain) return user;
    }

    // Plain text comparison
    if (user.password === password) return user;
    if (user.password === hmacSha256(password)) return user;

    return null;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    if (!userData.password) throw new Error('Password required');
    const hmacResult = hmacSha256(userData.password);
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
      const hmacResult = hmacSha256(user.password);
      user.password = await bcrypt.hash(hmacResult, 10);
    }
    await this.userRepo.update({ username: user.username }, user);
  }

  async addUser(user: Partial<User>) {
    if (user.password && !user.password.startsWith('$2')) {
      const hmacResult = hmacSha256(user.password);
      user.password = await bcrypt.hash(hmacResult, 10);
    }
    return await this.userRepo.save(user);
  }

  async deleteUser(username: string) {
    await this.userRepo.softDelete({ username });
    await this.cache.del(username);
  }
}