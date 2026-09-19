import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SEARCH_PROVIDER } from './search-provider';
import { SearxngSearchProvider } from './searxng-search.provider';
import { WebResearchService } from './web-research.service';

@Module({
  providers: [
    {
      provide: SEARCH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new SearxngSearchProvider(config),
    },
    WebResearchService,
  ],
  exports: [WebResearchService],
})
export class ResearchModule {}
