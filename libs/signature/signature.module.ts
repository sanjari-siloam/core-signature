import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { SignatureService } from './signature.service';
import { SignatureServiceImpl } from './signature.service.impl';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.SIGNATURE_REDIS_MAIN_HOSTNAME || 'localhost',
      port: process.env.SIGNATURE_REDIS_MAIN_PORT || 6379,
      ttl: parseInt(process.env.SIGNATURE_REDIS_EXPIRE || '300', 10),
    }),
  ],
  providers: [
    {
      provide: SignatureService,
      useClass: SignatureServiceImpl,
    },
  ],
  exports: [SignatureService],
})
export class SignatureModule {}
