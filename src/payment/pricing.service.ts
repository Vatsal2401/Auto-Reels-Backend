import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditPlan } from './entities/credit-plan.entity';

@Injectable()
export class PricingService implements OnModuleInit {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(CreditPlan)
    private creditPlanRepository: Repository<CreditPlan>,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  async seedPlans() {
    const count = await this.creditPlanRepository.count();
    if (count > 0) return;

    this.logger.log('Seeding credit plans...');

    const plans = [
      {
        name: 'Starter Pack',
        credits: 10,
        price_inr: 75000, // ₹750.00
        price_usd: 900, // $9.00
        tag: 'For testing the waters',
        is_active: true,
      },
      {
        name: 'Creator Pack',
        credits: 25,
        price_inr: 160000, // ₹1600.00
        price_usd: 2000, // $20.00
        tag: 'Most Popular',
        is_active: true,
      },
      {
        name: 'Influencer Pack',
        credits: 50,
        price_inr: 290000, // ₹2900.00
        price_usd: 3500, // $35.00
        tag: 'Best for daily content',
        is_active: true,
      },
      {
        name: 'Enterprise Pack',
        credits: 100,
        price_inr: 500000, // ₹5000.00
        price_usd: 6000, // $60.00
        tag: 'Best for power users',
        is_active: true,
      },
    ];

    for (const plan of plans) {
      await this.creditPlanRepository.save(this.creditPlanRepository.create(plan));
    }

    this.logger.log('Credit plans seeded successfully.');
  }

  async getPlans(userCountry?: string) {
    const plans = await this.creditPlanRepository.find({
      where: { is_active: true },
      order: { credits: 'ASC' },
    });

    const isIndia = userCountry === 'IN';
    const currency = isIndia ? 'INR' : 'USD';
    const symbol = isIndia ? '₹' : '$';

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      credits: plan.credits,
      price: isIndia ? plan.price_inr : plan.price_usd,
      displayPrice: isIndia ? plan.price_inr / 100 : plan.price_usd / 100,
      currency,
      symbol,
      tag: plan.tag,
    }));
  }
}
