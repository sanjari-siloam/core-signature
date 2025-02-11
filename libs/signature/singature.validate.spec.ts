import * as bc from 'bcrypt';
import * as process from 'node:process';
import { encryptSignature, compareSignature } from './signature.validate';

jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('Signature Validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SIGNATURE_SALT_ROUND;
  });

  it('should combine data correctly and use default salt round', async () => {
    (bc.genSalt as jest.Mock).mockResolvedValue('generated_salt');
    (bc.hash as jest.Mock).mockResolvedValue('hashed_data');

    const result = await encryptSignature(
      'test-query',
      'test-body',
      'public-key',
    );

    expect(bc.genSalt).toHaveBeenCalledWith(10);
    expect(bc.hash).toHaveBeenCalledWith(
      'public-key|"test-query"|"test-body"',
      'generated_salt',
    );
    expect(result).toBe('hashed_data');
  });

  it('should use salt round from environment variable', async () => {
    process.env.SIGNATURE_SALT_ROUND = '12';

    await encryptSignature('', '', '');

    expect(bc.genSalt).toHaveBeenCalledWith(12);
  });

  it('should handle empty strings and special characters', async () => {
    (bc.genSalt as jest.Mock).mockResolvedValue('salt');

    await encryptSignature('query|with pipe', '{"json":true}', '');

    expect(bc.hash).toHaveBeenCalledWith(
      '|"query|with pipe"|"{\\"json\\":true}"',
      'salt',
    );
  });

  it('should throw error when hashing fails', async () => {
    (bc.genSalt as jest.Mock).mockRejectedValue(new Error('Hashing error'));

    await expect(encryptSignature('', '', '')).rejects.toThrow('Hashing error');
  });
});

describe('compare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when comparison matches', async () => {
    (bc.compare as jest.Mock).mockResolvedValue(true);

    const result = await compareSignature('hashed', 'plain');

    expect(result).toBe(true);
    expect(bc.compare).toHaveBeenCalledWith('hashed', 'plain');
  });

  it('should return false when comparison fails', async () => {
    (bc.compare as jest.Mock).mockResolvedValue(false);

    const result = await compareSignature('wrong-hash', 'plain');

    expect(result).toBe(false);
  });

  it('should handle comparison errors', async () => {
    (bc.compare as jest.Mock).mockRejectedValue(new Error('Comparison error'));

    await expect(compareSignature('invalid', 'data')).rejects.toThrow(
      'Comparison error',
    );
  });
});
