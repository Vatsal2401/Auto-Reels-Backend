
import { GeminiScriptProvider } from '../../src/ai/providers/gemini-script.provider';
import { ReplicateImageProvider } from '../../src/ai/providers/replicate-image.provider';
import { DalleImageProvider } from '../../src/ai/providers/dalle-image.provider';
import { ElevenLabsTTSProvider } from '../../src/ai/providers/elevenlabs-tts.provider';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testMediaSettings() {
    console.log('🧪 Testing Media Generation Settings...');

    // 1. Script with Language & Duration
    console.log('\n📝 Testing Script Generation (Spanish, 30s)...');
    const scriptProvider = new GeminiScriptProvider();
    try {
        const scriptJSON = await scriptProvider.generateScriptJSON({
            topic: 'The Future of AI',
            language: 'Spanish',
            targetDurationSeconds: 30
        });
        console.log('✅ Script Generated!');
        console.log('   Topic:', scriptJSON.topic);
        console.log('   Duration:', scriptJSON.total_duration);
        if (scriptJSON.scenes.length > 0) {
            console.log('   Exceprt (Scene 1 Audio):', scriptJSON.scenes[0].audio_text);
        }
    } catch (e) {
        console.error('❌ Script Generation Failed:', e);
    }

    // 2. Image with Style & Aspect Ratio (Replicate)
    console.log('\n🎨 Testing Image Generation (Anime Style, 9:16)...');
    const imageProvider = new ReplicateImageProvider();
    try {
        const imageBuffer = await imageProvider.generateImage({
            prompt: "A futuristic city skyline",
            style: "Anime",
            aspectRatio: "9:16"
        });
        console.log(`✅ Image Generated (Replicate)! Size: ${imageBuffer.length} bytes`);
    } catch (e) {
        console.error('❌ Replicate Image Generation Failed:', e);
    }

    // 3. Audio with Voice ID
    console.log('\n🗣️ Testing TTS (Voice ID Override)...');
    const ttsProvider = new ElevenLabsTTSProvider();
    try {
        const audioBuffer = await ttsProvider.textToSpeech({
            text: "Hello, this is a test of the voice settings.",
            voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel
        });
        console.log(`✅ Audio Generated! Size: ${audioBuffer.length} bytes`);
    } catch (e) {
        console.error('❌ TTS Generation Failed:', e);
    }
}

testMediaSettings();
