import { encryptSignature, SignatureModule, SignatureService } from './index';

describe('SignatureModule - Exports', () => {
  it('should export SignatureModule', () => {
    expect(SignatureModule).toBeDefined();
  });

  it('should export SignatureService', () => {
    expect(SignatureService).toBeDefined();
  });

  it('should export encryptSignature', () => {
    expect(encryptSignature).toBeDefined();
  });
});
