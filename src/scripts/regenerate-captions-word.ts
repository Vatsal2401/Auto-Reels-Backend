import { LocalCaptionProvider } from '../ai/providers/local-caption.provider';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const provider = new LocalCaptionProvider();

  // Adjust paths relative to where this script is run (backend root)
  const debugDir = join(process.cwd(), '../render-worker/debug_output');
  const audioPath = join(debugDir, 'audio.mp3');
  const outputPath = join(debugDir, 'captions.json');

  // Hardcoded script for consistency
  const script =
    "Coding mein dooba developer, coffee ki jagah Red Bull se pyaar. Arey bhai! Yeh kya bakwaas hai? Code mein phir se keeda! Oh no! Debugging ke liye, saari raat jaagna padega, yaar! Bug fix ho gaya! Finally! Ab toh party shuru hogi! Hello? Haan, client ji. Website toh bilkul ready hai. Don't worry! Deadline aa rahi hai! Code karna padega, double speed se! Sote sote code... Zindagi ek coding marathon hai, doston! Yeh naya framework kya hai? Ab yeh bhi seekhna padega, bhaiya! Developer life: Ek comedy show! Subscribe for more coding fun!";

  console.log('🚀 Generating High-Motion "Word" Captions (Phrase + Karaoke Timings)...');

  try {
    const audioBuffer = readFileSync(audioPath);
    // Generate with 'word' timing mode to get the snappy timings inside the phrases
    const captionBuffer = await provider.generateCaptions(audioBuffer, script, undefined, 'word');

    writeFileSync(outputPath, captionBuffer);
    console.log(`✅ Captions regenerated at: ${outputPath}`);
  } catch (e) {
    console.error('Error generating captions:', e);
  }
}

main().catch(console.error);
