import { LocalCaptionProvider } from '../ai/providers/local-caption.provider';
import * as fs from 'fs';

async function testCaptions() {
  const provider = new LocalCaptionProvider();

  const audioPath =
    '/home/vatsal2401/Ikigai/exploration/Learn-AI/render-worker/debug_repro_final/audio.mp3';
  const scriptText =
    "The rain falls outside. He chases his dreams, one line of code. Another late night. He's pushing through, despite the difficulties, always coding. Code, debug, repeat. He is learning to build something better today. Sacrifices are made. The journey is long, but the goal is closer. He is exhausted, yes, but he will never give up on succeeding. A new dawn. He's fueled by ambition, one step closer to achieving. A small victory. That is exactly how dreams become reality, bit by bit. Days turn into weeks. Then months. He never stopped improving himself. Now, he's ready for the world. One thing is for sure, he's arrived.";

  if (!fs.existsSync(audioPath)) {
    console.error(`Audio file not found at ${audioPath}`);
    return;
  }

  const audioBuffer = fs.readFileSync(audioPath);

  console.log('--- Generating Captions (Sentence Mode) ---');
  // 'sentence' mode -> NO words array expected
  const jsonBuffer = await provider.generateCaptions(
    audioBuffer,
    scriptText,
    undefined,
    'sentence',
  );

  const jsonContent = jsonBuffer.toString();
  const parsed = JSON.parse(jsonContent);
  const hasWords = parsed.some((c: any) => c.words && c.words.length > 0);

  if (!hasWords) {
    console.log('✅ SUCCESS: Sentence mode generated clean JSON without words.');
  } else {
    console.error('❌ FAILURE: JSON still contains words array in sentence mode.');
  }
  console.log('Generated JSON length:', jsonContent.length);

  const outputPath =
    '/home/vatsal2401/Ikigai/exploration/Learn-AI/render-worker/debug_repro_final/captions.json';
  fs.writeFileSync(outputPath, jsonBuffer);
  console.log(`✅ Updated captions saved to: ${outputPath}`);
}

testCaptions();
