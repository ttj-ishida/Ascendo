import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorHandler } from './shared/errors.ts';
import { createAuthMiddleware, createAdminGuard } from './shared/auth/middleware.ts';
import type { TokenPayload } from './shared/auth/verify.ts';
import type { AiAdapter } from './shared/ai-adapter.ts';
import { createPlansRouter } from './domains/plans/routes.ts';
import { createContentRouter } from './domains/content/routes.ts';
import { createAssessmentsRouter } from './domains/assessments/routes.ts';
import { createIdentityRouter } from './domains/identity/routes.ts';
import type { IdentityServiceDeps } from './domains/identity/service.ts';

export interface AppDeps {
  verify: (token: string) => Promise<TokenPayload>;
  isAdmin: (accessToken: string) => Promise<boolean>;
  aiAdapter: AiAdapter;
  serviceClient: SupabaseClient & IdentityServiceDeps['serviceClient'];
  createUserClient: (accessToken: string) => SupabaseClient;
}

export function createApp(deps?: AppDeps) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  if (deps) {
    const authMiddleware = createAuthMiddleware(deps.verify);
    const adminGuard = createAdminGuard(deps.isAdmin);

    const v1 = express.Router();
    v1.use('/plans', authMiddleware, createPlansRouter(deps));
    v1.use('/content', authMiddleware, adminGuard, createContentRouter(deps));
    v1.use('/assessments', authMiddleware, createAssessmentsRouter(deps));
    v1.use('/identity', authMiddleware, createIdentityRouter(deps));

    app.use('/api/v1', v1);
  }

  app.use(errorHandler);

  return app;
}
