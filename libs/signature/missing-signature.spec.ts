import { UnauthorizedException } from '@nestjs/common';
import { MissingSignature } from './missing-signature';

describe('MissingSignature Exception', () => {
  it('must be an instance of Missing Signature and UnauthorizedException', () => {
    const exception = new MissingSignature();

    expect(exception).toBeInstanceOf(MissingSignature);
    expect(exception).toBeInstanceOf(UnauthorizedException);
  });

  it('should have a default message of "Unauthorized"', () => {
    const exception = new MissingSignature();

    expect(exception.message).toBe('Unauthorized');
    expect(exception.getResponse()).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });
  });

  it('must be able to receive custom messages', () => {
    const customMessage = 'Signature tidak ditemukan';
    const exception = new MissingSignature(customMessage);

    expect(exception.message).toBe(customMessage);
    expect(exception.getResponse()).toEqual({
      statusCode: 401,
      message: customMessage,
      error: 'Unauthorized',
    });
  });

  it('must have status code 401', () => {
    const exception = new MissingSignature();

    expect(exception.getStatus()).toBe(401);
  });
});
