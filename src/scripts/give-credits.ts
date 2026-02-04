import { AppDataSource } from '../database/data-source';
import { User } from '../auth/entities/user.entity';

async function giveCredits(email: string, amount: number) {
  try {
    await AppDataSource.initialize();
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOneBy({ email });

    if (!user) {
      console.error(`User with email ${email} not found.`);
      return;
    }

    const oldBalance = user.credits_balance;
    user.credits_balance += amount;
    await userRepository.save(user);

    console.log(`Successfully gave ${amount} credits to ${email}.`);
    console.log(`Old balance: ${oldBalance}, New balance: ${user.credits_balance}`);
  } catch (error) {
    console.error('Error giving credits:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

const email = process.argv[2] || 'vatsal5176@gmail.com';
const amount = parseInt(process.argv[3] || '1000');

giveCredits(email, amount);
