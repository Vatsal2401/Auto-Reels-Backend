import { Queue } from 'bullmq';
import 'dotenv/config';

async function inspect() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('REDIS_URL missing');
    return;
  }

  const q = new Queue('render-tasks', {
    connection: { url: redisUrl },
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
