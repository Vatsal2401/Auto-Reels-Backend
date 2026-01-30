
import { Test } from '@nestjs/testing';
import { FFmpegRendererProvider } from '../../src/render/providers/ffmpeg-renderer.provider';
import * as path from 'path';
import * as fs from 'fs';

const STORAGE_ROOT = path.resolve(__dirname, '../../storage');
const TEST_ID = '2b65b933-96d8-41e0-947d-2e3416298edb';

async function runRenderTest() {
    console.log('🧪 Starting FFmpeg Render Isolation Test...');

    // 1. Locate Assets (User Provided)
    const assetsDir = path.resolve(__dirname, '../../scripts');

    // Helper to find first file in dir
    const findFile = (dir: string) => {
        if (!fs.existsSync(dir)) return null;
        const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
        return files.length > 0 ? path.join(dir, files[0]) : null;
    };

    // Explicitly use the user-provided files
    const videoPath = path.join(assetsDir, 'gemini_video.mp4');
    const audioPath = path.join(assetsDir, 'test-audio-sdk.mp3');

    // We still need a caption file. We'll look for one in the storage directory or create a dummy one.
    // Let's first check if there is an existing one we can reuse.
    const captionDir = path.join(STORAGE_ROOT, 'captions', TEST_ID);
    let captionPath = findFile(captionDir);

    if (!captionPath) {
        // Create a temporary dummy caption file for the test
        captionPath = path.join(__dirname, 'test_captions.srt');
        const dummySrt = `1
00:00:00,000 --> 00:00:05,000
This is a test of the Production Pipeline.

2
00:00:05,000 --> 00:00:10,000
We are burning subtitles and cropping to 9:16.
`;
        fs.writeFileSync(captionPath, dummySrt);
        console.log('📝 Created dummy subtitle file:', captionPath);
    }

    if (!fs.existsSync(videoPath)) {
        console.error('❌ Video file not found:', videoPath);
        return;
    }
    if (!fs.existsSync(audioPath)) {
        console.error('❌ Audio file not found:', audioPath);
        return;
    }

    console.log(`📂 Inputs:
    - Audio: ${audioPath}
    - Caption: ${captionPath}
    - Video: ${videoPath}
    `);

    // 2. Read Buffers
    const audioExample = fs.readFileSync(audioPath);
    const captionExample = fs.readFileSync(captionPath);
    const videoExample = fs.readFileSync(videoPath);

    // 3. Run Render
    const renderer = new FFmpegRendererProvider();

    try {
        console.log('🎬 Rendering...');
        const start = Date.now();

        const finalBuffer = await renderer.compose({
            audio: audioExample,
            caption: captionExample,
            video: videoExample,
            assets: [] // Not used in new flow override
        });

        const duration = (Date.now() - start) / 1000;
        console.log(`✅ Render Complete in ${duration}s! Size: ${finalBuffer.length} bytes`);

        const outputPath = path.join(__dirname, 'test_render_final.mp4');
        fs.writeFileSync(outputPath, finalBuffer);
        console.log(`💾 Saved to: ${outputPath}`);

    } catch (e) {
        console.error('❌ Render Failed:', e);
    }
}

runRenderTest();
