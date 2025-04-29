import {
  FeatureFlagService,
  IContextFeatureFlag,
} from './feature-flag.service';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface IDataFeatureFlag {
  flag: {
    name: string;
    value: boolean;
  };
  last_fetched_time: string;
}

@Injectable()
export class FeatureFlagServiceImpl extends FeatureFlagService {
  private readonly coreUrl: string;
  private readonly cacheTtlMs: number = 1000 * 60 * 30;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super();
    this.cacheTtlMs = this.configService.get<number>('ttl') ?? 1000 * 60 * 30;
    this.coreUrl =
      this.configService.get<string>('coreUrl') ??
      'http://localhost:7750/v1/feature-flag/dso';
  }

  private generateCacheKey(flag: string, ctx: IContextFeatureFlag): string {
    return `feature-flag:${flag}:${ctx.userID}:${ctx.organizationId}`;
  }

  private async getFlag(
    ctx: IContextFeatureFlag,
    flag: string,
    defaultValue: boolean = true,
  ): Promise<IDataFeatureFlag> {
    const cacheKey: string = this.generateCacheKey(flag, ctx);

    const cacheExist: string | null = await this.cacheManager.get(cacheKey);
    if (cacheExist != null) {
      console.log(
        `Cache hit for flag: ${flag}, context: ${JSON.stringify(ctx)}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(cacheExist);
    }
    console.log(
      `Cache miss for flag: ${flag}, context: ${JSON.stringify(ctx)}. Fetching from API.`,
    );

    const response: Response = await fetch(this.coreUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        context: ctx,
        flag_name: flag,
        default_value: defaultValue,
      }),
    });

    if (!response.ok) {
      const errorText: string = await response.text();
      console.error(
        `API error fetching flag "${flag}" for context ${JSON.stringify(ctx)}: Status ${response.status}, Body: ${errorText}`,
      );
      throw new Error(
        `Failed to fetch feature flag "${flag}". API responded with status ${response.status}.`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json: any = await response.json();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!json || !json.data || typeof json.data.flag?.value !== 'boolean') {
      console.error(
        `Unexpected API response structure for flag "${flag}", context ${JSON.stringify(ctx)}:`,
        json,
      );
      throw new Error(
        `Unexpected API response structure for feature flag "${flag}".`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const data: IDataFeatureFlag = json.data;

    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(data),
      this.cacheTtlMs,
    );
    console.log(
      `Cached flag "${flag}" for context ${JSON.stringify(ctx)} with TTL ${this.cacheTtlMs}ms.`,
    );

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
