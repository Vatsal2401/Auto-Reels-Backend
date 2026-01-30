
import { GoogleGenerativeAI } from '@google/generative-ai'; // Standard SDK doesn't support Veo directly yet usually, but we use REST or specialized calls
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiVideo() {
    console.log('🧪 Testing Gemini Video Generation (Veo)...');

    // Using raw REST call as per `GeminiVideoProvider` implementation logic

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is missing');
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predict?key=${apiKey}`;

    // Dummy image (1x1 pixel base64) to valid request structure
    const dummyImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    console.log('🎬 Sending request to Veo 3.1...');

    try {
        const response = await axios.post(url, {
            instances: [
                {
                    image: {
                        imageBytes: dummyImageBase64
                    },
                    prompt: "A cinematic pan of a mountain landscape"
                }
            ],
            parameters: {
                sampleCount: 1,
                seconds: 1 // Preview length
            }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Response received from Veo API');
        if (response.data.predictions && response.data.predictions.length > 0) {
            console.log('✅ Video Bytes received');
        } else {
            console.log('⚠️ Unexpected response structure:', JSON.stringify(response.data));
        }

    } catch (error: any) {
        console.error('❌ Gemini Video Generation Failed:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 429) {
                console.error('   Note: 429 indicates "Quota Exceeded". This confirms connectivity but you are rate limited.');
            }
        } else {
            console.error(error.message);
        }
    }
}

testGeminiVideo();
