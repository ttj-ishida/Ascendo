import { AppError } from '../../shared/errors.ts';

export interface IdentityServiceDeps {
  serviceClient: {
    auth: { admin: { deleteUser: (id: string) => Promise<{ error: { message: string } | null }> } };
  };
}

export async function deleteAccount(
  deps: IdentityServiceDeps,
  params: { userId: string; confirmation: string },
): Promise<void> {
  if (params.confirmation !== 'DELETE') {
    throw new AppError('CONFIRMATION_MISMATCH', 'confirmation must be exactly "DELETE"');
  }

  const { error } = await deps.serviceClient.auth.admin.deleteUser(params.userId);
  if (error) {
    throw new Error(`failed to delete account: ${error.message}`);
  }
}
