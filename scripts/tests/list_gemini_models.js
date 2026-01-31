
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY not found');
        return;
    }

    const genAI = new GoogleGenAI(apiKey);
    try {
        // The SDK might have a way to list models, but often we check the documentation or try common ones.
        // Let's try to see if listModels exists or just catch the error and suggest alternatives.
        console.log('Fetching models...');
        // Note: genAI.listModels() might not be in all SDK versions. 
        // We'll try to just catch what's available.
        
        // Actually, let's try common alternative IDs.
        const models = ['imagen-3.0-generate-001', 'imagen-2.0-generate-001', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        console.log('Common models to check:');
        console.log(models);
        
        // Let's try to call listModels if it exists
        if (genAI.listModels) {
            const result = await genAI.listModels();
            console.log('Available Models:', result);
        } else {
            console.log('genAI.listModels not available in this SDK version.');
        }
    } catch (e) {
        console.error('Error listing models:', e.message);
    }
}

listModels();
