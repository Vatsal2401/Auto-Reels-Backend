import { LocalCaptionProvider } from '../ai/providers/local-caption.provider';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

async function verify() {
  const debugDir = join(process.cwd(), '../render-worker/debug_output/');
  const audioPath = join(debugDir, 'audio.mp3');

  if (!existsSync(audioPath)) {
    console.error(`❌ Missing audio in ${audioPath}`);
    return;
  }

  const scriptText =
    "Coding mein dooba developer, coffee ki jagah Red Bull se pyaar. Arey bhai! Yeh kya bakwaas hai? Code mein phir se keeda! Oh no! Debugging ke liye, saari raat jaagna padega, yaar! Bug fix ho gaya! Finally! Ab toh party shuru hogi! Hello? Haan, client ji. Website toh bilkul ready hai. Don't worry! Deadline aa rahi hai! Code karna padega, double speed se! Sote sote code... Zindagi ek coding marathon hai, doston! Yeh naya framework kya hai? Ab yeh bhi seekhna padega, bhaiya! Developer life: Ek comedy show! Subscribe for more coding fun!";
  console.log(`📝 Testing with full script (${scriptText.length} chars)`);

  // 1. Instantiate Provider
  const captionProvider = new LocalCaptionProvider();

  // 2. Generate New Captions
  console.log('⏳ Generating Sequential Stable Captions (JSON)...');
  const audioBuffer = readFileSync(audioPath);

  const jsonBuffer = await captionProvider.generateCaptions(audioBuffer, scriptText);

  const entries = JSON.parse(jsonBuffer.toString());
  writeFileSync(join(debugDir, 'captions.json'), JSON.stringify(entries, null, 2));

  console.log('\n--- DETERMINISTIC RENDER METRICS ---');

  // A. Check for Overlaps
  let overlaps = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].start < entries[i - 1].end) overlaps++;
  }
  console.log(`🔹 Overlapping Captions: ${overlaps}`);
  if (overlaps === 0) console.log('   ✅ PASS: No overlapping captions detected.');

  // B. Check Durations
  const invalidDurations = entries.filter(
    (e: any) => e.end - e.start < 0.9 || e.end - e.start > 1.6,
  );
  console.log(`🔹 Invalid Durations (out of 1.0-1.5s range): ${invalidDurations.length}`);
  if (invalidDurations.length === 0)
    console.log('   ✅ PASS: All durations are within stable range.');

  // C. Continuity check
  const lastEntry = entries[entries.length - 1];
  console.log(`🔹 Total Captions: ${entries.length}`);
  console.log(`🔹 Sequence Completion: ${lastEntry.end}s`);

  console.log('\n🚀 SEQUENTIAL STABILITY TEST COMPLETE.');
}

verify().catch(console.error);
