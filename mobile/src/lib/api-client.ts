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
  const method = init.method ?? 'GET';
  const url = `${deps.baseUrl}${path}`;

  let response: Response;
  try {
    response = await deps.fetchFn(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deps.accessToken}`,
        ...init.headers,
      },
    });
  } catch (err) {
    // fetch() itself throwing (as opposed to resolving with a non-2xx Response) means the
    // request never reached the server: it's unreachable (not running / wrong baseUrl), a DNS
    // failure, or — on Web — a CORS-blocked response, which the browser also surfaces as a
    // generic failed fetch with no status code. Logging the raw error here is what lets the
    // browser/Metro console distinguish "server down" from "CORS" from "bad URL" without having
    // to add throwaway debug logs each time; the caller only sees the generic ApiError message.
    console.error(`[api-client] network error calling ${method} ${url}`, err);
    throw new ApiError('NETWORK_ERROR', 'サーバーに接続できませんでした');
  }

  const body = await response.json().catch((parseErr) => {
    console.error(`[api-client] ${method} ${url} returned a non-JSON body`, { status: response.status, parseErr });
    return null;
  });

  if (!response.ok) {
    console.error(`[api-client] ${method} ${url} failed`, { status: response.status, body });
    throw new ApiError(body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Request failed');
  }

  return body as T;
}
