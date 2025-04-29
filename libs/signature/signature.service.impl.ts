import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import axios, { AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { IncomingHttpHeaders } from 'http';
import { SignatureService } from './signature.service';
import { compareSignature } from './signature.validate';
import { MissingSignature } from './missing-signature';

export type SIGNATURE_HEADERS = string | string[] | undefined;
export interface ISignatureResponse {
  id: string;
  app_name: string;
  public_key: string;
  scope: string;
  expired_at: Date | null;
  created_at: Date;
  description: string;
}
export interface ResponseSignature {
  data: ISignatureResponse | undefined;
}

@Injectable()
export class SignatureServiceImpl extends SignatureService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  private getCacheKey(publicKey: string): string {
    return `signature:${publicKey}`;
  }

  private getTTL(): number {
    return parseInt(process.env.SIGNATURE_REDIS_EXPIRE || '300', 10);
  }

  useSignature(req: Request): boolean {
    const headers: IncomingHttpHeaders = req.headers;
    const publicKey: SIGNATURE_HEADERS = headers['x-api-key'];
    if (!(typeof publicKey == 'string')) throw new MissingSignature();
    return true;
  }

  async verifySignature(req: Request): Promise<void> {
    const headers: IncomingHttpHeaders = req.headers;
    const publicKey: SIGNATURE_HEADERS = headers['x-api-key'];
    const encryption: SIGNATURE_HEADERS = headers['x-api-signature'];
    const query: string = req.query ? JSON.stringify(req.query) : '';
    const body: string = req.body ? JSON.stringify(req.body) : '';

    if (typeof publicKey != 'string' || typeof encryption != 'string')
      throw new MissingSignature();
    await this.verifySignatureKey(query, body, publicKey, encryption);
  }

  async verifySignatureKey(
    query: string,
    body: string,
    publicKey: string,
    encryption: string,
  ): Promise<void> {
    const cacheKey: string = this.getCacheKey(publicKey);
    let cached: string | undefined | null =
      await this.cacheManager.get(cacheKey);
    const useCache: boolean = typeof cached == 'string';
    if (!useCache) {
      let response: AxiosResponse<ResponseSignature>;
      try {
        let baseUrl: string | undefined =
          process.env.SIGNATURE_API_CORE_MANAGEMENT;
        if (!baseUrl) baseUrl = 'http://localhost:7750';
        response = await axios.get(`${baseUrl}/signature/verify/${publicKey}`);
        const data: ISignatureResponse | undefined = response.data?.data;
        cached = JSON.stringify(data);
      } catch (err) {
        console.error(err);
        throw new MissingSignature();
      }
      if (response.status != 200) throw new MissingSignature();
      await this.cacheManager.set(cacheKey, cached, this.getTTL() * 1000);
    }
    await this.compareSignature(query, body, publicKey, encryption);
  }

  async compareSignature(
    query: string,
    body: string,
    publicKey: string,
    encryptionKey: string,
  ): Promise<void> {
    const data: string = `${publicKey}|${JSON.stringify(query)}|${JSON.stringify(body)}`;
    const result: boolean = await compareSignature(data, encryptionKey);
    if (!result) throw new MissingSignature();
  }
}
