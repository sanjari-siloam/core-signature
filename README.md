# core-signature

A NestJS core module for handling signatures

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