import { Request } from 'express';
import { SignatureService } from './signature.service';

describe('SignatureService', () => {
  let service: SignatureService;
  const mockRequest = { headers: {} } as Request;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new SignatureService();
    jest.spyOn(console, 'log').mockImplementation();
  });

  describe('useSignature', () => {
    it('should throw the error "Method not implemented."', () => {
      expect(() => service.useSignature(mockRequest)).toThrow(
        'Method not implemented.',
      );
    });

    it('must call console.log with request parameter', () => {
      try {
        service.useSignature(mockRequest);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err: unknown) {
        // do nothing
      }
      expect(console.log).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('verifySignature', () => {
    it('must return rejected promise with correct error', async () => {
      await expect(service.verifySignature(mockRequest)).rejects.toThrow(
        'Method not implemented.',
      );
    });

    it('must call console.log with request parameter', async () => {
      try {
        await service.verifySignature(mockRequest);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err: unknown) {
        // do nothing
      }
      expect(console.log).toHaveBeenCalledWith(mockRequest);
    });
  });
});
