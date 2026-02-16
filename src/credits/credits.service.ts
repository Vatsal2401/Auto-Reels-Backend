import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreditTransaction, TransactionType } from './entities/credit-transaction.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private transactionRepository: Repository<CreditTransaction>,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.credits_balance;
  }

  async getCreditInfo(userId: string): Promise<{ balance: number; is_premium: boolean }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      balance: user.credits_balance,
      is_premium: user.is_premium ?? false,
    };
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description?: string,
    referenceId?: string,
    metadata?: Record<string, any>,
    manager?: EntityManager,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const repo = manager ? manager.getRepository(User) : this.userRepository;
    const txRepo = manager ? manager.getRepository(CreditTransaction) : this.transactionRepository;

    const user = await repo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user balance
    const newBalance = user.credits_balance + amount;
    await repo.update(userId, {
      credits_balance: newBalance,
      credits_purchased_total:
        type === TransactionType.PURCHASE
          ? user.credits_purchased_total + amount
          : user.credits_purchased_total,
    });

    // Create transaction record
    const transaction = txRepo.create({
      user_id: userId,
      transaction_type: type,
      amount,
      balance_after: newBalance,
      description: description || null,
      reference_id: referenceId || null,
      metadata: metadata || null,
    });

    return await txRepo.save(transaction);
  }

  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    referenceId: string,
    metadata?: Record<string, any>,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.credits_balance < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    // Update user balance
    const newBalance = user.credits_balance - amount;
    await this.userRepository.update(userId, {
      credits_balance: newBalance,
    });

    // Create transaction record
    const transaction = this.transactionRepository.create({
      user_id: userId,
      transaction_type: TransactionType.DEDUCTION,
      amount: -amount, // negative for deductions
      balance_after: newBalance,
      description,
      reference_id: referenceId,
      metadata: metadata || null,
    });

    return await this.transactionRepository.save(transaction);
  }

  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<CreditTransaction[]> {
    return await this.transactionRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async initializeUserCredits(userId: string, manager?: EntityManager): Promise<void> {
    const FREE_CREDITS = 3;
    await this.addCredits(
      userId,
      FREE_CREDITS,
      TransactionType.BONUS,
      'Welcome bonus - 3 free credits',
      null,
      { source: 'signup_bonus' },
      manager,
    );
  }

  async cleanupUserTransactions(userId: string): Promise<void> {
    await this.transactionRepository.delete({ user_id: userId });
  }
}
