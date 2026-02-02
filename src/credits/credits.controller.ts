import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditsService } from './credits.service';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { TransactionType } from './entities/credit-transaction.entity';

@ApiTags('Credits')
@ApiBearerAuth('JWT-auth')
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: any) {
    const balance = await this.creditsService.getBalance(user.userId);
    return { balance };
  }

  @Get('me')
  async getCreditInfo(@CurrentUser() user: any) {
    const balance = await this.creditsService.getBalance(user.userId);
    // Note: is_premium will be fetched from user entity in a real implementation
    return {
      balance,
      is_premium: false, // TODO: Fetch from user entity
    };
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const transactions = await this.creditsService.getTransactionHistory(
      user.userId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
    return { transactions };
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchaseCredits(@CurrentUser() user: any, @Body() dto: PurchaseCreditsDto) {
    // TODO: Integrate with payment provider (Stripe, PayPal, etc.)
    // For now, this is a placeholder that adds credits without payment
    const transaction = await this.creditsService.addCredits(
      user.userId,
      dto.amount,
      TransactionType.PURCHASE,
      `Purchased ${dto.amount} credits`,
      null,
      { payment_provider: 'manual', payment_status: 'pending' },
    );

    return {
      message: 'Credits purchased successfully',
      transaction,
      balance: transaction.balance_after,
    };
  }
}
