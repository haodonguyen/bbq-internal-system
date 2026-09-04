import { getSelectedUserId } from './session';

/**
 * Server components talk to the API container directly; the browser goes through
 * the published port. One wrapper so the auth header is attached in exactly one
 * place.
 */
function baseUrl(): string {
  // 127.0.0.1 rather than localhost: Node's fetch resolves `localhost` to ::1
  // first, which misses an API bound to IPv4 only.
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:3001/api'
  );
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Raised when no user is selected — the app shows the switcher instead of an error. */
export class NoUserSelectedError extends Error {}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the auth header, for the dev user list. */
  anonymous?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (!anonymous) {
    const userId = await getSelectedUserId();
    if (!userId) throw new NoUserSelectedError('No user selected');
    finalHeaders.set('X-User-Id', userId);
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: payload,
    // Issue data changes constantly and is per-user scoped; never serve it stale.
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((data) =>
        Array.isArray(data?.message) ? data.message.join(', ') : data?.message,
      )
      .catch(() => null);
    throw new ApiError(response.status, message ?? response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
