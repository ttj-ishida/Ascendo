import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AppError } from './errors.ts';
import type { ChatMessage, LearningPlanJSON } from '../types.ts';

export interface AiAdapter {
  chat(messages: ChatMessage[]): Promise<{ reply: string; readyToGenerate: boolean }>;
  generatePlan(messages: ChatMessage[], targetLang: string): Promise<LearningPlanJSON>;
  generateSpeech(text: string, voice?: string): Promise<{ audioBuffer: Buffer; costUsd: number }>;
}

const REQUIRED_PLAN_FIELDS = ['goal', 'currentLevel', 'weeklyAvailableHours', 'phases', 'contentGroupIds'] as const;

/** Extracts and validates a LearningPlanJSON from Claude's raw text response. */
export function parsePlanResponse(raw: string): LearningPlanJSON {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error('no ```json ... ``` block found in AI response');
  }

  const parsed = JSON.parse(match[1]) as Partial<LearningPlanJSON>;
  for (const field of REQUIRED_PLAN_FIELDS) {
    if (!(field in parsed)) {
      throw new Error(`AI-generated plan is missing required field "${field}"`);
    }
  }

  return parsed as LearningPlanJSON;
}

const READY_TO_GENERATE_MARKER = '[READY_TO_GENERATE]';

export function createAiAdapter(config: { anthropicApiKey: string; openaiApiKey: string }): AiAdapter {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  return {
    async chat(messages) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          system:
            'You are helping a user build an English-learning plan. Ask about their goal, current level, ' +
            `and weekly available hours. Once you have all three, end your reply with exactly the marker ` +
            `${READY_TO_GENERATE_MARKER} on its own line.`,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        const readyToGenerate = text.includes(READY_TO_GENERATE_MARKER);
        return { reply: text.replace(READY_TO_GENERATE_MARKER, '').trim(), readyToGenerate };
      } catch (err) {
        throw new AppError('AI_PROVIDER_ERROR', 'Claude chat request failed', { cause: String(err) });
      }
    },

    async generatePlan(messages, targetLang) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 4096,
          system:
            `Produce a JSON learning plan for target language "${targetLang}" as a single ` +
            '```json ... ``` code block matching the LearningPlanJSON schema. No prose outside the block.',
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        return parsePlanResponse(text);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('AI_PROVIDER_ERROR', 'Claude plan generation failed', { cause: String(err) });
      }
    },

    async generateSpeech(text, voice = 'alloy') {
      try {
        const response = await openai.audio.speech.create({ model: 'tts-1', voice, input: text });
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const costUsd = (text.length / 1000) * 0.015; // tts-1 pricing: $0.015 / 1K characters
        return { audioBuffer, costUsd };
      } catch (err) {
        throw new AppError('AI_PROVIDER_ERROR', 'OpenAI TTS request failed', { cause: String(err) });
      }
    },
  };
}
