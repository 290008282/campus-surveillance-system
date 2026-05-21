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
import * as bcrypt from 'bcryptjs';

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
        synchronize: true,
        autoLoadEntities: true,
        timezone: 'Z',
      }),
    }),
    TypeOrmModule.forFeature([User, AlarmRule, MapConfig]),
    CacheModule.register({ isGlobal: true, ttl: 0, max: 0 }),
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
  /**
   * Initialize default data on application startup
   */
  async onModuleInit() {
    await this.initDefaultData();
  }

  private async initDefaultData() {
    try {
      const { DataSource } = require('typeorm');
      const dataSource = new DataSource({
        type: 'mysql',
        database: process.env.MYSQL_DATABASE || 'campus-surveillance-system',
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        username: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'root',
        entities: [User, AlarmRule, MapConfig],
        synchronize: true,
      });

      await dataSource.initialize();
      
      const adminExists = await dataSource.getRepository(User).findOne({
        where: { username: 'admin' }
      });

      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin', 10);
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
          { name: 'Face Detection', description: 'Detect faces in camera', model_class: 'person', confidence_threshold: 0.6, enabled: true },
          { name: 'Vehicle Detection', description: 'Detect vehicles', model_class: 'car', confidence_threshold: 0.5, enabled: true },
          { name: 'Anomaly Detection', description: 'Detect abnormal behavior', model_class: 'anomaly', confidence_threshold: 0.7, enabled: true },
        ]);
        console.log('[Init] Default alarm rules created');
      }

      const mapCount = await dataSource.getRepository(MapConfig).count();
      if (mapCount === 0) {
        await dataSource.getRepository(MapConfig).save({
          name: 'Default Map',
          map_type: 'tile',
          center_longitude: 117.060,
          center_latitude: 36.195,
          zoom: 18,
          config_json: JSON.stringify({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y.png}' }),
        });
        console.log('[Init] Default map config created');
      }

      await dataSource.destroy();
      console.log('[Init] Database initialization complete');
    } catch (error) {
      console.error('[Init] Init failed:', error.message);
    }
  }
}