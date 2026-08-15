import { callApi } from '../../lib/api-client';

export async function deleteAccount(deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string }): Promise<void> {
  await callApi(deps, '/api/v1/identity/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
}
