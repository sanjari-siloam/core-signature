import Redis from 'ioredis';
import { IContextFeatureFlag } from './feature-flag.service';
import { IDataFeatureFlag } from './feature-flag.service.impl';
import * as process from 'node:process';

export interface IConfigFeatureFlag {
  ttl?: number;
  coreUrl?: string;
}

export class FeatureFlag {
  private readonly redis: Redis;
  private readonly cacheTtlMs: number = 1000 * 60 * 30;
  private readonly coreUrl: string;

  constructor(redis: Redis, options: IConfigFeatureFlag = {}) {
    this.redis = redis;
    this.cacheTtlMs = options.ttl ?? 1000 * 60 * 30;
    this.coreUrl =
      options.coreUrl ??
      process.env.CORE_URL_FEATURE_FLAG ??
      'http://localhost:7750/v1/feature-flag/dso';
  }

  private generateCacheKey(flag: string, ctx: IContextFeatureFlag): string {
    const secret_key: string | undefined = process.env.SECRET_KEY_HEIMDALL;
    return `feature-flag:${flag}:${ctx.userID}:${ctx.organization_id}:${secret_key}`;
  }

  private async getFlag(
    ctx: IContextFeatureFlag,
    flag: string,
    defaultValue: boolean = true,
  ): Promise<IDataFeatureFlag> {
    const cacheKey: string = this.generateCacheKey(flag, ctx);
    const cacheExist: string | null = await this.redis.get(cacheKey);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (cacheExist != null) return JSON.parse(cacheExist);

    const response: Response = await fetch(this.coreUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        context: {
          context: ctx,
          headers: {
            secret_key: process.env.SECRET_KEY_HEIMDALL,
          },
        },
        flag_name: flag,
        default_value: defaultValue,
      }),
    });

    if (!response.ok) {
      const errorText: string = await response.text();
      throw new Error(
        `API error fetching flag "${flag}" for context ${JSON.stringify(ctx)}: Status ${response.status}, Body: ${errorText}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json: any = await response.json();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!json || !json.data || typeof json.data.flag?.value !== 'boolean') {
      throw new Error(
        `Unexpected API response structure for flag "${flag}", context ${JSON.stringify(ctx)}: ${JSON.stringify(json)}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const data: IDataFeatureFlag = json.data;

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.cacheTtlMs);

    return data;
  }

  public async getStatusFlag(
    ctx: IContextFeatureFlag,
    flag: string,
    defaultValue: boolean = true,
  ): Promise<boolean> {
    const data: IDataFeatureFlag = await this.getFlag(ctx, flag, defaultValue);
    return data.flag.value;
  }

  public async cbStatusFlag(
    cb: (statusFlag: boolean) => Promise<void> | void,
    ctx: IContextFeatureFlag,
    flag: string,
    defaultValue: boolean = true,
  ): Promise<void> {
    const status: boolean = await this.getStatusFlag(ctx, flag, defaultValue);
    await cb(status);
  }
}
