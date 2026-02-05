import { LocalCaptionProvider } from '../ai/providers/local-caption.provider';

import * as fs from 'fs';
import * as path from 'path';

async function testCaptions() {
  const provider = new LocalCaptionProvider();

  const audioPath = path.resolve(__dirname, '../../test-assets/audio.mp3');
  // Extracted from caption.srt
  const scriptText =
    'Repurpose your content! Turn long-form videos into engaging vertical shorts for Instagram and YouTube. Add subtle motion effects like slow zooms and pans. Keep it professional, not flashy, for a premium feel. Ensure captions are readable. Place them near the bottom and use clear, concise language. Reach a wider audience on Instagram Reels and YouTube Shorts effortlessly. Start creating professional short videos today! Visit our website and follow us for more tips.';

  if (!fs.existsSync(audioPath)) {
    console.error(`Audio file not found at ${audioPath}`);
    return;
  }

  const audioBuffer = fs.readFileSync(audioPath);

  console.log('--- TEST 1: Sentence Timing (Default) ---');
  const srtSentence = await provider.generateCaptions(
    audioBuffer,
    scriptText,
    undefined,
    'sentence',
  );
  console.log(srtSentence.toString().slice(0, 500) + '\n...');

  console.log('\n--- TEST 2: Word Timing (New) ---');
  const srtWord = await provider.generateCaptions(audioBuffer, scriptText, undefined, 'word');
  console.log(srtWord.toString().slice(0, 500) + '\n...');

  // Simple validation
  const sentenceLines = srtSentence
    .toString()
    .split('\n')
    .filter((l) => l.includes('-->')).length;
  const wordLines = srtWord
    .toString()
    .split('\n')
    .filter((l) => l.includes('-->')).length;

  console.log(`\n\nMetric Validation:`);
  console.log(`Sentence Captions Count: ${sentenceLines}`);
  console.log(`Word Captions Count: ${wordLines}`);

  if (wordLines > sentenceLines) {
    console.log('✅ SUCCESS: Word timing produced more granular captions.');
  } else {
    console.error('❌ FAILURE: Word timing did not produce more captions than sentence timing.');
  }

  console.log(`\nFiles saved for manual inspection:`);
  fs.writeFileSync('test_sentence.srt', srtSentence);
  fs.writeFileSync('test_word.srt', srtWord);
  console.log('- test_sentence.srt');
  console.log('- test_word.srt');
}

testCaptions();
