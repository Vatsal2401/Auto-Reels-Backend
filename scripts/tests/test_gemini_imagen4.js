const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testImagen4() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found');
    return;
  }

  const genAI = new GoogleGenAI(apiKey);
  const modelId = 'imagen-4.0-generate-001';

  console.log(`Testing Gemini image generation with model: ${modelId}`);

  try {
    const response = await genAI.models.generateImages({
      model: modelId,
      prompt:
        'A high-tech laboratory with glowing blue lights and futuristic computers, cinematic style, 8k',
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      console.log('✅ Image generation successful!');
      const img = response.generatedImages[0].image;
      const buffer = Buffer.from(img.imageBytes || img.base64 || img, 'base64');
      const outputPath = path.resolve(__dirname, 'test_gemini_output.jpg');
      fs.writeFileSync(outputPath, buffer);
      console.log(`Saved test image to: ${outputPath}`);
    } else {
      console.error('❌ No images returned from API');
    }
  } catch (e) {
    console.error('❌ Gemini Image Generation Failed:');
    console.error(e.message);
    if (e.response && e.response.data) {
      console.error(JSON.stringify(e.response.data, null, 2));
    }
  }
}

testImagen4();
