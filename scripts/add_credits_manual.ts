
import { DataSource } from 'typeorm';
import { User } from '../src/auth/entities/user.entity';
import { Video } from '../src/video/entities/video.entity';

const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ai_reels',
    entities: [User, Video],
    synchronize: false,
});

async function addCredits() {
    try {
        await dataSource.initialize();
        console.log('🔌 Connected to database');

        const userRepository = dataSource.getRepository(User);
        const email = 'vatsalpatel9393@gmail.com';
        const amountToAdd = 10;

        const user = await userRepository.findOne({ where: { email } });

        if (!user) {
            console.error(`❌ User with email ${email} not found.`);
            process.exit(1);
        }

        console.log(`👤 Found user: ${user.email}`);
        console.log(`💰 Current Balance: ${user.credits_balance}`);

        user.credits_balance += amountToAdd;

        // We are just updating the balance. If you wanted to track this as a purchase:
        // user.credits_purchased_total += amountToAdd;

        await userRepository.save(user);

        console.log(`✅ Added ${amountToAdd} credits.`);
        console.log(`💰 New Balance: ${user.credits_balance}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

addCredits();
