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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CampaignPostsService } from '../services/campaign-posts.service';
import { CampaignPublishService } from '../services/campaign-publish.service';
import { CreateCampaignPostDto } from '../dto/create-campaign-post.dto';
import { UpdateCampaignPostDto } from '../dto/update-campaign-post.dto';
import { ScheduleCampaignPostDto } from '../dto/schedule-campaign-post.dto';

@ApiTags('campaign-posts')
@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/posts')
export class CampaignPostsController {
  constructor(
    private readonly campaignPostsService: CampaignPostsService,
    private readonly campaignPublishService: CampaignPublishService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a post within a campaign' })
  create(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateCampaignPostDto,
  ) {
    return this.campaignPostsService.create(user.userId, campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all posts in a campaign' })
  findAll(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.campaignPostsService.findAll(user.userId, campaignId);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Get a single campaign post' })
  findOne(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.campaignPostsService.findOne(user.userId, campaignId, postId);
  }

  @Patch(':postId')
  @ApiOperation({ summary: 'Update a campaign post (metadata / asset references)' })
  update(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: UpdateCampaignPostDto,
  ) {
    return this.campaignPostsService.update(user.userId, campaignId, postId, dto);
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign post (must be in draft)' })
  remove(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.campaignPostsService.remove(user.userId, campaignId, postId);
  }

  @Post(':postId/schedule')
  @ApiOperation({ summary: 'Fan-out a ready post to all active campaign accounts' })
  schedule(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: ScheduleCampaignPostDto,
  ) {
    return this.campaignPublishService.schedulePost(
      user.userId,
      campaignId,
      postId,
      new Date(dto.scheduled_at),
    );
  }
}
