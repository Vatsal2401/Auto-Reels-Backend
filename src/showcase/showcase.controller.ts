import { Controller, Get } from '@nestjs/common';
import { ShowcaseService, ShowcaseResponse } from './showcase.service';

@Controller('showcase')
export class ShowcaseController {
  constructor(private readonly showcaseService: ShowcaseService) {}

  @Get()
  async getShowcase(): Promise<ShowcaseResponse> {
    return this.showcaseService.getShowcase();
  }
}
