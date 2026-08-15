import { deleteAccount } from '../delete-account';

test('deleteAccount calls DELETE /api/v1/identity/me with confirmation: "DELETE"', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, status: 204, json: async () => ({}) } as Response;
  }) as typeof fetch;

  await deleteAccount({ fetchFn, baseUrl: 'http://x', accessToken: 'tok' });

  expect(capturedUrl).toBe('http://x/api/v1/identity/me');
  expect(capturedInit?.method).toBe('DELETE');
  expect(JSON.parse(capturedInit?.body as string)).toEqual({ confirmation: 'DELETE' });
});
