import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not found in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName: string) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Hello, what model are you?',
    });
    console.log(`✅ Success with ${modelName}! Response: ${response.text?.substring(0, 50)}...`);
  } catch (err: any) {
    console.log(`❌ Failed with ${modelName}: ${err.message}`);
  }
}

async function main() {
  await testModel('gemini-2.5-flash');
  await testModel('gemini-2.5-flash-lite');
  await testModel('gemini-3.1-flash-lite');
}

main();
