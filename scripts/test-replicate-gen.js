const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Replicate = require('replicate');
const fs = require('fs');

console.log('🔍 Testing Replicate Video Generation...');

const apiToken = process.env.REPLICATE_API_TOKEN;
if (!apiToken) {
  console.error('❌ REPLICATE_API_TOKEN is missing.');
  process.exit(1);
}

const replicate = new Replicate({ auth: apiToken });

async function runTest() {
  try {
    console.log('🚀 Starting generation task...');
    console.log('Model: stability-ai/stable-video-diffusion');
    
    // Using a simple small image for testing (100x100 solid color) to verify the pipeline
    // Convert to data URI
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAApSURBVHhe7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAHiqAUwAAZVw10EAAAAASUVORK5CYII=";

    const input = {
      input_image: dataUri,
      video_length: "14 frames_with_svd_xt",
      sizing_strategy: "maintain_aspect_ratio",
      frames_per_second: 6,
      motion_bucket_id: 127,
      cond_aug: 0.02
    };

    console.log('⏳ Waiting for prediction...');
    const output = await replicate.run(
      "stability-ai/stable-video-diffusion:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      { input }
    );

    console.log('✅ Replicate Output Received:');
    console.log(JSON.stringify(output, null, 2));

  } catch (error) {
    console.error('❌ Replicate Generation Failed:', error.message);
    if (error.response) {
       console.error('Response Data:', error.response.data);
    }
  }
}

runTest();
