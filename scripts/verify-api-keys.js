const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Replicate = require('replicate');

console.log('🔍 Verifying API Keys with Node.js ' + process.version);
const envPath = path.resolve(__dirname, '../.env');
console.log('📂 Loading .env from:', envPath);

async function testOpenAI() {
  console.log('\n🤖 Testing OpenAI...');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  OPENAI_API_KEY is missing/commented out.');
    return;
  }
  try {
    const openai = new OpenAI({ apiKey });
    const list = await openai.models.list();
    console.log(`✅ OpenAI Connected! Found ${list.data.length} models.`);
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
  }
}

async function testGemini() {
  console.log('\n✨ Testing Gemini...');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  GEMINI_API_KEY is missing.');
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent("Hello");
    const response = await result.response;
    console.log(`✅ Gemini Connected! Response: "${response.text().trim()}"`);
  } catch (error) {
    console.error('❌ Gemini Error:', error.message);
  }
}

async function testReplicate() {
  console.log('\n🦾 Testing Replicate...');
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    console.log('⚠️  REPLICATE_API_TOKEN is missing.');
    return;
  }
  try {
    const replicate = new Replicate({ auth: apiToken });
    const model = await replicate.models.get('stability-ai', 'sdxl');
    console.log(`✅ Replicate Connected! Accessed model: ${model.name}`);
  } catch (error) {
    console.error('❌ Replicate Error:', error.message);
  }
}

async function runTests() {
  await testOpenAI();
  await testGemini();
  await testReplicate();
  console.log('\n🏁 Verification Complete.');
}

runTests();
