
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/auth/entities/user.entity';

async function updateUsersCountry() {
    try {
        console.log('Initializing Data Source...');
        await AppDataSource.initialize();
        console.log('Data Source initialized!');

        const userRepository = AppDataSource.getRepository(User);

        console.log('Updating all users country to "IN"...');
        const result = await userRepository
            .createQueryBuilder()
            .update(User)
            .set({ country: 'IN' })
            .where('country IS NULL OR country != :country', { country: 'IN' })
            .execute();

        console.log(`Updated ${result.affected} users.`);

    } catch (error) {
        console.error('Error during update:', error);
    } finally {
        await AppDataSource.destroy();
        console.log('Data Source destroyed.');
    }
}

updateUsersCountry();
