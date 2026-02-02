import { GoogleGenAI } from '@google/genai'; // Using new SDK for imagery if applicable, or Vertex.
// Note: Per prev errors, "imagen-3.0-generate-001" not found on standard endpoint.
// We will test with standard Gemini Flash for now just to verify connectivity,
// as Imagen 3 might require Vertex AI headers.
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiImage() {
  console.log('🧪 Testing Gemini Image Generation (Availability Check)...');

  // Note: This test is expected to fail with 404 if the model is not allowlisted
  // but we write it to document the attempt.

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is missing in .env');
    return;
  }

  // Try using the new Google GenAI SDK which supports Imagen 3
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = 'A futuristic city with neon lights';
  const modelId = 'imagen-3.0-generate-001';

  console.log(`🎨 Generating image with model: ${modelId}`);

  try {
    const response = await client.models.generateImages({
      model: modelId,
      prompt: prompt,
      config: {
        numberOfImages: 1,
      },
    });

    console.log('✅ Response:', response);
  } catch (error: any) {
    console.error('❌ Gemini Image Generation Failed:');
    if (error.status && error.status === 404) {
      console.error(
        '   Reason: Model not found (404). This confirms your key does not likely have access to Imagen 3 on the public API yet.',
      );
    } else {
      console.error(error);
    }
  }
}

testGeminiImage();
