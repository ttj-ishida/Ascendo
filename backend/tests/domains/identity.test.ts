import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAccount } from '../../src/domains/identity/service.ts';
import { AppError } from '../../src/shared/errors.ts';

test('deleteAccount calls auth.admin.deleteUser when confirmation matches', async () => {
  let deletedId: string | undefined;
  const serviceClient = { auth: { admin: { deleteUser: (id: string) => { deletedId = id; return Promise.resolve({ error: null }); } } } };

  await deleteAccount({ serviceClient }, { userId: '11111111-1111-1111-1111-111111111111', confirmation: 'DELETE' });

  assert.equal(deletedId, '11111111-1111-1111-1111-111111111111');
});

test('deleteAccount rejects a wrong confirmation string without calling deleteUser', async () => {
  let called = false;
  const serviceClient = { auth: { admin: { deleteUser: () => { called = true; return Promise.resolve({ error: null }); } } } };

  await assert.rejects(
    () => deleteAccount({ serviceClient }, { userId: 'x', confirmation: 'delete' }),
    (err: unknown) => err instanceof AppError && err.code === 'CONFIRMATION_MISMATCH',
  );
  assert.equal(called, false);
});

test('deleteAccount surfaces a Supabase error', async () => {
  const serviceClient = { auth: { admin: { deleteUser: () => Promise.resolve({ error: { message: 'user not found' } }) } } };

  await assert.rejects(() => deleteAccount({ serviceClient }, { userId: 'x', confirmation: 'DELETE' }));
});
