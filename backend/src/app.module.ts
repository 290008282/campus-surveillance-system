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
        // 寮€鍙戠幆澧冨紑鍚紝鐢熶骇鐜寤鸿鍏抽棴
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
   * 搴旂敤鍚姩鍚庡垵濮嬪寲榛樿鏁版嵁
   * 鑷姩鍒涘缓绠＄悊鍛樿处鍙峰拰榛樿閰嶇疆
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
      
      // 妫€鏌ユ槸鍚﹀凡鏈夌鐞嗗憳璐﹀彿
      const adminExists = await dataSource.getRepository(User).findOne({
        where: { username: 'admin' }
      });

      if (!adminExists) {
        // 鍒涘缓榛樿绠＄悊鍛樿处鍙?(瀵嗙爜: admin)
        const hashedPassword = await bcrypt.hash('admin', 10);
        await dataSource.getRepository(User).save({
          username: 'admin',
          nickname: '绠＄悊鍛?,
          role: 'admin',
          password: hashedPassword,
        });
        console.log('[Init] 榛樿绠＄悊鍛樿处鍙峰凡鍒涘缓: admin / admin');
      }

      // 妫€鏌ユ槸鍚﹀凡鏈夐粯璁ゆ姤璀﹁鍒?      const rulesCount = await dataSource.getRepository(AlarmRule).count();
      if (rulesCount === 0) {
        await dataSource.getRepository(AlarmRule).save([
          { name: '浜鸿劯妫€娴?, description: '妫€娴嬫憚鍍忓ご鐢婚潰涓嚭鐜扮殑浜鸿劯', model_class: 'person', confidence_threshold: 0.6, enabled: true },
          { name: '杞﹁締妫€娴?, description: '妫€娴嬫憚鍍忓ご鐢婚潰涓嚭鐜扮殑杞﹁締', model_class: 'car', confidence_threshold: 0.5, enabled: true },
          { name: '寮傚父琛屼负妫€娴?, description: '妫€娴嬪紓甯歌涓?, model_class: '寮傚父琛屼负', confidence_threshold: 0.7, enabled: true },
        ]);
        console.log('[Init] 榛樿鎶ヨ瑙勫垯宸插垱寤?);
      }

      // 妫€鏌ユ槸鍚﹀凡鏈夐粯璁ゅ湴鍥鹃厤缃?      const mapCount = await dataSource.getRepository(MapConfig).count();
      if (mapCount === 0) {
        await dataSource.getRepository(MapConfig).save({
          name: '榛樿鍦板浘',
          map_type: 'tile',
          center_longitude: 117.060,
          center_latitude: 36.195,
          zoom: 18,
          config_json: JSON.stringify({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y.png}' }),
        });
        console.log('[Init] 榛樿鍦板浘閰嶇疆宸插垱寤?);
      }

      await dataSource.destroy();
      console.log('[Init] 鏁版嵁搴撳垵濮嬪寲瀹屾垚');
    } catch (error) {
      console.error('[Init] 鍒濆鍖栧け璐?', error.message);
    }
  }
}