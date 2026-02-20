/**
 * Seed showcase items via the live HTTP API (no direct DB connection needed).
 *
 * Flow:
 *   1. For each media ID, call GET /media/:id to verify it exists and is completed.
 *      If the API returns 404 or status !== 'completed', the ID is skipped.
 *   2. GET /showcase → DELETE every existing showcase item.
 *   3. POST /showcase/items for each valid media ID (type='reel', in order).
 *
 * After this, run  npm run upload-showcase-clips  (on the server where DB is reachable)
 * to generate 2s clips from S3 and update clip_blob_id.
 *
 * Config (set in .env or shell):
 *   API_URL=https://api.autoreels.in   (defaults to http://localhost:3000)
 *
 * Run: npm run seed-showcase
 */

import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import axios, { AxiosError } from 'axios';

const scriptDir = __dirname;
const envPaths = [
  join(scriptDir, '..', '.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend', '.env'),
];
for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// The 7 media IDs to show on the landing page, in display order.
const MEDIA_IDS = [
  'e3c43f50-8e05-43a9-a084-37c678b6ad00',
  '32212588-0234-4093-97d1-f8e623cf422d',
  '44a7dc7f-2008-413a-967c-40ef4ee6a193',
  '16a1ef47-783f-455c-942b-e01c1c03fd4d',
  'b3103357-6f11-4783-9e1d-f28831e1a3d5',
  'a19a5a2f-b6ca-426f-a39e-86223cd8cc43',
  'a57972f4-f24c-4592-93dd-f001c5363b11',
];

async function main() {
  console.log(`Using API: ${API_URL}\n`);

  // 1. Verify each media ID via GET /media/:id (public endpoint)
  console.log(`Verifying ${MEDIA_IDS.length} media IDs via API...`);
  const validIds: string[] = [];

  for (const id of MEDIA_IDS) {
    try {
      const { data } = await axios.get(`${API_URL}/media/${id}`);
      const status: string = data?.status ?? 'unknown';
      if (status === 'completed') {
        console.log(`  ✓  ${id} — status: completed`);
        validIds.push(id);
      } else {
        console.warn(`  ⚠  ${id} — status: ${status} (skipping)`);
      }
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 404) {
        console.warn(`  ✗  ${id} — 404 not found (skipping)`);
      } else {
        console.warn(`  ✗  ${id} — error: ${axErr.message} (skipping)`);
      }
    }
  }

  if (validIds.length === 0) {
    console.error('\nNo valid media IDs found. Nothing to seed.');
    process.exit(1);
  }

  console.log(`\n${validIds.length} valid IDs to insert.`);

  // 2. Delete all existing showcase items
  console.log('\nFetching existing showcase items...');
  const { data: showcase } = await axios.get<{ items: { id: string }[] }>(`${API_URL}/showcase`);
  const existing = showcase.items ?? [];
  console.log(`Found ${existing.length} existing items — deleting...`);

  for (const item of existing) {
    await axios.delete(`${API_URL}/showcase/items/${item.id}`);
    console.log(`  Deleted ${item.id}`);
  }

  // 3. Insert new showcase items in order
  console.log('\nInserting new showcase items...');
  let inserted = 0;
  for (let i = 0; i < validIds.length; i++) {
    const mediaId = validIds[i];
    const { data: created } = await axios.post(`${API_URL}/showcase/items`, {
      type: 'reel',
      mediaId,
      sortOrder: i,
    });
    console.log(`  Inserted #${i} → ${mediaId} (showcase id: ${created.id})`);
    inserted++;
  }

  console.log(`\n✅ Done. Inserted ${inserted} showcase items.`);
  console.log('\nNext step (run on server where DB + S3 are accessible):');
  console.log('  npm run upload-showcase-clips');
  console.log('\nThat generates 2s clips from S3, uploads them, and sets clip_blob_id.');
  console.log('After that, GET /showcase returns real signed video URLs for the landing page.');
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
