import { LocalCaptionProvider } from '../ai/providers/local-caption.provider';
import { AssSubtitleProvider } from '../ai/providers/ass-subtitle.provider';
import * as fs from 'fs';
import * as path from 'path';

async function testAssKaraoke() {
  const assProvider = new AssSubtitleProvider();
  const provider = new LocalCaptionProvider(assProvider);

  const audioPath = path.resolve(__dirname, '../../test-assets/audio.mp3');
  const scriptText =
    'Repurpose your content! Turn long-form videos into engaging vertical shorts for Instagram and YouTube.';

  if (!fs.existsSync(audioPath)) {
    console.error(`Audio file not found at ${audioPath}`);
    return;
  }

  const audioBuffer = fs.readFileSync(audioPath);

  console.log('--- TEST: ASS Word Timing (Karaoke Highlight) ---');
  const assBuffer = await provider.generateCaptions(audioBuffer, scriptText, undefined, 'word', {
    preset: 'viral-pop',
    position: 'bottom',
  });

  const content = assBuffer.toString();
  console.log(content.slice(0, 1000) + '\n...');

  // Verification 1: Check for ASS header
  if (content.includes('[Script Info]') && content.includes('[V4+ Styles]')) {
    console.log('✅ SUCCESS: Contains valid ASS headers.');
  } else {
    console.error('❌ FAILURE: Missing ASS headers.');
  }

  // Verification 2: Check for Karaoke tags
  if (content.includes('{\\k')) {
    console.log('✅ SUCCESS: Contains karaoke (\\k) tags for word highlighting.');
  } else {
    console.error('❌ FAILURE: No karaoke tags found in word timing mode.');
  }

  // Save for inspection
  fs.writeFileSync('test_karaoke.ass', assBuffer);
  console.log(`\nFile saved: test_karaoke.ass`);
}

testAssKaraoke();
