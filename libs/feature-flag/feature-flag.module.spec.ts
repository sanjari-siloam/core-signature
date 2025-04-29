import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

jest.mock('@nestjs/cache-manager', () => ({
  CacheModule: {
    register: jest.fn((options) => ({
      module: 'MockCacheModule',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      options: options,
    })),
  },
}));

jest.mock('@nestjs/config', () => ({
  ConfigModule: {
    forRoot: jest.fn((options) => ({
      module: 'MockConfigModule',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      options: options,
    })),
  },
}));

jest.mock('cache-manager-redis-store', () => ({
  redisStore: jest.fn(() => 'mockRedisStoreInstance'),
}));

import {
  FeatureFlagModule,
  load,
  IFeatureFlagOption,
} from './feature-flag.module';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagServiceImpl } from './feature-flag.service.impl';

describe('FeatureFlagModule', () => {
  describe('load function', () => {
    const originalCoreUrlEnv = process.env.CORE_URL;

    beforeEach(() => {
      jest.resetModules();
      process.env.CORE_URL = 'https://default-env-core-url.com';
    });

    afterEach(() => {
      process.env.CORE_URL = originalCoreUrlEnv;
    });

    it('should return a function', () => {
      const loader = load({});
      expect(typeof loader).toBe('function');
    });

    it('should load ttl from options when the returned function is called', () => {
      const options: IFeatureFlagOption = { ttl: 300 };
      const loaderFunction = load(options);
      const config = loaderFunction();
      expect(config).toHaveProperty('ttl', 300);
    });

    it('should load coreUrl from options if provided', () => {
      const options: IFeatureFlagOption = {
        coreUrl: 'http://options-core-url.com',
      };
      const loaderFunction = load(options);
      const config = loaderFunction();
      expect(config).toHaveProperty('coreUrl', 'http://options-core-url.com');
    });

    it('should load coreUrl from process.env if not provided in options', () => {
      const options: IFeatureFlagOption = {};
      const loaderFunction = load(options);
      const config = loaderFunction();
      expect(config).toHaveProperty('coreUrl', process.env.CORE_URL);
    });

    it('should load undefined ttl if not provided in options', () => {
      const options: IFeatureFlagOption = { coreUrl: 'any-url' };
      const loaderFunction = load(options);
      const config = loaderFunction();
      expect(config).toHaveProperty('ttl', undefined);
    });

    it('should handle empty options object correctly', () => {
      const options: IFeatureFlagOption = {};
      const loaderFunction = load(options);
      const config = loaderFunction();
      expect(config).toEqual({
        ttl: undefined,
        coreUrl: process.env.CORE_URL,
      });
    });
  });

  describe('forRoot method', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const mockCacheModuleRegister = CacheModule.register as jest.Mock;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const mockConfigModuleForRoot = ConfigModule.forRoot as jest.Mock;
    const mockRedisStore = redisStore as jest.Mock;

    beforeEach(() => {
      mockCacheModuleRegister.mockClear();
      mockConfigModuleForRoot.mockClear();
      mockRedisStore.mockClear();
    });

    it('should return a DynamicModule', () => {
      const options: IFeatureFlagOption = {};
      const dynamicModule = FeatureFlagModule.forRoot(options);

      expect(dynamicModule).toBeDefined();
      expect(dynamicModule).toHaveProperty('module', FeatureFlagModule);
      expect(dynamicModule).toHaveProperty('imports');
      expect(Array.isArray(dynamicModule.imports)).toBe(true);
      expect(dynamicModule).toHaveProperty('providers');
      expect(Array.isArray(dynamicModule.providers)).toBe(true);
      expect(dynamicModule).toHaveProperty('exports');
      expect(Array.isArray(dynamicModule.exports)).toBe(true);
    });

    it('should include ConfigModule.forRoot in imports', () => {
      const options: IFeatureFlagOption = {
        ttl: 500,
        coreUrl: 'http://some-url',
      };
      const dynamicModule = FeatureFlagModule.forRoot(options);

      expect(mockConfigModuleForRoot).toHaveBeenCalledTimes(1);
      expect(dynamicModule.imports).toContainEqual(
        mockConfigModuleForRoot.mock.results[0].value,
      );
    });

    it('should include CacheModule.register in imports with provided options', () => {
      const options: IFeatureFlagOption = {
        host: 'my-redis-host',
        port: 1122,
        ttl: 600,
        coreUrl: 'any-url',
      };
      const dynamicModule = FeatureFlagModule.forRoot(options);

      expect(mockCacheModuleRegister).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const cacheOptionsPassed = mockCacheModuleRegister.mock.calls[0][0];

      expect(cacheOptionsPassed).toEqual({
        store: mockRedisStore,
        host: 'my-redis-host',
        port: 1122,
      });

      expect(dynamicModule.imports).toContainEqual(
        mockCacheModuleRegister.mock.results[0].value,
      );
    });

    it('should have empty providers and exports arrays', () => {
      const options: IFeatureFlagOption = {};
      const dynamicModule = FeatureFlagModule.forRoot(options);

      expect(dynamicModule.providers).toEqual([
        {
          provide: FeatureFlagService,
          useClass: FeatureFlagServiceImpl,
        },
      ]);
      expect(dynamicModule.exports).toEqual([FeatureFlagService]);
    });
  });
});
