import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { Request } from 'express';
import { SignatureServiceImpl } from './signature.service.impl';
import { compareSignature } from './signature.validate'; // Assuming this is a separate file
import { MissingSignature } from './missing-signature'; // Assuming this is a separate file

// Mock the external dependency 'axios'
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the external dependency 'compareSignature'
jest.mock('./signature.validate', () => ({
  compareSignature: jest.fn(),
}));
const mockedCompareSignature = compareSignature as jest.Mock;

describe('SignatureServiceImpl', () => {
  let service: SignatureServiceImpl;
  let cacheManager: Cache;

  // Before each test, create a new testing module
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureServiceImpl,
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

    service = module.get<SignatureServiceImpl>(SignatureServiceImpl);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Set a default value for the environment variable used in getTTL
    process.env.SIGNATURE_REDIS_EXPIRE = '300';
    process.env.SIGNATURE_API_CORE_MANAGEMENT = 'https://test-api.com';
  });

  // Cleanup environment variables after tests
  afterAll(() => {
    delete process.env.SIGNATURE_REDIS_EXPIRE;
    delete process.env.SIGNATURE_API_CORE_MANAGEMENT;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('useSignature', () => {
    it('should return true if x-api-key header is a string', () => {
      const req = {
        headers: { 'x-api-key': 'test-public-key' },
      } as unknown as Request;
      expect(service.useSignature(req)).toBe(true);
    });

    it('should throw MissingSignature if x-api-key header is missing', () => {
      const req = { headers: {} } as unknown as Request;
      expect(() => service.useSignature(req)).toThrow(MissingSignature);
    });

    it('should throw MissingSignature if x-api-key header is an array', () => {
      const req = {
        headers: { 'x-api-key': ['key1', 'key2'] },
      } as unknown as Request;
      expect(() => service.useSignature(req)).toThrow(MissingSignature);
    });

    it('should throw MissingSignature if x-api-key header is undefined', () => {
      const req = {
        headers: { 'x-api-key': undefined },
      } as unknown as Request;
      expect(() => service.useSignature(req)).toThrow(MissingSignature);
    });
  });

  describe('verifySignature', () => {
    const mockRequest = {
      headers: {
        'x-api-key': 'test-public-key',
        'x-api-signature': 'test-encryption',
      },
      query: { param1: 'value1' },
      body: { data: 'some data' },
    } as unknown as Request;

    // Spy on verifySignatureKey to check if it's called
    let verifySignatureKeySpy: jest.SpyInstance;

    beforeEach(() => {
      verifySignatureKeySpy = jest.spyOn(service, 'verifySignatureKey');
      // Mock the spy to resolve without doing the actual work
      verifySignatureKeySpy.mockResolvedValue(undefined);
    });

    it('should call verifySignatureKey with correct parameters if headers are strings', async () => {
      await service.verifySignature(mockRequest);
      expect(verifySignatureKeySpy).toHaveBeenCalledWith(
        JSON.stringify(mockRequest.query),
        JSON.stringify(mockRequest.body),
        'test-public-key',
        'test-encryption',
      );
    });

    it('should throw MissingSignature if x-api-key header is missing', async () => {
      const req = {
        headers: { 'x-api-signature': 'test-encryption' },
        query: {},
        body: {},
      } as unknown as Request;
      await expect(service.verifySignature(req)).rejects.toThrow(
        MissingSignature,
      );
      expect(verifySignatureKeySpy).not.toHaveBeenCalled();
    });

    it('should throw MissingSignature if x-api-signature header is missing', async () => {
      const req = {
        headers: { 'x-api-key': 'test-public-key' },
        query: {},
        body: {},
      } as unknown as Request;
      await expect(service.verifySignature(req)).rejects.toThrow(
        MissingSignature,
      );
      expect(verifySignatureKeySpy).not.toHaveBeenCalled();
    });

    it('should throw MissingSignature if x-api-key is not a string', async () => {
      const req = {
        headers: {
          'x-api-key': ['key1'],
          'x-api-signature': 'test-encryption',
        },
        query: {},
        body: {},
      } as unknown as Request;
      await expect(service.verifySignature(req)).rejects.toThrow(
        MissingSignature,
      );
      expect(verifySignatureKeySpy).not.toHaveBeenCalled();
    });

    it('should throw MissingSignature if x-api-signature is not a string', async () => {
      const req = {
        headers: {
          'x-api-key': 'test-public-key',
          'x-api-signature': ['sig1'],
        },
        query: {},
        body: {},
      } as unknown as Request;
      await expect(service.verifySignature(req)).rejects.toThrow(
        MissingSignature,
      );
      expect(verifySignatureKeySpy).not.toHaveBeenCalled();
    });

    it('should handle empty query and body correctly', async () => {
      const req = {
        headers: {
          'x-api-key': 'test-public-key',
          'x-api-signature': 'test-encryption',
        },
        query: undefined,
        body: undefined,
      } as unknown as Request;
      await service.verifySignature(req);
      expect(verifySignatureKeySpy).toHaveBeenCalledWith(
        '', // Empty string for an undefined query
        '', // Empty string for undefined body
        'test-public-key',
        'test-encryption',
      );
    });
  });

  describe('verifySignatureKey', () => {
    const publicKey = 'test-public-key';
    const encryption = 'test-encryption';
    const query = JSON.stringify({ param: 'value' });
    const body = JSON.stringify({ data: 'payload' });
    const cacheKey = `signature:${publicKey}`;
    const mockSignatureData = {
      id: '123',
      app_name: 'TestApp',
      public_key: publicKey,
      scope: 'read',
      expired_at: null,
      created_at: new Date(),
      description: 'Test key',
    };
    const cachedSignatureData = JSON.stringify(mockSignatureData);

    // Spy on compareSignature to check if it's called
    let compareSignatureSpy: jest.SpyInstance;

    beforeEach(() => {
      compareSignatureSpy = jest.spyOn(service, 'compareSignature');
      // Mock the spy to resolve without doing the actual work
      compareSignatureSpy.mockResolvedValue(undefined);
    });

    it('should use cache if data is present in cache', async () => {
      // Mock cacheManager.get to return cached data
      (cacheManager.get as jest.Mock).mockResolvedValue(cachedSignatureData);

      await service.verifySignatureKey(query, body, publicKey, encryption);

      // Expect cacheManager.get to have been called
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      // Expect axios.get NOT to have been called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).not.toHaveBeenCalled();
      // Expect cacheManager.set NOT to have been called
      expect(cacheManager.set).not.toHaveBeenCalled();
      // Expect compareSignature to have been called
      expect(compareSignatureSpy).toHaveBeenCalledWith(
        query,
        body,
        publicKey,
        encryption,
      );
    });

    it('should fetch data from API if cache is empty and cache the result', async () => {
      // Mock cacheManager.get to return undefined (cache miss)
      (cacheManager.get as jest.Mock).mockResolvedValue(undefined);
      // Mock axios.get to return a successful response
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { data: mockSignatureData },
      });

      await service.verifySignatureKey(query, body, publicKey, encryption);

      // Expect cacheManager.get to have been called
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      // Expect axios.get to have been called with the correct URL
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://test-api.com/signature/verify/${publicKey}`,
      );
      // Expect cacheManager.set to have been called with the correct data and TTL
      expect(cacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        cachedSignatureData,
        service['getTTL']() * 1000, // Access private method for TTL
      );
      // Expect compareSignature to have been called
      expect(compareSignatureSpy).toHaveBeenCalledWith(
        query,
        body,
        publicKey,
        encryption,
      );
    });

    it('should throw MissingSignature if API call fails', async () => {
      // Mock cacheManager.get to return undefined (cache miss)
      (cacheManager.get as jest.Mock).mockResolvedValue(undefined);
      // Mock axios.get to throw an error
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      await expect(
        service.verifySignatureKey(query, body, publicKey, encryption),
      ).rejects.toThrow(MissingSignature);

      // Expect cacheManager.get to have been called
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      // Expect axios.get to have been called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalled();
      // Expect cacheManager.set NOT to have been called
      expect(cacheManager.set).not.toHaveBeenCalled();
      // Expect compareSignature NOT to have been called
      expect(compareSignatureSpy).not.toHaveBeenCalled();
    });

    it('should throw MissingSignature if API response status is not 200', async () => {
      // Mock cacheManager.get to return undefined (cache miss)
      (cacheManager.get as jest.Mock).mockResolvedValue(undefined);
      // Mock axios.get to return a non-200 status response
      mockedAxios.get.mockResolvedValue({
        status: 404,
        data: { data: undefined },
      });

      await expect(
        service.verifySignatureKey(query, body, publicKey, encryption),
      ).rejects.toThrow(MissingSignature);

      // Expect cacheManager.get to have been called
      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      // Expect axios.get to have been called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalled();
      // Expect cacheManager.set NOT to have been called
      expect(cacheManager.set).not.toHaveBeenCalled();
      // Expect compareSignature NOT to have been called
      expect(compareSignatureSpy).not.toHaveBeenCalled();
    });

    it('should use default baseUrl if SIGNATURE_API_CORE_MANAGEMENT is not set', async () => {
      // Unset the environment variable for this test
      delete process.env.SIGNATURE_API_CORE_MANAGEMENT;

      // Mock cacheManager.get to return undefined (cache miss)
      (cacheManager.get as jest.Mock).mockResolvedValue(undefined);
      // Mock axios.get to return a successful response
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { data: mockSignatureData },
      });

      await service.verifySignatureKey(query, body, publicKey, encryption);

      // Expect axios.get to have been called with the default URL
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://localhost:7750/signature/verify/${publicKey}`,
      );
    });
  });

  describe('compareSignature', () => {
    const publicKey = 'test-public-key';
    const encryptionKey = 'test-encryption-key';
    const query = JSON.stringify({ param: 'value' });
    const body = JSON.stringify({ data: 'payload' });
    const dataToCompare = `${publicKey}|${JSON.stringify(query)}|${JSON.stringify(body)}`;

    it('should call compareSignature function with correct data', async () => {
      // Mock the external compareSignature to return true
      mockedCompareSignature.mockResolvedValue(true);

      await service.compareSignature(query, body, publicKey, encryptionKey);

      // Expect the external compareSignature function to have been called
      expect(mockedCompareSignature).toHaveBeenCalledWith(
        dataToCompare,
        encryptionKey,
      );
    });

    it('should throw MissingSignature if compareSignature returns false', async () => {
      // Mock the external compareSignature to return false
      mockedCompareSignature.mockResolvedValue(false);

      await expect(
        service.compareSignature(query, body, publicKey, encryptionKey),
      ).rejects.toThrow(MissingSignature);

      // Expect the external compareSignature function to have been called
      expect(mockedCompareSignature).toHaveBeenCalledWith(
        dataToCompare,
        encryptionKey,
      );
    });

    it('should handle errors thrown by compareSignature', async () => {
      // Mock the external compareSignature to throw an error
      mockedCompareSignature.mockRejectedValue(new Error('Comparison failed'));

      await expect(
        service.compareSignature(query, body, publicKey, encryptionKey),
      ).rejects.toThrow('Comparison failed'); // Expecting the specific error from the mock

      // Expect the external compareSignature function to have been called
      expect(mockedCompareSignature).toHaveBeenCalledWith(
        dataToCompare,
        encryptionKey,
      );
    });
  });

  describe('Private Methods', () => {
    it('getCacheKey should return the correct cache key', () => {
      const publicKey = 'some-key';
      expect(service['getCacheKey'](publicKey)).toBe(`signature:${publicKey}`);
    });

    it('getTTL should return the parsed environment variable or default', () => {
      // Test with an environment variable set
      process.env.SIGNATURE_REDIS_EXPIRE = '600';
      expect(service['getTTL']()).toBe(600);

      // Test with environment variable unset (should use default '300')
      delete process.env.SIGNATURE_REDIS_EXPIRE;
      expect(service['getTTL']()).toBe(300);

      // Reset for other tests
      process.env.SIGNATURE_REDIS_EXPIRE = '300';
    });
  });
});
