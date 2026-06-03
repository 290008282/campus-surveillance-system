import { Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketServer,
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, ServerOptions, Socket } from 'socket.io';
import { AlarmEventService } from 'src/services/alarm-event/alarm-event.service';
import { AlarmRule } from 'src/services/alarm-rule/alarm-rule.entity';
import { Camera } from 'src/services/camera/camera.entity';
import { CameraService } from 'src/services/camera/camera.service';
import { UserService } from 'src/services/user/user.service';
import { UtilsService } from 'src/services/utils/utils.service';

interface ClientInfo {
  username: string;
  password: string;
  cameraID: string;
}

interface AlarmData {
  picBase64: string;
  alarmRuleID: number;
}

interface CameraConfig {
  rtspUrl: string;
  alarmRules: AlarmRule[];
}

@WebSocketGateway<Partial<ServerOptions>>({
  path: '/ws/ai/',
  cors: {},
  serveClient: false,
})
export class AiEndGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  wsServer: Server;
  constructor(
    @Inject(forwardRef(() => CameraService))
    private cameraService: CameraService,
    @Inject(forwardRef(() => AlarmEventService))
    private alarmEventService: AlarmEventService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => UtilsService))
    private utilsService: UtilsService,
  ) {}

  connectedClients: Map<string, Socket> = new Map();

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() body: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('message received: ', body);
    client.emit('message', 'hello from server');
  }

  @SubscribeMessage('alarm')
  async handleAlarm(
    @MessageBody() body: AlarmData,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('alarm received: ');

    const { cameraID } = client.data as ClientInfo;
    const sourceCamera = new Camera();
    sourceCamera.id = parseInt(cameraID);
    const alarmRule = new AlarmRule();
    alarmRule.id = body.alarmRuleID;

    await this.alarmEventService.addEvent({
      sourceCamera,
      picFilePath: await this.utilsService.writeBase64ImageToFile(
        body.picBase64,
      ),
      alarmRule,
    });
  }

  async notifyCameraConfigChange(
    cameraID: number,
    cameraConfig?: CameraConfig,
  ) {
    const client = this.connectedClients.get(cameraID.toString());
    if (!cameraConfig) {
      const config = await this.cameraService.getById(cameraID, true);
      if (!config) return;
      cameraConfig = {
        alarmRules: config?.alarmRules ?? [],
        rtspUrl: config.rtspUrl,
      };
    }
    client?.emit('cameraConfigChange', cameraConfig);

    console.log(`notify ${cameraID} CameraConfigChange`);
  }

  async disconnectClient(cameraID: number) {
    this.connectedClients.get(cameraID.toString())?.disconnect();
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      if (typeof client.client.request.headers.data !== 'string') {
        client.disconnect();
        return;
      }
      const data: ClientInfo = JSON.parse(client.client.request.headers.data);

      // Validate token instead of username/password
      const token = this.extractTokenFromClient(client);
      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const user = await this.validateToken(token);
      if (!user || user.role !== 'admin') {
        console.log('WebSocket connection rejected: Invalid token or insufficient permissions');
        client.disconnect();
        return;
      }

      if (this.connectedClients.has(data.cameraID)) {
        this.connectedClients.get(data.cameraID)?.disconnect();
        this.connectedClients.delete(data.cameraID);
        await sleep(1000);
      }

      client.data = { ...data, user };

      const camera = await this.cameraService.getById(
        parseInt(data.cameraID),
        false,
        true,
      );
      if (!camera) {
        client.disconnect();
        return;
      }

      await this.cameraService.updateCamera({
        id: parseInt(data.cameraID),
        online: true,
      });

      this.connectedClients.set(data.cameraID, client);

      console.log(`client ${data.cameraID} connected`);

      await this.notifyCameraConfigChange(parseInt(data.cameraID));
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    const authHeader = client.client.request.headers.authorization as string;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private async validateToken(token: string): Promise<any> {
    try {
      const jwtService = this.userService.getJwtService();
      const payload = await jwtService.verifyAsync(token);

      // Check if token is revoked in cache
      const cachedToken = await this.userService.getCachedToken(payload.username);
      if (!cachedToken || cachedToken !== token) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    // Guard: client.data may be undefined if authentication failed before data was assigned
    const data = client.data as (ClientInfo & { user?: any }) | undefined;
    if (!data?.cameraID) {
      client.removeAllListeners();
      return;
    }

    this.connectedClients.delete(data.cameraID);
    client.removeAllListeners();

    await this.cameraService.updateCamera({
      id: parseInt(data.cameraID),
      online: false,
    });

    console.log(`client ${data.cameraID} disconnected`);
  }
}

const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, ms);
  });
};
