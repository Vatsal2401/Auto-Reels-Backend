const Replicate = require('replicate');
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testReplicateImage() {
  console.log('🧪 Testing Replicate Image Generation...');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN is missing in .env');
    return;
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const model = 'black-forest-labs/flux-schnell';
  const prompt =
    'A futuristic city with neon lights and flying cars, cinematic lighting, 8k resolution';

  console.log(`🎨 Generating image with model: ${model}`);
  console.log(`📝 Prompt: ${prompt}`);

  try {
    const output = await replicate.run(model, {
      input: {
        prompt: prompt,
        go_fast: true,
        megapixels: '1',
        num_outputs: 1,
        aspect_ratio: '16:9',
        output_format: 'png',
        output_quality: 80,
        num_inference_steps: 4,
      },
    });

    console.log('✅ Replicate Output:', output);

    // Replicate returns an array of URLs (or a ReadableStream depending on input)
    if (Array.isArray(output) && output.length > 0) {
      console.log(`🔗 Image URL: ${output[0]}`);

      // Note: In a real test we might download it, but seeing the URL confirms it works.
    } else {
      console.log('⚠️ Unexpected output format:', output);
    }
  } catch (error) {
    console.error('❌ Replicate Test Failed:', error);
  }
}

testReplicateImage();
