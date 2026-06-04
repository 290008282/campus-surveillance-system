import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CameraService } from 'src/services/camera/camera.service';

import { UserService } from 'src/services/user/user.service';
import { UtilsService } from 'src/services/utils/utils.service';
import { FetchTypes } from 'src/types/fetchTypes';

@Controller()
export class CommonController {
  constructor(
    private readonly userService: UserService,
    private utilService: UtilsService,
    private cameraService: CameraService,
  ) {}

  @Post('/api/user/login')
  async userLogin(
    @Body() data: FetchTypes['POST /api/user/login']['req'],
  ): Promise<FetchTypes['POST /api/user/login']['res']['data']> {
    const user = await this.userService.authLogin(data.username, data.password);

    if (user) {
      return {
        token: await this.userService.genToken(user),
        userInfo: {
          username: user.username,
          role: user.role,
          nickname: user.nickname,
          tel: user.tel ?? '',
          email: user.email ?? '',
          avatarURL: user.avatarFilePath
            ? this.utilService.filePathToURL(user.avatarFilePath)
            : '',
        },
      };
    } else throw new ForbiddenException('用户名或密码错误');
  }

  @Get('/api/ai/getOfflineCameraList')
  async getOfflineCameraList(
    @Query() data: FetchTypes['GET /api/ai/getOfflineCameraList']['req'],
    @Headers('authorization') authHeader?: string,
  ): Promise<FetchTypes['GET /api/ai/getOfflineCameraList']['res']['data']> {
    const user = await this.authenticateAiRequest(
      authHeader,
      data.adminUsername,
      data.password,
    );
    if (!user || user.role !== 'admin') throw new UnauthorizedException();

    const list = await this.cameraService.getOfflineList();
    return list.map((camera) => ({
      cameraID: camera.id,
    }));
  }

  @Get('/api/ai/getAllCameraList')
  async getAllCameraList(
    @Query() data: FetchTypes['GET /api/ai/getAllCameraList']['req'],
    @Headers('authorization') authHeader?: string,
  ): Promise<FetchTypes['GET /api/ai/getAllCameraList']['res']['data']> {
    const user = await this.authenticateAiRequest(
      authHeader,
      data.adminUsername,
      data.password,
    );
    if (!user || user.role !== 'admin') throw new UnauthorizedException();

    const list = await this.cameraService.getList();
    return list.map((camera) => ({
      cameraID: camera.id,
    }));
  }

  /**
   * Authenticate AI request using JWT Bearer token or legacy HMAC password.
   * Tries JWT first, falls back to legacy username/password HMAC auth.
   */
  private async authenticateAiRequest(
    authHeader?: string,
    username?: string,
    password?: string,
  ) {
    // Try JWT Bearer token first (self-validating, no cache check needed)
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        try {
          const jwtService = this.userService.getJwtService();
          const payload = await jwtService.verifyAsync(token);
          // JWT is self-contained — verification succeeds = user is authenticated
          return payload;
        } catch {
          // JWT validation failed, fall through to legacy auth
        }
      }
    }

    // Fall back to legacy HMAC password auth
    if (username && password) {
      return await this.userService.authLogin(username, password);
    }

    return null;
  }
}
