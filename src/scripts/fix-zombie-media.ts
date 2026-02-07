import { Queue } from 'bullmq';
import 'dotenv/config';

async function trigger() {
  const connection = process.env.REDIS_HOST
    ? {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      }
    : {
        url: process.env.REDIS_URL,
      };

  const q = new Queue('render-tasks', {
    connection,
  });

  console.log('Pushing zombie job back to queue...');

  // Data retrieved from media_debug.json analysis
  const jobPayload = {
    mediaId: '794f6017-13dc-4cb2-be6b-9f1706e21607',
    stepId: 'ff31348f-5780-4588-a5da-9a6a3a717f03',
    userId: '777964c7-2284-4e00-b504-f1bb215a2bec',
    assets: {
      audio:
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/audio/audio/51235ba9-f6fe-419a-94e3-61118c1f24d8.mp3',
      caption:
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/caption/captions/captions.json',
      images: [
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/image/images/01b070d6-898d-41ed-ae0b-4b29068668ff.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/image/images/7280702a-0194-4696-bdf9-5424357fa3b4.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/image/images/a00162d8-1c1a-4814-b5dc-c613d00100e2.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/794f6017-13dc-4cb2-be6b-9f1706e21607/image/images/544cff03-0d11-4c99-b4ec-0e05e57626e1.jpg',
      ],
    },
    options: {
      preset: 'fast',
      rendering_hints: {
        pacing: 'moderate',
      },
    },
  };

  const job = await q.add('render', jobPayload);

  console.log('✅ Job re-added! ID:', job.id);

  // Optional: print command to track it
  console.log(`Track it using: grep "${job.id}" in logs`);

  await q.close();
}

trigger().catch(console.error);
