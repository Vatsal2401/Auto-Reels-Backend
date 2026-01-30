
const { GoogleGenAI } = require("@google/genai");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function generateVideo() {
  console.log('✨ Testing Gemini Veo 3.1 Video Generation...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is missing.');
    return;
  }

  // Initialize the new GenAI client
  const ai = new GoogleGenAI({ apiKey: apiKey });

  const prompt = "A cinematic shot of a futuristic city floating in the clouds, golden hour lighting, 4k, incredibly detailed.";

  try {
    console.log(`🚀 Sending prompt: "${prompt}"`);
    console.log(`🤖 Model: veo-3.1-generate-preview`);

    let operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
    });

    console.log('⏳ Operation started. ID:', operation.name);

    // Poll the operation status until the video is ready.
    while (!operation.done) {
      console.log("... Waiting for video generation to complete (10s) ...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
    }

    console.log('✅ Generation Complete!');
    
    if (operation.response && operation.response.generatedVideos && operation.response.generatedVideos.length > 0) {
       const videoFile = operation.response.generatedVideos[0].video;
       const outputPath = path.resolve(__dirname, 'gemini_video.mp4');
       
       console.log(`⬇️ Downloading to: ${outputPath}`);
       
       // Use SDK helper if available, or manual download if needed.
       // The example uses ai.files.download
       await ai.files.download({
         file: videoFile,
         downloadPath: outputPath,
       });

       console.log(`🎉 Video saved successfully: ${outputPath}`);
    } else {
       console.error('⚠️ No video found in response:', JSON.stringify(operation.response));
    }

  } catch (error) {
    console.error('❌ Error generating video:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
  }
}

generateVideo();
