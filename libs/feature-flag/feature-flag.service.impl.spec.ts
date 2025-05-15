import { Cache } from 'cache-manager';
import {
  FeatureFlagServiceImpl,
  IDataFeatureFlag,
} from './feature-flag.service.impl';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { load } from './feature-flag.module';
import {
  FeatureFlagService,
  IContextFeatureFlag,
} from './feature-flag.service';
import * as process from 'node:process';

global.fetch = jest.fn();

type FeatureFlagPrivate = FeatureFlagService & {
  generateCacheKey(flag: string, ctx: IContextFeatureFlag): string;
  getFlag(
    ctx: IContextFeatureFlag,
    flag: string,
    defaultValue?: boolean,
  ): Promise<IDataFeatureFlag>;
  cacheTtlMs: number;
  coreUrl: string;
};

describe('FeatureFlagServiceImpl', () => {
  let service: FeatureFlagServiceImpl;
  let cacheManager: Cache;
  let mockFetch: jest.Mock;
  const defaultContext: IContextFeatureFlag = {
    userID: 'user123',
    organization_id: 456,
  };
  const defaultFlagName = 'isAwesomeFeatureEnabled';
  const defaultApiUrl = 'http://localhost:7750/v1/feature-flag/dso';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({
          load: [load({})],
        }),
      ],
      providers: [
        FeatureFlagServiceImpl,
        {
          // Provide a mock for the CACHE_MANAGER
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagServiceImpl>(FeatureFlagServiceImpl);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(cacheManager).toBeDefined();
  });

  describe('generateCacheKey', () => {
    it('should generate a consistent cache key based on flag and context', () => {
      const key1 = (service as unknown as FeatureFlagPrivate).generateCacheKey(
        defaultFlagName,
        defaultContext,
      );
      const key2 = (service as unknown as FeatureFlagPrivate).generateCacheKey(
        defaultFlagName,
        defaultContext,
      );
      const differentContext = { userID: 'user456', organization_id: 789 };
      process.env.SECRET_KEY_HEIMDALL = 'another';
      const key3 = (service as unknown as FeatureFlagPrivate).generateCacheKey(
        defaultFlagName,
        differentContext,
      );
      const differentFlag = 'anotherFlag';
      const key4 = (service as unknown as FeatureFlagPrivate).generateCacheKey(
        differentFlag,
        defaultContext,
      );

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
      expect(key1).toMatch(/^feature-flag:/);
      process.env.SECRET_KEY_HEIMDALL = undefined;
    });
  });

  describe('getFlag (private method tested via getStatusFlag)', () => {
    const mockApiResponse: IDataFeatureFlag = {
      flag: {
        name: defaultFlagName,
        value: true,
      },
      last_fetched_time: new Date().toISOString(),
    };
    const mockCachedData = JSON.stringify(mockApiResponse);

    it('should fetch from API if cache is empty and return flag value', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockApiResponse }),
        text: () => Promise.resolve(JSON.stringify({ data: mockApiResponse })),
      });

      const status = await (
        service as unknown as FeatureFlagPrivate
      ).getStatusFlag(defaultContext, defaultFlagName);

      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(cacheManager.get).toHaveBeenCalledWith(
        (service as unknown as FeatureFlagPrivate).generateCacheKey(
          defaultFlagName,
          defaultContext,
        ),
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(defaultApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          context: defaultContext,
          flag_name: defaultFlagName,
          default_value: true,
        }),
      });
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith(
        (service as unknown as FeatureFlagPrivate).generateCacheKey(
          defaultFlagName,
          defaultContext,
        ),
        mockCachedData,
        (service as unknown as FeatureFlagPrivate).cacheTtlMs,
      );
      expect(status).toBe(true);
    });

    it('should return value from cache if cache exists', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(mockCachedData);

      const status = await (
        service as unknown as FeatureFlagPrivate
      ).getStatusFlag(defaultContext, defaultFlagName);

      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(cacheManager.get).toHaveBeenCalledWith(
        (service as unknown as FeatureFlagPrivate).generateCacheKey(
          defaultFlagName,
          defaultContext,
        ),
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(cacheManager.set).not.toHaveBeenCalled();
      expect(status).toBe(true);
    });

    it('should return value from cache if cache exists with not default value', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(mockCachedData);
      const result = await (service as unknown as FeatureFlagPrivate).getFlag(
        defaultContext,
        'anotherFlag',
      );
      expect(result.flag.value).toBe(true);
    });

    it('should fetch from API with provided defaultValue', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      const apiResponseFalse: IDataFeatureFlag = {
        flag: { name: defaultFlagName, value: false },
        last_fetched_time: new Date().toISOString(),
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: apiResponseFalse }),
        text: () => Promise.resolve(JSON.stringify({ data: apiResponseFalse })),
      });

      const status = await (
        service as unknown as FeatureFlagPrivate
      ).getStatusFlag(defaultContext, defaultFlagName, false);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        defaultApiUrl,
        expect.objectContaining({
          body: JSON.stringify({
            context: defaultContext,
            flag_name: defaultFlagName,
            default_value: false,
          }),
        }),
      );
      expect(status).toBe(false);
    });

    it('should throw an error if API response is not ok', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      const errorStatus = 500;
      const errorBody = 'Internal Server Error';
      mockFetch.mockResolvedValue({
        ok: false,
        status: errorStatus,
        text: () => Promise.resolve(errorBody),
        json: () => Promise.reject(new Error('Should not call json on error')),
      });

      await expect(
        (service as unknown as FeatureFlagPrivate).getStatusFlag(
          defaultContext,
          defaultFlagName,
        ),
      ).rejects.toThrow(
        `Failed to fetch feature flag "${defaultFlagName}". API responded with status ${errorStatus}.`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should throw an error if API response has unexpected structure (missing data)', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ someOtherKey: 'value' }),
        text: () => Promise.resolve(JSON.stringify({ someOtherKey: 'value' })),
      });

      await expect(
        (service as unknown as FeatureFlagPrivate).getStatusFlag(
          defaultContext,
          defaultFlagName,
        ),
      ).rejects.toThrow(
        `Unexpected API response structure for feature flag "${defaultFlagName}".`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should throw an error if API response has unexpected structure (missing flag value)', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { flag: { name: defaultFlagName, value: 'not_boolean' } },
          }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: { flag: { name: defaultFlagName, value: 'not_boolean' } },
            }),
          ),
      });

      await expect(
        (service as unknown as FeatureFlagPrivate).getStatusFlag(
          defaultContext,
          defaultFlagName,
        ),
      ).rejects.toThrow(
        `Unexpected API response structure for feature flag "${defaultFlagName}".`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should throw an error if fetch fails (network error, etc.)', async () => {
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        (service as unknown as FeatureFlagPrivate).getStatusFlag(
          defaultContext,
          defaultFlagName,
        ),
      ).rejects.toThrow(networkError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('getStatusFlag', () => {
    it('should return the boolean value from getFlag result', async () => {
      const getFlagSpy = jest.spyOn(service, 'getFlag' as any);

      const mockFlagData: IDataFeatureFlag = {
        flag: { name: defaultFlagName, value: true },
        last_fetched_time: new Date().toISOString(),
      };
      getFlagSpy.mockResolvedValue(mockFlagData as never);

      const status = await (
        service as unknown as FeatureFlagPrivate
      ).getStatusFlag(defaultContext, defaultFlagName);

      expect(getFlagSpy).toHaveBeenCalledWith(
        defaultContext,
        defaultFlagName,
        true,
      );
      expect(status).toBe(true);

      getFlagSpy.mockRestore();
    });
  });

  describe('cbStatusFlag', () => {
    let mockCallback: jest.Mock;
    let getStatusFlagSpy: jest.SpyInstance;

    beforeEach(() => {
      mockCallback = jest.fn();
      getStatusFlagSpy = jest.spyOn(service, 'getStatusFlag');
    });

    afterEach(() => {
      getStatusFlagSpy.mockRestore();
    });

    it('should call the callback with true if getStatusFlag returns true', async () => {
      getStatusFlagSpy.mockResolvedValue(true);

      await (service as unknown as FeatureFlagPrivate).cbStatusFlag(
        mockCallback,
        defaultContext,
        defaultFlagName,
      );

      expect(getStatusFlagSpy).toHaveBeenCalledTimes(1);
      expect(getStatusFlagSpy).toHaveBeenCalledWith(
        defaultContext,
        defaultFlagName,
        true,
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(true);
    });

    it('should call the callback with false if getStatusFlag returns false', async () => {
      getStatusFlagSpy.mockResolvedValue(false);

      await (service as unknown as FeatureFlagPrivate).cbStatusFlag(
        mockCallback,
        defaultContext,
        defaultFlagName,
      );

      expect(getStatusFlagSpy).toHaveBeenCalledTimes(1);
      expect(getStatusFlagSpy).toHaveBeenCalledWith(
        defaultContext,
        defaultFlagName,
        true,
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(false);
    });

    it('should await the callback if it is async', async () => {
      const asyncMockCallback = jest
        .fn()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockImplementation(async (_status: boolean) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      getStatusFlagSpy.mockResolvedValue(true);

      await (service as unknown as FeatureFlagPrivate).cbStatusFlag(
        asyncMockCallback,
        defaultContext,
        defaultFlagName,
      );

      expect(getStatusFlagSpy).toHaveBeenCalledTimes(1);
      expect(getStatusFlagSpy).toHaveBeenCalledWith(
        defaultContext,
        defaultFlagName,
        true,
      );
      expect(asyncMockCallback).toHaveBeenCalledTimes(1);
      expect(asyncMockCallback).toHaveBeenCalledWith(true);
    });

    it('should pass defaultValue to getStatusFlag when calling cbStatusFlag', async () => {
      getStatusFlagSpy.mockResolvedValue(false);

      await (service as unknown as FeatureFlagPrivate).cbStatusFlag(
        mockCallback,
        defaultContext,
        defaultFlagName,
        false,
      );

      expect(getStatusFlagSpy).toHaveBeenCalledTimes(1);
      expect(getStatusFlagSpy).toHaveBeenCalledWith(
        defaultContext,
        defaultFlagName,
        false,
      );
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(false);
    });
  });
});
