import { DynamicModule, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigModule } from '@nestjs/config';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagServiceImpl } from './feature-flag.service.impl';

export function load(options: IFeatureFlagOption) {
  return () => {
    return {
      ttl: options.ttl,
      coreUrl: options.coreUrl ?? process.env.CORE_URL,
    };
  };
}

export interface IFeatureFlagOption {
  ttl?: number;
  host?: string;
  port?: number;
  coreUrl?: string;
}

@Module({})
export class FeatureFlagModule {
  static forRoot(options: IFeatureFlagOption): DynamicModule {
    return {
      module: FeatureFlagModule,
      imports: [
        ConfigModule.forRoot({
          load: [load(options)],
        }),
        CacheModule.register({
          store: redisStore,
          host: options.host ?? 'localhost',
          port: options.port ?? 6379,
        }),
      ],
      providers: [
        {
          provide: FeatureFlagService,
          useClass: FeatureFlagServiceImpl,
        },
      ],
      exports: [FeatureFlagService],
    };
  }
}
