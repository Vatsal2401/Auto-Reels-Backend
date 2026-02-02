import { Queue } from 'bullmq';
import 'dotenv/config';

async function trigger() {
  const q = new Queue('render-tasks', {
    connection: {
      url: process.env.REDIS_URL,
    },
  });

  console.log('Pushing job to queue...');
  const job = await q.add('render', {
    mediaId: 'fcacd286-a79e-4507-9ae4-1af1e756ee5e',
    stepId: 'a1fc1841-b834-49d6-a371-89e96c152965',
    userId: '777964c7-2284-4e00-b504-f1bb215a2bec',
    assets: {
      audio:
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/audio/audio/3989b4e5-a906-422d-86d4-309e21b26f7d.mp3',
      caption:
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/caption/captions/a4578e12-c0bf-4066-a8f7-d556647be0e7.srt',
      images: [
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/image/images/0aa91d02-4c5d-4591-8ffb-ca9220926431.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/image/images/9ea34d81-16ae-447d-9fd1-081e65bc9420.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/image/images/3cf586dc-9be9-4d86-8fec-ed53038d8fcf.jpg',
        'users/777964c7-2284-4e00-b504-f1bb215a2bec/media/fcacd286-a79e-4507-9ae4-1af1e756ee5e/image/images/dcb4bb88-8cbb-4fdb-8b37-f0d89f5d3b12.jpg',
      ],
    },
    options: {
      preset: 'fast',
      rendering_hints: {
        pacing: 'moderate',
      },
    },
  });

  console.log('Job added! ID:', job.id);
  await q.close();
}

trigger().catch(console.error);
