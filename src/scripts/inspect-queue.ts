import { Queue } from 'bullmq';
import 'dotenv/config';

async function inspect() {
  const connection = process.env.REDIS_HOST
    ? {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      }
    : {
        url: process.env.REDIS_URL,
      };

  if (!connection['host'] && !connection['url']) {
    console.error('Redis configuration missing (REDIS_HOST or REDIS_URL)');
    return;
  }

  const q = new Queue('render-tasks', {
    connection,
  });

  const counts = await q.getJobCounts();
  console.log('Queue Status (render-tasks):', counts);

  const waiting = await q.getWaiting();
  console.log(
    `Waiting jobs (${waiting.length}):`,
    waiting.map((j) => ({ id: j.id, name: j.name, data: j.data?.mediaId })),
  );

  const completed = await q.getCompleted();
  console.log(
    `Completed jobs (${completed.length}):`,
    completed.map((j) => ({ id: j.id, name: j.name, data: j.data?.mediaId })),
  );

  const failed = await q.getFailed();
  console.log(
    `Failed jobs (${failed.length}):`,
    failed.map((j) => ({ id: j.id, reason: j.failedReason })),
  );

  await q.close();
}

inspect().catch(console.error);
