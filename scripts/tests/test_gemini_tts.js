const textToSpeech = require('@google-cloud/text-to-speech');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiTTSSDK() {
    console.log(`🔌 Testing Gemini TTS (via Google Cloud SDK)...`);

    // The SDK automatically looks for GOOGLE_APPLICATION_CREDENTIALS.
    // If you want to use an API Key (not standard for Node SDK but possible via fallback options or if using a specific client config), 
    // it's trickier. The SDK favors Service Account JSON.
    // However, some versions allow passing { fallback: 'rest', apiKey: ... } or similar.
    // Standard practice: Use `gcloud auth application-default login` OR set GOOGLE_APPLICATION_CREDENTIALS
    
    // Initialize client with API Key and REST fallback
    // This allows using the SDK without setting up a full Service Account (ADC).
    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
    const client = new textToSpeech.TextToSpeechClient({
        apiKey: apiKey,
        fallback: 'rest'
    });

    const text = "Hello! This is a test of the Google Cloud SDK integration. Using Journey voices.";
    const voiceName = 'en-US-Journey-F'; 

    const request = {
        input: { text: text },
        voice: {
            languageCode: 'en-US',
            name: voiceName,
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0, 
        },
    };

    try {
        const startTime = Date.now();
        const [response] = await client.synthesizeSpeech(request);
        const duration = Date.now() - startTime;

        console.log(`✅ SDK Call Successful in ${duration}ms`);

        if (response.audioContent) {
            const outputPath = path.resolve(__dirname, 'test_gemini_tts_sdk.mp3');
            fs.writeFileSync(outputPath, response.audioContent, 'binary');
            console.log(`💾 Saved test audio to: ${outputPath}`);
        } else {
            console.error('❌ No audio content received');
        }

    } catch (e) {
        console.error('❌ Gemini TTS SDK Failed:');
        console.error(e.message);
        console.log('\n💡 TIP: Ensure you have run:');
        console.log('   gcloud auth application-default login');
        console.log('   OR set GOOGLE_APPLICATION_CREDENTIALS to your service-account.json path');
    }
}

testGeminiTTSSDK();
