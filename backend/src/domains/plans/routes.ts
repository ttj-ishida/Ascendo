import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { chatTurn, createPlan, getDraft } from './service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';
import type { ChatMessage } from '../../types.ts';

export interface PlansRouterDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  createUserClient: (accessToken: string) => SupabaseClient;
}

function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as { role?: unknown }).role !== undefined &&
        ['user', 'assistant'].includes((m as { role: string }).role) &&
        typeof (m as { content?: unknown }).content === 'string',
    )
  );
}

export function createPlansRouter(deps: PlansRouterDeps): Router {
  const router = Router();

  router.get('/draft', async (req: AuthedRequest, res, next) => {
    try {
      const targetLang = typeof req.query.targetLang === 'string' ? req.query.targetLang : 'en';
      const userClient = deps.createUserClient(req.user!.accessToken);
      const draft = await getDraft({ userClient }, { userId: req.user!.id, targetLang });
      res.status(200).json(draft ?? { messages: [], readyToGenerate: false });
    } catch (err) {
      next(err);
    }
  });

  router.post('/chat', async (req: AuthedRequest, res, next) => {
    try {
      const { targetLang, messages } = req.body as { targetLang?: unknown; messages?: unknown };
      if (typeof targetLang !== 'string' || !isChatMessageArray(messages)) {
        throw new AppError('INVALID_MESSAGES', 'targetLang must be a string and messages must be a ChatMessage[]');
      }

      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await chatTurn(
        { aiAdapter: deps.aiAdapter, serviceClient: deps.serviceClient, userClient },
        { targetLang, messages, userId: req.user!.id },
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: AuthedRequest, res, next) => {
    try {
      const { targetLang, messages } = req.body as { targetLang?: unknown; messages?: unknown };
      if (typeof targetLang !== 'string' || !isChatMessageArray(messages)) {
        throw new AppError('INVALID_MESSAGES', 'targetLang must be a string and messages must be a ChatMessage[]');
      }

      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await createPlan(
        { aiAdapter: deps.aiAdapter, serviceClient: deps.serviceClient, userClient },
        { userId: req.user!.id, targetLang, messages },
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
