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

  // CORS: written by hand (no `cors` package) since this is a dev/MVP backend and the only
  // clients are our own Expo apps — Origin is intentionally unrestricted rather than pinned to
  // one dev-server port, since Expo Web's port and any LAN/tunnel URL vary across environments,
  // and every route below still requires a valid Supabase bearer token regardless of origin.
  // Native (Android/iOS) requests aren't subject to CORS at all; this only matters for Expo Web,
  // where a fetch() to a different origin (Metro's :8081 talking to the backend's :3000) that
  // gets no CORS headers back fails as an opaque "network error" with no status code at all —
  // found via real Web testing (the plan-creation chat's "通信エラーが発生しました" gave no clue
  // it was CORS specifically until this was traced).
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Request logging: every request gets one line with its outcome (status + duration). This is
  // the permanent replacement for the throwaway console.log statements repeatedly added and
  // removed during manual testing earlier — with this always on, the terminal running `npm
  // start`/`npm run dev` is enough on its own to see which request failed and why, without
  // re-instrumenting the code each time.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

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
