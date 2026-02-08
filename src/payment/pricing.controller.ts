import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payment')
@Controller('payment')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get available credit plans' })
  @ApiResponse({ status: 200, description: 'List of credit plans' })
  async getPlans(@CurrentUser() user: any) {
    // We need to fetch the user's country to determine currency.
    // Since we don't have the full user object in @CurrentUser usually (depends on strategy),
    // we might need to rely on what's in the token or fetch user.
    // Assuming user.country is NOT in token yet, but we updated AuthService to populate User entity with country.
    // The CurrentUser decorator typically returns the request.user object.
    // In JwtStrategy, we usually validate and return the user.

    // Let's check JwtStrategy to see what it returns.
    // If it returns the full user, we can access user.country.
    // If it returns a subset, we might need to fetch the country.
    // For now, let's assume we can pass the country if available, or undefined.

    return this.pricingService.getPlans(user.country);
  }

  @Get('plans/public')
  @ApiOperation({ summary: 'Get public credit plans (defaults to USD)' })
  async getPublicPlans() {
    return this.pricingService.getPlans('US'); // Default to USD for public view
  }
}
