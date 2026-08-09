import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.ts';
import { createAssessment } from './service.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export interface AssessmentsRouterDeps {
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createAssessmentsRouter(deps: AssessmentsRouterDeps): Router {
  const router = Router();

  router.post('/', async (req: AuthedRequest, res, next) => {
    try {
      const { sourceGroupIds, itemCount } = req.body as { sourceGroupIds?: unknown; itemCount?: unknown };
      if (!Array.isArray(sourceGroupIds) || sourceGroupIds.some((g) => typeof g !== 'string') || typeof itemCount !== 'number') {
        throw new AppError('INSUFFICIENT_ITEMS', 'sourceGroupIds must be a string[] and itemCount a number');
      }

      const userClient = deps.createUserClient(req.user!.accessToken);
      const result = await createAssessment(
        { userClient },
        { userId: req.user!.id, sourceGroupIds, itemCount },
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
