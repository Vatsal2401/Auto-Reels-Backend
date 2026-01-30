
import { Test, TestingModule } from '@nestjs/testing';
import { ReplicateImageProvider } from '../../src/ai/providers/replicate-image.provider';
import { GeminiVideoProvider } from '../../src/ai/providers/gemini-video.provider';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runIntegrationTest() {
    console.log('🧪 Starting Provider Integration Test (Image -> Video)...');

    // Manual instantiation to avoid NestJS boilerplate for this quick test
    // Assuming providers rely on process.env which is loaded above.

    console.log('📸 Step 1: Generating Image with Replicate...');
    const imageProvider = new ReplicateImageProvider();

    let imageBuffer: Buffer;
    try {
        imageBuffer = await imageProvider.generateImage("A cinematic futuristic city, golden hour, 4k");
        console.log(`✅ Image generated! Size: ${imageBuffer.length} bytes`);
        fs.writeFileSync(path.join(__dirname, 'test_image.png'), imageBuffer);
    } catch (e) {
        console.error('❌ Replicate generation failed:', e);
        return;
    }

    console.log('🎥 Step 2: Generating Video with Gemini (Veo)...');
    const videoProvider = new GeminiVideoProvider();

    try {
        // Veo duration is often fixed or limited in preview
        const videoBuffer = await videoProvider.generateVideo(imageBuffer, 5);
        console.log(`✅ Video generated! Size: ${videoBuffer.length} bytes`);
        const videoPath = path.join(__dirname, 'test_video_output.mp4');
        fs.writeFileSync(videoPath, videoBuffer);
        console.log(`💾 Saved video to: ${videoPath}`);
    } catch (e) {
        console.error('❌ Gemini Video generation failed:', e);
        if (e.message && e.message.includes("404")) {
            console.error("   (This confirms 404 Model Not Found if that's the error)");
        }
    }
}

runIntegrationTest();
