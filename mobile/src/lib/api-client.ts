export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function callApi<T>(
  deps: { fetchFn: typeof fetch; baseUrl: string; accessToken: string },
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await deps.fetchFn(`${deps.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deps.accessToken}`,
      ...init.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Request failed');
  }

  return body as T;
}
