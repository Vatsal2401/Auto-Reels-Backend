
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CreditsService } from '../src/credits/credits.service';
import { DataSource } from 'typeorm';
import { User } from '../src/auth/entities/user.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const creditsService = app.get(CreditsService);
    const dataSource = app.get(DataSource);

    // Get the most recent user or a specific user if you know the ID
    // For debugging, let's grab the user who created the last video
    // Check for videos from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentVideos = await dataSource.query(`SELECT * FROM media WHERE created_at >= '${today.toISOString()}' ORDER BY created_at DESC`);

    console.log(`Found ${recentVideos.length} videos from today (${today.toISOString()})`);

    if (recentVideos.length === 0) {
        // Fallback to last video
        const lastVideo = await dataSource.query(`SELECT * FROM videos ORDER BY created_at DESC LIMIT 1`);
        if (lastVideo.length > 0) {
            console.log("Showing LAST video (not from today):");
            const video = lastVideo[0];
            console.log(`ID: ${video.id}, Status: ${video.status}, Created: ${video.created_at}`);
        }
        await app.close();
        return;
    }

    const video = recentVideos[0];
    const userId = video.user_id;
    console.log(`Checking details for Video ID: ${video.id}`);
    console.log(`Status: ${video.status}`);
    console.log(`Created At: ${video.created_at}`);
    console.log(`Completed At: ${video.completed_at}`);
    console.log(`User ID: ${userId}`);

    try {
        const balance = await creditsService.getBalance(userId);
        console.log(`Current Credit Balance: ${balance}`);

        const history = await creditsService.getTransactionHistory(userId, 10);
        console.log("Recent Transactions:");
        history.forEach(tx => {
            console.log(`[${tx.created_at}] Type: ${tx.transaction_type} | Amount: ${tx.amount} | Balance After: ${tx.balance_after} | Desc: ${tx.description}`);
        });

    } catch (error) {
        console.error("Error checking credits:", error);
    }

    await app.close();
}

bootstrap();
