import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const accessCookie = 'wa-access';
const refreshCookie = 'wa-refresh';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
type Session = { access_token: string; refresh_token: string; expires_in: number };
type BusinessPath = '/businesses' | `/businesses/${string}`;
class InvalidRequest extends Error {}

function configuration() {
  const origin = process.env.WEB_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
  const internal = process.env.API_INTERNAL_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3001');
  const api = new URL(internal);
  const web = new URL(origin);
  if (!['http:', 'https:'].includes(api.protocol) || api.origin !== internal
    || !['http:', 'https:'].includes(web.protocol) || web.origin !== origin) throw new Error('Invalid server configuration');
  const secret = process.env.WEB_AUTH_SECRET;
  if (!secret) throw new Error('Missing web authentication configuration');
  return { api: api.origin, origin, secret };
}

export function reply(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

function clear(response: NextResponse): NextResponse {
  for (const name of [accessCookie, refreshCookie]) response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
  return response;
}

function store(response: NextResponse, value: Session): NextResponse {
  response.cookies.set(accessCookie, value.access_token, { ...cookieOptions, maxAge: value.expires_in });
  response.cookies.set(refreshCookie, value.refresh_token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  return response;
}

function session(value: unknown): Session {
  const result = value as Partial<Session> | null;
  if (!result || typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 3800
    || typeof result.refresh_token !== 'string' || !result.refresh_token || result.refresh_token.length > 3800
    || typeof result.expires_in !== 'number' || !Number.isInteger(result.expires_in) || result.expires_in <= 0) throw new Error('Invalid upstream session');
  return result as Session;
}

function checkOrigin(request: NextRequest, mutate: boolean): NextResponse | undefined {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin !== null && origin !== configuration().origin)
    || (mutate && (origin === null || request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'))) {
    return reply({ message: 'Request origin is not allowed' }, 403);
  }
}

async function json(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidRequest();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new InvalidRequest(); }
    chunks.push(chunk.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new InvalidRequest(); }
}

async function upstream(path: string, method: 'GET' | 'POST', body?: unknown, token?: string): Promise<Response> {
  const config = configuration();
  return fetch(config.api + path, {
    method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: {
      'Content-Type': 'application/json',
      ...(path.startsWith('/auth/web/') ? { 'X-Web-Auth-Key': config.secret } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function failure(response: Response): NextResponse {
  const status = [400, 401, 403, 404, 409, 429].includes(response.status) ? response.status : 503;
  const messages: Record<number, string> = {
    400: 'Invalid request', 401: 'Invalid or expired session', 403: 'Access denied',
    404: 'Business not found', 409: 'Request conflicts with current data', 429: 'Too many requests; try again later',
  };
  const result = reply({ message: messages[status] ?? 'Service is temporarily unavailable' }, status);
  const retry = response.headers.get('retry-after');
  if (retry && /^\d+$/.test(retry)) result.headers.set('Retry-After', retry);
  return result;
}

async function renew(request: NextRequest): Promise<Session | Response> {
  const refresh = request.cookies.get(refreshCookie)?.value;
  if (!refresh) return new Response(null, { status: 401 });
  const response = await upstream('/auth/web/refresh', 'POST', { refresh_token: refresh });
  return response.ok ? session(await response.json()) : response;
}

export async function login(request: NextRequest): Promise<NextResponse> {
  try {
    const rejected = checkOrigin(request, true);
    if (rejected) return rejected;
    const response = await upstream('/auth/web/login', 'POST', await json(request));
    if (!response.ok) return clear(failure(response));
    return store(reply({ authenticated: true }), session(await response.json()));
  } catch (error) {
    return reply({ message: error instanceof InvalidRequest ? 'Invalid JSON request' : 'Service is temporarily unavailable' }, error instanceof InvalidRequest ? 400 : 503);
  }
}

export async function recover(request: NextRequest, action: 'request' | 'complete'): Promise<NextResponse> {
  try {
    const rejected = checkOrigin(request, true);
    if (rejected) return rejected;
    const response = await upstream('/auth/web/recover/' + action, 'POST', await json(request));
    if (!response.ok) return failure(response);
    // Upstream recovery responses are deliberately not forwarded: recovery never exposes a session.
    return action === 'complete'
      ? clear(reply({ status: 'password_updated', authenticated: false }))
      : reply({ status: 'recovery_requested' });
  } catch (error) {
    return reply({ message: error instanceof InvalidRequest ? 'Invalid JSON request' : 'Service is temporarily unavailable' }, error instanceof InvalidRequest ? 400 : 503);
  }
}

export async function logout(request: NextRequest): Promise<NextResponse> {
  try {
    const rejected = checkOrigin(request, true);
    if (rejected) return rejected;
  } catch {
    return reply({ message: 'Service is temporarily unavailable' }, 503);
  }
  const signedOut = (status = 200) => clear(reply({
    authenticated: false,
    ...(status === 200 ? {} : { message: 'Signed out locally; remote session revocation could not be confirmed' }),
  }, status));
  const revocationFailure = (response: Response) => {
    const failed = failure(response);
    const result = signedOut(failed.status);
    const retry = failed.headers.get('retry-after');
    if (retry) result.headers.set('Retry-After', retry);
    return result;
  };
  try {
    let token = request.cookies.get(accessCookie)?.value;
    if (!token && request.cookies.has(refreshCookie)) {
      const refreshed = await renew(request);
      if (refreshed instanceof Response) return refreshed.status === 401 ? signedOut() : revocationFailure(refreshed);
      token = refreshed.access_token;
    }
    if (token) {
      let response = await upstream('/auth/web/logout', 'POST', { access_token: token });
      if (response.status === 401 && request.cookies.has(refreshCookie)) {
        const refreshed = await renew(request);
        if (refreshed instanceof Response) return refreshed.status === 401 ? signedOut() : revocationFailure(refreshed);
        response = await upstream('/auth/web/logout', 'POST', { access_token: refreshed.access_token });
      }
      if (!response.ok && response.status !== 401) return revocationFailure(response);
    }
    return signedOut();
  } catch {
    return signedOut(503);
  }
}

export async function businesses(request: NextRequest, path: BusinessPath, method: 'GET' | 'POST'): Promise<NextResponse> {
  let refreshed: Session | undefined;
  try {
    const rejected = checkOrigin(request, method === 'POST');
    if (rejected) return rejected;
    if (path !== '/businesses' && !/^\/businesses\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path)) return reply({ message: 'Invalid business identifier' }, 400);
    const body = method === 'POST' ? await json(request) : undefined;
    let token = request.cookies.get(accessCookie)?.value;
    if (!token) {
      const renewal = await renew(request);
      if (renewal instanceof Response) return renewal.status === 401 ? clear(failure(renewal)) : failure(renewal);
      refreshed = renewal;
      token = renewal.access_token;
    }
    let response = await upstream(path, method, body, token);
    if (response.status === 401 && !refreshed) {
      const renewal = await renew(request);
      if (renewal instanceof Response) return renewal.status === 401 ? clear(failure(renewal)) : failure(renewal);
      refreshed = renewal;
      response = await upstream(path, method, body, renewal.access_token);
    }
    const result = response.ok ? reply(await response.json(), response.status) : failure(response);
    if (response.status === 401) return clear(result);
    return refreshed ? store(result, refreshed) : result;
  } catch (error) {
    const response = reply({ message: error instanceof InvalidRequest ? 'Invalid JSON request' : 'Service is temporarily unavailable' }, error instanceof InvalidRequest ? 400 : 503);
    return refreshed ? store(response, refreshed) : response;
  }
}
