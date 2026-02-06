import { KaraokeCaptionProvider } from '../ai/providers/karaoke-caption.provider';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const provider = new KaraokeCaptionProvider();

  // Adjust paths relative to where this script is run (backend root)
  const debugDir = join(process.cwd(), '../render-worker/debug_output');
  const audioPath = join(debugDir, 'audio.mp3');
  const outputPath = join(debugDir, 'captions.json');

  // Start with a shorter, punchy script for easier verification if desired,
  // but using the full script ensures we test long-form sync.
  const script =
    "Coding mein dooba developer, coffee ki jagah Red Bull se pyaar. Arey bhai! Yeh kya bakwaas hai? Code mein phir se keeda! Oh no! Debugging ke liye, saari raat jaagna padega, yaar! Bug fix ho gaya! Finally! Ab toh party shuru hogi! Hello? Haan, client ji. Website toh bilkul ready hai. Don't worry! Deadline aa rahi hai! Code karna padega, double speed se! Sote sote code... Zindagi ek coding marathon hai, doston! Yeh naya framework kya hai? Ab yeh bhi seekhna padega, bhaiya! Developer life: Ek comedy show! Subscribe for more coding fun!";

  console.log('🎤 Generating Specialized Karaoke Captions...');

  try {
    const audioBuffer = readFileSync(audioPath);
    // Using the karaoke provider directly
    const captionBuffer = await provider.generateCaptions(audioBuffer, script);

    writeFileSync(outputPath, captionBuffer);
    console.log(`✅ Karaoke Captions generated at: ${outputPath}`);
  } catch (e) {
    console.error('Error generating captions:', e);
  }
}

main().catch(console.error);
