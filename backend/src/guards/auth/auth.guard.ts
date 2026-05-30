import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import assert from 'assert';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { User } from 'src/services/user/user.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }
    try {
      const payload = await this.jwtService.verifyAsync<User>(token);

      // Check if token is revoked/invalidated
      const cachedToken = await this.cache.get<string>(payload.username);
      if (!cachedToken || cachedToken !== token) {
        throw new UnauthorizedException('Token has been revoked or is invalid');
      }

      // Attach user info to request
      request['user'] = payload;
      return true;
    } catch (error) {
      console.error('Token validation error:', error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
