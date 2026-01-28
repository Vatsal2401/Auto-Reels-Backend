import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = `http://localhost:${process.env.PORT || 3000}`;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('🚀 Starting End-to-End Video Generation Test');
    console.log(`📡 Connecting to API: ${API_URL}`);

    try {
        // 1. Signup / Login
        const email = `test_${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`\n👤 Creating test user: ${email}`);

        let token: string;
        try {
            const signupRes = await axios.post(`${API_URL}/auth/signup`, {
                email,
                password,
                name: 'Test User'
            });
            console.log('✅ Signup successful');
        } catch (e: any) {
            console.log('⚠️ Signup failed (maybe exists), trying login...');
        }

        const loginRes = await axios.post(`${API_URL}/auth/signin`, {
            email,
            password
        });
        token = loginRes.data.access_token;
        console.log('✅ Login successful, Token received');

        // 2. Create Video
        const topic = 'The future of AI in 30 seconds';
        console.log(`\n🎬 Creating video with topic: "${topic}"`);

        const createRes = await axios.post(
            `${API_URL}/videos`,
            { topic },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const videoId = createRes.data.video_id;
        console.log(`✅ Video created! ID: ${videoId}`);
        console.log(`   Initial Status: ${createRes.data.status}`);

        // 3. Poll for Status
        console.log('\n⏳ Polling for status updates...');
        let status = createRes.data.status;
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes (assuming 1s sleep) - adjust as needed

        while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
            await sleep(2000); // Poll every 2 seconds
            attempts++;

            const statusRes = await axios.get(
                `${API_URL}/videos/${videoId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const newStatus = statusRes.data.status;
            if (newStatus !== status) {
                status = newStatus;
                console.log(`🔄 Status Update: ${status.toUpperCase()} (${attempts * 2}s)`);

                // Log progress details if available
                const video = statusRes.data;
                if (video.script) console.log('   📄 Script generated');
                if (video.image_urls?.length) console.log(`   🖼️ Images: ${video.image_urls.length}`);
                if (video.audio_url) console.log('   🔊 Audio generated');
                if (video.generated_video_url) console.log('   🎞️ Video segments converted');
                if (video.final_video_url) console.log('   🎬 Final video rendered');
            }
        }

        if (status === 'completed') {
            console.log('\n✨ SUCCESS! Video generation completed.');
            const finalRes = await axios.get(
                `${API_URL}/videos/${videoId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`📺 Final Video URL: ${finalRes.data.final_video_url}`);
        } else if (status === 'failed') {
            console.error('\n❌ FAILED. Video generation failed.');
            const finalRes = await axios.get(
                `${API_URL}/videos/${videoId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.error(`Reason: ${finalRes.data.error_message}`);
        } else {
            console.warn('\n⚠️ TIMEOUT. Generation is taking longer than expected.');
        }

    } catch (error: any) {
        console.error('\n❌ Error running test:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

runTest();
