import Redis from 'ioredis';
import { FeatureFlag } from './feature-flag.classes';
import { IDataFeatureFlag } from './feature-flag.service.impl';
import { IContextFeatureFlag } from './feature-flag.service';
import * as process from 'node:process';

jest.mock('ioredis');
global.fetch = jest.fn();

describe('FeatureFlagClasses', () => {
  let featureFlag: FeatureFlag;
  const mockRedis: Redis = {
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as Redis;
  let mockFetch: jest.Mock;
  const defaultContext: IContextFeatureFlag = {
    userID: 'user123',
    organization_id: 456,
  };
  const defaultFlagName = 'isAwesomeFeatureEnabled';
  const defaultApiUrl = 'http://localhost:7750/v1/feature-flag/dso';

  beforeEach(() => {
    jest.clearAllMocks();

    featureFlag = new FeatureFlag(mockRedis);
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });

  it('should be redis instance same mockRedis', () => {
    expect(featureFlag['redis']).toBe(mockRedis);
  });

  describe('generateCacheKey', () => {
    it('should generate a consistent cache key based on flag and context', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const key1 = (featureFlag as any).generateCacheKey(
        defaultFlagName,
        defaultContext,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const key2 = (featureFlag as any).generateCacheKey(
        defaultFlagName,
        defaultContext,
      );
      const differentContext = { userID: 'user456', organizationId: 789 };
      process.env.SECRET_KEY_HEIMDALL = 'another';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const key3 = (featureFlag as any).generateCacheKey(
        defaultFlagName,
        differentContext,
      );
      const differentFlag = 'anotherFlag';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const key4 = (featureFlag as any).generateCacheKey(
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
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockApiResponse }),
        text: () => Promise.resolve(JSON.stringify({ data: mockApiResponse })),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const status = await (featureFlag as any).getStatusFlag(
        defaultContext,
        defaultFlagName,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.get).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).generateCacheKey(defaultFlagName, defaultContext),
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(defaultApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          context: {
            context: defaultContext,
            headers: {
              secret_key: 'undefined',
            },
          },
          flag_name: defaultFlagName,
          default_value: true,
        }),
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).generateCacheKey(defaultFlagName, defaultContext),
        mockCachedData,
        'EX',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (featureFlag as any).cacheTtlMs,
      );
      expect(status).toBe(true);
    });

    it('should return value from cache if cache exists', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(mockCachedData);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const status = await (featureFlag as any).getStatusFlag(
        defaultContext,
        defaultFlagName,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.get).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).generateCacheKey(defaultFlagName, defaultContext),
      );
      expect(mockFetch).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(status).toBe(true);
    });

    it('should return value from cache if cache exists with not default value', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(mockCachedData);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const result = await (featureFlag as any).getFlag(defaultContext);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.flag.value).toBe(true);
    });

    it('should fetch from API with provided defaultValue', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      const apiResponseFalse: IDataFeatureFlag = {
        flag: { name: defaultFlagName, value: false },
        last_fetched_time: new Date().toISOString(),
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: apiResponseFalse }),
        text: () => Promise.resolve(JSON.stringify({ data: apiResponseFalse })),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const status = await (featureFlag as any).getStatusFlag(
        defaultContext,
        defaultFlagName,
        false,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        defaultApiUrl,
        expect.objectContaining({
          body: JSON.stringify({
            context: {
              context: defaultContext,
              headers: {
                secret_key: 'undefined',
              },
            },
            flag_name: defaultFlagName,
            default_value: false,
          }),
        }),
      );
      expect(status).toBe(false);
    });

    it('should throw an error if API response is not ok', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      const errorStatus = 500;
      const errorBody = 'Internal Server Error';
      mockFetch.mockResolvedValue({
        ok: false,
        status: errorStatus,
        text: () => Promise.resolve(errorBody),
        json: () => Promise.reject(new Error('Should not call json on error')),
      });

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).getStatusFlag(defaultContext, defaultFlagName),
      ).rejects.toThrow(
        `API error fetching flag "${defaultFlagName}" for context ${JSON.stringify(defaultContext)}: Status ${500}, Body: Internal Server Error`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw an error if API response has unexpected structure (missing data)', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ someOtherKey: 'value' }),
        text: () => Promise.resolve(JSON.stringify({ someOtherKey: 'value' })),
      });

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).getStatusFlag(defaultContext, defaultFlagName),
      ).rejects.toThrow(
        `Unexpected API response structure for flag "${defaultFlagName}", context ${JSON.stringify(defaultContext)}: ${JSON.stringify({ someOtherKey: 'value' })}`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw an error if API response has unexpected structure (missing flag value)', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).getStatusFlag(defaultContext, defaultFlagName),
      ).rejects.toThrow(
        `Unexpected API response structure for flag "${defaultFlagName}", context ${JSON.stringify(defaultContext)}: ${JSON.stringify(
          {
            data: { flag: { name: defaultFlagName, value: 'not_boolean' } },
          },
        )}`,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw an error if fetch fails (network error, etc.)', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        (featureFlag as any).getStatusFlag(defaultContext, defaultFlagName),
      ).rejects.toThrow(networkError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('getStatusFlag', () => {
    it('should return the boolean value from getFlag result', async () => {
      const getFlagSpy = jest.spyOn(featureFlag, 'getFlag' as any);

      const mockFlagData: IDataFeatureFlag = {
        flag: { name: defaultFlagName, value: true },
        last_fetched_time: new Date().toISOString(),
      };
      getFlagSpy.mockResolvedValue(mockFlagData as never);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      const status = await (featureFlag as any).getStatusFlag(
        defaultContext,
        defaultFlagName,
      );

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
      getStatusFlagSpy = jest.spyOn(featureFlag, 'getStatusFlag');
    });

    afterEach(() => {
      getStatusFlagSpy.mockRestore();
    });

    it('should call the callback with true if getStatusFlag returns true', async () => {
      getStatusFlagSpy.mockResolvedValue(true);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await (featureFlag as any).cbStatusFlag(
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await (featureFlag as any).cbStatusFlag(
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await (featureFlag as any).cbStatusFlag(
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await (featureFlag as any).cbStatusFlag(
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
