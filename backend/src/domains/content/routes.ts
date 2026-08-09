import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAudio } from './service.ts';
import type { AiAdapter } from '../../shared/ai-adapter.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export interface ContentRouterDeps {
  aiAdapter: AiAdapter;
  serviceClient: Pick<SupabaseClient, 'from'>;
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createContentRouter(deps: ContentRouterDeps): Router {
  const router = Router();

  router.post('/listening-passages/:id/audio', async (req: AuthedRequest, res, next) => {
    try {
      const { voice, forceRegenerate } = req.body as { voice?: unknown; forceRegenerate?: unknown };
      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await generateAudio(
        { aiAdapter: deps.aiAdapter, serviceClient: deps.serviceClient, userClient },
        {
          passageId: req.params.id,
          voice: typeof voice === 'string' ? voice : undefined,
          forceRegenerate: forceRegenerate === true,
        },
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
