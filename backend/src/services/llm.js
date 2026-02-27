import OpenAI from 'openai';
import { getSetting } from './database.js';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY || getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured. Set it via environment variable or settings API.');
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function resetClient() {
  client = null;
}

export async function llmCall(systemPrompt, userPrompt, options = {}) {
  const model = options.model || getSetting('openai_model') || 'gpt-4o';
  const temperature = options.temperature ?? 0.2;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await getClient().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: options.maxTokens || 16000,
    response_format: options.json ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content || '';
  return content;
}

export async function llmJsonCall(systemPrompt, userPrompt, options = {}) {
  const raw = await llmCall(systemPrompt, userPrompt, { ...options, json: true });
  try {
    return JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse LLM JSON response: ${raw.substring(0, 200)}`);
  }
}