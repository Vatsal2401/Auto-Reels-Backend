import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangChainRegistry } from './langchain.registry';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [LangChainRegistry],
  exports: [LangChainRegistry],
})
export class LangChainModule {}
