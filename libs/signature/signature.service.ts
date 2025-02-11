import { Request } from 'express';

export class SignatureService {
  useSignature(request: Request): boolean {
    console.log(request);
    throw new Error('Method not implemented.');
  }

  async verifySignature(request: Request): Promise<void> {
    console.log(request);
    return Promise.reject(new Error('Method not implemented.'));
  }
}
