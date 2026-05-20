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
import * as bcrypt from 'bcrypt';

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
        // 开发环境开启，生产环境建议关闭
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
  constructor(
    private dataSource: any,
    private userRepo: typeof User.prototype.repository,
    private alarmRuleRepo: typeof AlarmRule.prototype.repository,
    private mapConfigRepo: typeof MapConfig.prototype.repository,
  ) {}

  /**
   * 应用启动后初始化默认数据
   * 自动创建管理员账号和默认配置
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
      
      // 检查是否已有管理员账号
      const adminExists = await dataSource.getRepository(User).findOne({
        where: { username: 'admin' }
      });

      if (!adminExists) {
        // 创建默认管理员账号 (密码: admin)
        const hashedPassword = await bcrypt.hash('admin', 10);
        await dataSource.getRepository(User).save({
          username: 'admin',
          nickname: '管理员',
          role: 'admin',
          password: hashedPassword,
        });
        console.log('[Init] 默认管理员账号已创建: admin / admin');
      }

      // 检查是否已有默认报警规则
      const rulesCount = await dataSource.getRepository(AlarmRule).count();
      if (rulesCount === 0) {
        await dataSource.getRepository(AlarmRule).save([
          { name: '人脸检测', description: '检测摄像头画面中出现的人脸', model_class: 'person', confidence_threshold: 0.6, enabled: true },
          { name: '车辆检测', description: '检测摄像头画面中出现的车辆', model_class: 'car', confidence_threshold: 0.5, enabled: true },
          { name: '异常行为检测', description: '检测异常行为', model_class: '异常行为', confidence_threshold: 0.7, enabled: true },
        ]);
        console.log('[Init] 默认报警规则已创建');
      }

      // 检查是否已有默认地图配置
      const mapCount = await dataSource.getRepository(MapConfig).count();
      if (mapCount === 0) {
        await dataSource.getRepository(MapConfig).save({
          name: '默认地图',
          map_type: 'tile',
          center_longitude: 117.060,
          center_latitude: 36.195,
          zoom: 18,
          config_json: JSON.stringify({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y.png}' }),
        });
        console.log('[Init] 默认地图配置已创建');
      }

      await dataSource.destroy();
      console.log('[Init] 数据库初始化完成');
    } catch (error) {
      console.error('[Init] 初始化失败:', error.message);
    }
  }
}