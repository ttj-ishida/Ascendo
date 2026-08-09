import { Router } from 'express';
import { AppError } from '../../shared/errors.ts';
import { deleteAccount, type IdentityServiceDeps } from './service.ts';
import type { AuthedRequest } from '../../shared/auth/middleware.ts';

export function createIdentityRouter(deps: IdentityServiceDeps): Router {
  const router = Router();

  router.delete('/me', async (req: AuthedRequest, res, next) => {
    try {
      const { confirmation } = req.body as { confirmation?: unknown };
      if (typeof confirmation !== 'string') {
        throw new AppError('CONFIRMATION_MISMATCH', 'confirmation must be exactly "DELETE"');
      }

      await deleteAccount(deps, { userId: req.user!.id, confirmation });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
