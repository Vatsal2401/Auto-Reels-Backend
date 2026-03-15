import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CampaignsService } from './services/campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns for current user' })
  findAll(@CurrentUser() user: { userId: string }) {
    return this.campaignsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  findOne(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  update(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive (soft-delete) a campaign' })
  remove(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.archive(user.userId, id);
  }
}
