import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DevAuthGuard } from './dev-auth.guard';
import { DevController } from './dev.controller';

@Global()
@Module({
  controllers: [DevController],
  providers: [{ provide: APP_GUARD, useClass: DevAuthGuard }],
})
export class AuthModule {}
