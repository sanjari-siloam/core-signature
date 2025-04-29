# core-signature

A NestJS core module for handling signatures and feature flags.

## Installation
```bash
npm install core-signature
```

## Usage Backend
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SignatureModule } from 'core-signature';

@Module({
  imports: [SignatureModule]
})
export class AppModule {}


// app.controller.ts
import { Controller, Get, Req } from '@nestjs/common';
import { SignatureService } from 'core-signature';
import { Request } from 'express';

@Controller()
export class AppController {
    constructor(private readonly signatureService: SignatureService) {}
    
    @Get('hello')
    async hello(@Req() req: Request): Promise<string> {
      if (this.signatureService.useSignature(req)) {
        await this.signatureService.verifySignature(req);
      }
      return 'hello world';
    }
}
```

## Usage Frontend
```typescript
// app.component.ts
import { encryptSignature } from 'core-signature';
import process = require('node:process');

const query = { name: 'John' };
const body = { age: 30 };
const publicKey = process.env.PUBLIC_KEY;
const signature = encryptSignature(JSON.stringify(query), JSON.stringify(body), publicKey);

fetch('http://localhost:3000/hello', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': publicKey,
    'x-api-signature': signature
  }
});
```


# Feature Flag
## Usage Backend NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { FeatureFlagModule } from 'core-signature';

@Module({
  imports: [
    FeatureFlagModule.forRoot({
      ttl: 30 * 60 * 1000,
      host: 'localhost',
      port: 6379,
      coreUrl: 'http://localhost:3000/v1/feature-flag'
    })
  ]
})
export class AppModule {}


// app.controller.ts
import { Controller, Get, Req } from '@nestjs/common';
import { FeatureFlagService, IContextFeatureFlag } from 'core-signature';

@Controller()
export class AppController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get('hello')
  async hello(): Promise<string> {
    const ctx: IContextFeatureFlag = {
      userID: 'user123',
      organizationId: 456
    }
    const isMyFeatureFlag: boolean = await this.featureFlagService.getStatusFlag(ctx, 'my-feature-flag');
    if (isMyFeatureFlag) return 'used feature flag';
    return 'not used feature flag';
  }
}
```

## Usage Backend
```typescript
import Redis from 'ioredis';
import { IConfigFeatureFlag } from 'core-signature';

(async () => {
  const connection: Redis = RedisFacade.connection();
  const option: IConfigFeatureFlag = {
    ttl: 30 * 60 * 1000,
    coreUrl: 'http://localhost:3000/v1/feature-flag'
  }
  const featureFlag: FeatureFlag = new FeatureFlag(connection, option);
  
  const ctx: IContextFeatureFlag = {
    userID: 'user123',
    organizationId: 456
  }
  const isMyFeatureFlag: boolean = await featureFlag.getStatusFlag(ctx, 'my-feature-flag');
  if (isMyFeatureFlag) console.log('used feature flag');
  else console.log('not used feature flag');
  
  const cb: (status: boolean) => void = (status: boolean) => {
    if (status) console.log('used feature flag');
    else console.log('not used feature flag');
  }
  await featureFlag.cbStatusFlag(cb, ctx, 'my-feature-flag');
})();
```