import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ControllersModule } from './controllers/controllers.module';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { WsGatewaysModule } from './ws-gateways/ws-gateways.module';
import { CacheModule } from '@nestjs/cache-manager';
import { User } from './services/user/user.entity';
import { AlarmRule } from './services/alarm-rule/alarm-rule.entity';
import { MapConfig } from './services/map-config/map-config.entity';
import { Camera } from './services/camera/camera.entity';
import { AlarmEvent } from './services/alarm-event/alarm-event.entity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: 'server.config.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        database: configService.get('MYSQL_DATABASE'),
        host: configService.get('MYSQL_HOST'),
        port: +configService.get('MYSQL_PORT'),
        username: configService.get('MYSQL_USER'),
        password: configService.get('MYSQL_PASSWORD'),
        synchronize: configService.get('NODE_ENV') !== 'production',
        autoLoadEntities: true,
        logging: configService.get('NODE_ENV') !== 'production',
        // Database connection pool configuration
        extra: {
          connectionLimit: 10,
          connectTimeout: 30000,
        },
      }),
    }),
    TypeOrmModule.forFeature([User, AlarmRule, MapConfig]),
    CacheModule.register({ isGlobal: true, ttl: 86400000, max: 100 }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: configService.get('PUBLIC_DIR_ABSOLUTE_PATH'),
          serveRoot: '/public',
        },
      ],
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
    }),
    ControllersModule,
    WsGatewaysModule,
  ],
})
export class AppModule {
  async onModuleInit() {
    await this.initDefaultData();
  }

  private async initDefaultData() {
    try {
      const { DataSource } = require('typeorm');
      const hmacKey = process.env.HMAC_KEY || 'campus-surveillance-system';

      const hmacSha256 = (text: string): string => {
        return crypto.createHmac('sha256', hmacKey).update(text).digest('base64');
      };

      const dataSource = new DataSource({
        type: 'mysql',
        database: process.env.MYSQL_DATABASE || 'campus-surveillance-system',
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        username: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'root',
        entities: [User, AlarmRule, MapConfig, Camera, AlarmEvent],
        synchronize: process.env.NODE_ENV !== 'production',
        extra: {
          connectionLimit: 10,
          connectTimeout: 30000,
        },
      });

      await dataSource.initialize();

      // Reset all cameras to offline on startup (ai-end will reconnect)
      await dataSource.createQueryBuilder()
        .update(Camera)
        .set({ online: false })
        .execute();
      console.log('[Init] Reset all cameras to offline status');

      const adminExists = await dataSource.getRepository(User).findOne({
        where: { username: 'admin' }
      });

      if (!adminExists) {
        const hmacResult = hmacSha256('admin');
        const hashedPassword = await bcrypt.hash(hmacResult, 10);
        await dataSource.getRepository(User).save({
          username: 'admin',
          nickname: 'Administrator',
          role: 'admin',
          password: hashedPassword,
        });
        console.log('[Init] Default admin created: admin / admin');
      }

      const rulesCount = await dataSource.getRepository(AlarmRule).count();
      if (rulesCount === 0) {
        await dataSource.getRepository(AlarmRule).save([
          { name: 'Body Detection', enabled: true, algorithmType: 'body', triggerDayOfWeek: [1,2,3,4,5,6,7], triggerTimeStart: '00:00', triggerTimeEnd: '23:59', triggerCountMin: 1, triggerCountMax: 100 },
          { name: 'Vehicle Detection', enabled: true, algorithmType: 'vehicle', triggerDayOfWeek: [1,2,3,4,5,6,7], triggerTimeStart: '00:00', triggerTimeEnd: '23:59', triggerCountMin: 1, triggerCountMax: 100 },
        ]);
        console.log('[Init] Default alarm rules created');
      }

      const mapCount = await dataSource.getRepository(MapConfig).count();
      if (mapCount === 0) {
        await dataSource.getRepository(MapConfig).save({
          layerType: 'tileLayer',
          layerUrlOrPath: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          mapCenter: [117.060, 36.195],
          mapZoom: 18,
          minZoom: 0,
          maxZoom: 18,
        });
        console.log('[Init] Default map config created');
      }

      await dataSource.destroy();
      console.log('[Init] Database initialization complete');
    } catch (error) {
      console.error('[Init] Init failed:', error.message);
      throw error; // Propagate error instead of just logging
    }
  }
}