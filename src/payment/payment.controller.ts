import { Controller, Post, Body, UseGuards, UnauthorizedException, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: 'Create a Razorpay order' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  async createOrder(@CurrentUser() user: any, @Body() body: { planId: string }) {
    return this.paymentService.createOrder(body.planId, user.userId, user.country);
  }

  @ApiOperation({ summary: 'Verify Razorpay payment signature' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyPayment(
    @CurrentUser() user: any,
    @Body() body: { orderId: string; paymentId: string; signature: string },
  ) {
    const success = await this.paymentService.verifyPayment(
      body.orderId,
      body.paymentId,
      body.signature,
      user.userId,
    );
    if (!success) {
      throw new UnauthorizedException('Payment verification failed');
    }
    return { success: true };
  }

  @ApiOperation({ summary: 'Razorpay Webhook' })
  @Post('webhook')
  async handleWebhook(@Headers('x-razorpay-signature') signature: string, @Body() body: any) {
    return this.paymentService.handleWebhook(body, signature);
  }
}
