import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testAudio() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY is missing');
    return;
  }

  console.log('🧪 Testing ElevenLabs TTS (SDK v3)...');

  const client = new ElevenLabsClient({ apiKey });

  const text =
    'This is a test of the Eleven Labs text to speech integration using the official SDK.';
  const modelId = 'eleven_multilingual_v2';
  const voiceId = '21m00Tcm4TlvDq8ikWAM';

  console.log(`🗣️ Generating audio for: "${text}" with ${modelId}`);

  try {
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text: text,
      modelId: modelId,
      outputFormat: 'mp3_44100_128',
    });

    console.log('✅ Response received from ElevenLabs');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const outputPath = path.join(__dirname, 'test-audio-sdk.mp3');
    fs.writeFileSync(outputPath, buffer);
    console.log(`💾 Saved audio to: ${outputPath}`);
    console.log(`📦 Size: ${buffer.length} bytes`);
  } catch (error: any) {
    console.error('❌ ElevenLabs Test Failed:');
    console.error(error);
  }
}

testAudio();
