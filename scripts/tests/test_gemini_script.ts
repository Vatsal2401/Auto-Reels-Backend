
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testGeminiScript() {
    console.log('🧪 Testing Gemini Script Generation...');

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY is missing in .env');
        return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = "Create a 30-second video script about: 'The Future of Quantum Computing'. Return ONLY valid JSON with 'scenes' array containing 'narrative' and 'image_prompt'.";

    console.log(`📝 Prompt: ${prompt}`);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini Output (Snippet):', text.substring(0, 200) + '...');

        // Basic JSON validation
        try {
            // strip potential markdown code blocks
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(cleanText);
            console.log('✅ Valid JSON received.');
            if (json.scenes && Array.isArray(json.scenes)) {
                console.log(`✅ Contains ${json.scenes.length} scenes.`);
            } else {
                console.warn('⚠️ JSON missing "scenes" array.');
            }
        } catch (e) {
            console.warn('⚠️ Could not parse JSON directly (might contain extra text).');
        }

    } catch (error) {
        console.error('❌ Gemini Script Test Failed:', error);
    }
}

testGeminiScript();
