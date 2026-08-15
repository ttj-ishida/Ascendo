import { callApi, ApiError } from '../api-client';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response) as typeof fetch;
}

test('callApi returns the parsed JSON body on success', async () => {
  const result = await callApi(
    { fetchFn: fakeFetch(200, { reply: 'hi', readyToGenerate: false }), baseUrl: 'http://x', accessToken: 'tok' },
    '/api/v1/plans/chat',
    { method: 'POST' },
  );
  expect(result).toEqual({ reply: 'hi', readyToGenerate: false });
});

test('callApi sends the Authorization header and joins baseUrl + path', async () => {
  let capturedUrl: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedHeaders = init.headers as Record<string, string>;
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  }) as typeof fetch;

  await callApi({ fetchFn, baseUrl: 'http://localhost:3000', accessToken: 'tok-123' }, '/api/v1/plans');

  expect(capturedUrl).toBe('http://localhost:3000/api/v1/plans');
  expect(capturedHeaders?.Authorization).toBe('Bearer tok-123');
});

test('callApi throws ApiError with the code/message from the error envelope on failure', async () => {
  await expect(
    callApi(
      { fetchFn: fakeFetch(403, { error: { code: 'FREE_QUOTA_EXHAUSTED', message: 'no quota left' } }), baseUrl: 'http://x', accessToken: 'tok' },
      '/api/v1/plans',
    ),
  ).rejects.toThrow(ApiError);

  try {
    await callApi(
      { fetchFn: fakeFetch(403, { error: { code: 'FREE_QUOTA_EXHAUSTED', message: 'no quota left' } }), baseUrl: 'http://x', accessToken: 'tok' },
      '/api/v1/plans',
    );
  } catch (err) {
    expect((err as ApiError).code).toBe('FREE_QUOTA_EXHAUSTED');
    expect((err as ApiError).message).toBe('no quota left');
  }
});
