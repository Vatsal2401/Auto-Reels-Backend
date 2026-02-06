import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspectQueue() {
    const redisUrl = process.env.REDIS_URL;
    console.log(`🔍 Connecting to Redis: ${redisUrl}`);

    const queue = new Queue('render-tasks', {
        connection: {
            url: redisUrl,
        },
    });

    try {
        // Check 100 completed jobs
        const completedJobs = await queue.getJobs(['completed'], 0, 100, false);
        console.log(`\n--- Recently Completed Jobs (${completedJobs.length}) ---`);

        let found = false;
        for (const job of completedJobs) {
            if (job.data.mediaId === 'd2114fcd-6940-45b0-9c8f-7e580c0db62d') {
                console.log(`\n🎯 TARGET JOB FOUND [${job.id}]`);
                console.log(`Media ID: ${job.data.mediaId}`);
                console.log(`Payload: ${JSON.stringify(job.data, null, 2)}`);
                console.log(`Result: ${JSON.stringify(job.returnvalue, null, 2)}`);
                found = true;
                break;
            }
        }

        if (!found) {
            console.log('\n❌ Target job not found in recent 100 completed jobs.');
            console.log('Sample of last 5 jobs:');
            completedJobs.slice(0, 5).forEach(j => console.log(` - Job ${j.id} for Media ${j.data.mediaId}`));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await queue.close();
    }
}

inspectQueue();
