import { OpenAI } from 'openai';
import { config } from '../config';

let singleton: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (!singleton) {
    if (!config.apiKey) {
      throw new Error('Missing API key for AI provider');
    }
    singleton = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }
  return singleton;
}


