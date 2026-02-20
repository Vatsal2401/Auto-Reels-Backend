/**
 * One-off showcase update:
 *   - DELETE showcase item with media_id 84abaccb-b355-4c5f-8c11-18e818048733
 *   - INSERT type='graphic_motion' projectId=3f70e2ee-ddce-477f-b7af-85c34a89f961
 *   - INSERT type='reel'          mediaId=d5b08f5b-b43f-45aa-be5e-395882fbeb84
 *   - INSERT type='reel'          mediaId=601bbf1f-8390-4e40-ac0b-85341b39fb9c
 *
 * Run: API_URL=https://your-api.com npm run update-showcase
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

const DELETE_SHOWCASE_ID = '84abaccb-b355-4c5f-8c11-18e818048733'; // showcase item id (url=null, mediaId=e3c43f50)

const ADD_PROJECT_ID    = '3f70e2ee-ddce-477f-b7af-85c34a89f961';
const ADD_MEDIA_IDS     = [
  'd5b08f5b-b43f-45aa-be5e-395882fbeb84',
  '601bbf1f-8390-4e40-ac0b-85341b39fb9c',
];

async function main() {
  console.log(`API: ${API_URL}\n`);

  // 1. Fetch current showcase to find the item to delete
  console.log('Fetching current showcase...');
  const { data: showcase } = await axios.get<{
    items: { id: string; type: string; mediaId?: string; projectId?: string }[];
  }>(`${API_URL}/showcase`);

  const items = showcase.items ?? [];
  console.log(`Current items: ${items.length}`);
  items.forEach((it) =>
    console.log(`  ${it.id}  type=${it.type}  media=${it.mediaId ?? '-'}  project=${it.projectId ?? '-'}`),
  );

  // 2. Delete showcase item by its own ID directly
  try {
    await axios.delete(`${API_URL}/showcase/items/${DELETE_SHOWCASE_ID}`);
    console.log(`\n✓ Deleted showcase item ${DELETE_SHOWCASE_ID}`);
  } catch (err) {
    const e = err as AxiosError;
    console.warn(`\n⚠  Could not delete ${DELETE_SHOWCASE_ID}: ${e.message}`);
  }

  // 3. Insert graphic_motion item (project)
  try {
    const { data: gm } = await axios.post(`${API_URL}/showcase/items`, {
      type: 'graphic_motion',
      projectId: ADD_PROJECT_ID,
    });
    console.log(`✓ Inserted graphic_motion  project=${ADD_PROJECT_ID}  (showcase id: ${gm.id})`);
  } catch (err) {
    const e = err as AxiosError;
    console.error(`✗ Failed to insert graphic_motion: ${e.message}`);
  }

  // 4. Insert reel items (media)
  for (const mediaId of ADD_MEDIA_IDS) {
    try {
      const { data: reel } = await axios.post(`${API_URL}/showcase/items`, {
        type: 'reel',
        mediaId,
      });
      console.log(`✓ Inserted reel            media=${mediaId}  (showcase id: ${reel.id})`);
    } catch (err) {
      const e = err as AxiosError;
      console.error(`✗ Failed to insert reel ${mediaId}: ${e.message}`);
    }
  }

  console.log('\nDone. Run  npm run upload-showcase-clips  on the server to generate clips for the new items.');
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
