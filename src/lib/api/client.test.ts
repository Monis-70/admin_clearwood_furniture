import { http, HttpResponse, delay } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API,
  backend,
  callsTo,
  errorBody,
  expireAccessToken,
  guarded,
  ok,
  signInAs,
  account,
} from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';

import { apiPage, apiRequest } from './client';
import { SESSION, endpoint, requires } from './endpoint';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { onSessionEvent, type SessionEvent } from './session-events';

const listUsers = endpoint('GET', '/admin/users', { access: requires('system.user.read') });
const updateUser = endpoint('PATCH', '/admin/users/{id}', {
  access: requires('system.user.update'),
});
const createThing = endpoint('POST', '/admin/things', { access: SESSION, idempotent: true });

function captureEvents() {
  const events: SessionEvent[] = [];
  const stop = onSessionEvent((event) => events.push(event));
  return { events, stop };
}

describe('apiRequest', () => {
  it('unwraps the success envelope and sends a valid request id', async () => {
    signInAs();
    const result = await apiRequest(endpoints.auth.me);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ user: { email: 'priya@clearwood.test' } });
    const call = callsTo('/api/v1/admin/auth/me')[0]!;
    expect(call.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('returns items and pagination meta for lists', async () => {
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.has('search')).toBe(false);
        return ok([{ id: 'u1' }], 200, {
          page: 2,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNext: false,
        });
      }),
    );
    signInAs();
    const page = await apiPage<{ id: string }>(listUsers, {
      query: { page: 2, limit: 25, search: '' },
    });
    expect(page.items).toEqual([{ id: 'u1' }]);
    expect(page.meta.totalPages).toBe(2);
  });

  it('echoes the CSRF cookie on mutations only, and encodes path parameters once', async () => {
    let seenPath = '';
    server.use(
      http.patch(`${API}/admin/users/:id`, ({ request, params }) => {
        seenPath = new URL(request.url).pathname;
        expect(params.id).toBe('a/b');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-adm_1');
        return ok({ id: params.id });
      }),
    );
    signInAs();
    await apiRequest(updateUser, { params: { id: 'a/b' }, body: { name: 'New' } });
    expect(seenPath).toBe('/api/v1/admin/users/a%2Fb');
    await apiRequest(endpoints.auth.me);
    expect(callsTo('/api/v1/admin/auth/me')[0]!.csrf).toBeNull();
  });

  it('sends the idempotency key and reports replays', async () => {
    server.use(
      http.post(`${API}/admin/things`, ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('key-12345678');
        return HttpResponse.json(
          { success: true, data: { id: 't1' }, meta: null },
          { headers: { 'Idempotent-Replay': 'true' } },
        );
      }),
    );
    signInAs();
    const result = await apiRequest(createThing, { body: {}, idempotencyKey: 'key-12345678' });
    expect(result.replayed).toBe(true);
  });

  it('turns the error envelope into an ApiError with code, details and trace id', async () => {
    server.use(
      http.patch(`${API}/admin/users/:id`, () =>
        errorBody(409, 'STALE_RESOURCE', 'This record changed', {
          yourVersion: 1,
          currentVersion: 2,
        }),
      ),
    );
    signInAs();
    const error = await apiRequest(updateUser, { params: { id: 'u1' }, body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'STALE_RESOURCE',
      details: { yourVersion: 1, currentVersion: 2 },
      method: 'PATCH',
      path: '/admin/users/{id}',
    });
    expect((error as ApiError).traceId).toMatch(/^trace-/);
  });

  it.each([
    [413, 'PAYLOAD_TOO_LARGE_PROXY'],
    [502, 'UPSTREAM_UNAVAILABLE'],
    [503, 'UPSTREAM_UNAVAILABLE'],
    [504, 'GATEWAY_TIMEOUT'],
    [429, 'RATE_LIMITED_PROXY'],
    [500, 'UNEXPECTED_RESPONSE'],
  ])('maps a non-JSON %i from the proxy to %s', async (status, code) => {
    server.use(
      http.get(
        `${API}/admin/users`,
        () =>
          new HttpResponse('<html>nginx</html>', {
            status,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    signInAs();
    await expect(apiPage(listUsers)).rejects.toMatchObject({ status, code });
  });

  it('reads Retry-After on rate limits', async () => {
    server.use(
      http.get(`${API}/admin/users`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              details: null,
              traceId: 't',
            },
          },
          { status: 429, headers: { 'Retry-After': '42' } },
        ),
      ),
    );
    signInAs();
    await expect(apiPage(listUsers)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
  });

  it('reports a network failure without an HTTP status', async () => {
    server.use(http.get(`${API}/admin/users`, () => HttpResponse.error()));
    signInAs();
    await expect(apiPage(listUsers)).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('times out slow requests', async () => {
    server.use(
      http.get(`${API}/admin/users`, async () => {
        await delay(200);
        return ok([]);
      }),
    );
    signInAs();
    await expect(apiPage(listUsers, { timeoutMs: 30 })).rejects.toMatchObject({
      status: 0,
      code: 'TIMEOUT',
    });
  });

  it('lets a caller abort without turning it into an API error', async () => {
    server.use(
      http.get(`${API}/admin/users`, async () => {
        await delay(200);
        return ok([]);
      }),
    );
    signInAs();
    const controller = new AbortController();
    const pending = apiPage(listUsers, { signal: controller.signal });
    controller.abort();
    const error = await pending.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});

describe('session renewal', () => {
  it('renews once and retries when the access token expired', async () => {
    signInAs();
    expireAccessToken();
    const { events, stop } = captureEvents();
    const result = await apiRequest(endpoints.auth.me);
    stop();
    expect(result.status).toBe(200);
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(1);
    expect(callsTo('/api/v1/admin/auth/me')).toHaveLength(2);
    expect(events.map((e) => e.type)).toEqual(['renewed']);
  });

  it('shares one renewal between concurrent requests (no token reuse)', async () => {
    signInAs();
    expireAccessToken();
    const results = await Promise.all([
      apiRequest(endpoints.auth.me),
      apiRequest(endpoints.auth.me),
      apiRequest(endpoints.auth.me),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(1);
    expect(backend.session).not.toBeNull();
  });

  it('renews when the access cookie is simply gone (NOT_AUTHENTICATED)', async () => {
    signInAs();
    let first = true;
    server.use(
      http.get(`${API}/admin/auth/me`, async ({ request }) => {
        if (first) {
          first = false;
          return errorBody(401, 'NOT_AUTHENTICATED', 'Authentication required');
        }
        return (await import('@/tests/msw/backend')).ok({
          ok: true,
          csrf: request.headers.get('x-csrf-token'),
        });
      }),
    );
    await expect(apiRequest(endpoints.auth.me)).resolves.toMatchObject({ status: 200 });
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(1);
  });

  it('ends the session with the reason when the refresh token was reused', async () => {
    signInAs();
    expireAccessToken();
    backend.session!.used.add('rt-1');
    const { events, stop } = captureEvents();
    const error = await apiRequest(endpoints.auth.me).catch((e: unknown) => e);
    stop();
    expect(error).toMatchObject({
      code: 'SESSION_ENDED',
      details: { reason: 'reuse', cause: 'TOKEN_REUSE' },
    });
    expect(events).toEqual([{ type: 'ended', reason: 'reuse' }]);
  });

  it('keeps the session when the renewal fails for a network reason', async () => {
    signInAs();
    expireAccessToken();
    server.use(http.post(`${API}/admin/auth/refresh`, () => HttpResponse.error()));
    const { events, stop } = captureEvents();
    await expect(apiRequest(endpoints.auth.me)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    stop();
    expect(events).toEqual([]);
  });

  it('never renews for sign-in failures', async () => {
    const error = await apiRequest(endpoints.auth.login, {
      body: { email: 'priya@clearwood.test', password: 'wrong' },
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(0);
  });

  it('never sends a refresh token in the body', async () => {
    signInAs();
    expireAccessToken();
    await apiRequest(endpoints.auth.me);
    expect(callsTo('/api/v1/admin/auth/refresh')[0]!.body).toEqual({});
  });
});

describe('403 handling', () => {
  it('retries once with the cookie re-read after CSRF_TOKEN_INVALID', async () => {
    signInAs();
    let attempts = 0;
    server.use(
      http.post(`${API}/admin/things`, () => {
        attempts += 1;
        return attempts === 1
          ? errorBody(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token')
          : ok({ id: 't1' });
      }),
    );
    await expect(apiRequest(createThing, { body: {} })).resolves.toMatchObject({
      data: { id: 't1' },
    });
    expect(attempts).toBe(2);
  });

  it('reports PASSWORD_CHANGE_REQUIRED and FORBIDDEN to the session layer', async () => {
    signInAs(account({ id: 'adm_2', email: 'new@clearwood.test', mustChangePassword: true }));
    server.use(
      http.get(`${API}/admin/users`, () =>
        errorBody(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password'),
      ),
    );
    const { events, stop } = captureEvents();
    await expect(apiPage(listUsers)).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    server.use(
      http.get(`${API}/admin/users`, () =>
        errorBody(403, 'FORBIDDEN', 'No', { required: ['system.user.read'] }),
      ),
    );
    await expect(apiPage(listUsers)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    stop();
    expect(events.map((e) => e.type)).toEqual(['password-change-required', 'forbidden']);
  });
});

describe('Web Lock coordination', () => {
  it('asks for the renewal lock before refreshing', async () => {
    const request = vi.fn(
      async (_name: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
        const callback = (
          typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
        ) as (lock: unknown) => unknown;
        return callback({ name: 'cw-adm-session-renewal' });
      },
    );
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { locks: { request } }));
    signInAs();
    expireAccessToken();
    await apiRequest(endpoints.auth.me);
    expect(request).toHaveBeenCalledWith(
      'cw-adm-session-renewal',
      { ifAvailable: true },
      expect.any(Function),
    );
    vi.unstubAllGlobals();
  });
});

describe('uploads with progress (XMLHttpRequest)', () => {
  const uploadForm = () => {
    const form = new FormData();
    form.append('files', new File([new Uint8Array(64)], 'sofa.png', { type: 'image/png' }));
    return form;
  };

  beforeEach(async () => {
    // The consistent FormData/File pair a browser has (see import-export-screen.test.tsx).
    const NodeFormData = (await new Response(new URLSearchParams('a=1')).formData())
      .constructor as typeof FormData;
    vi.stubGlobal('FormData', NodeFormData);
    vi.stubGlobal('File', NodeFile);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends the multipart body with CSRF and request id, not through fetch, and parses the envelope', async () => {
    let fileName: string | null = null;
    server.use(
      http.post(
        `${API}/admin/media/upload`,
        guarded(
          async (_account, request) => {
            const file = (await request.formData()).get('files');
            fileName = typeof file === 'string' ? null : (file?.name ?? null);
            return ok({ uploaded: [{ media: { id: 'med_1' }, deduplicated: false }] }, 201);
          },
          { csrf: true },
        ),
      ),
    );
    signInAs();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await apiRequest(endpoints.media.upload, {
      form: uploadForm(),
      onUploadProgress: () => undefined,
    });
    expect(result.status).toBe(201);
    expect(result.data).toEqual({ uploaded: [{ media: { id: 'med_1' }, deduplicated: false }] });
    expect(fileName).toBe('sofa.png');
    const call = callsTo('/api/v1/admin/media/upload', 'POST')[0]!;
    expect(call.csrf).toBe('csrf-adm_1');
    expect(call.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('turns an API refusal into an ApiError with the Retry-After the API sent', async () => {
    server.use(
      http.post(
        `${API}/admin/media/upload`,
        () =>
          new HttpResponse(
            JSON.stringify({
              success: false,
              error: { code: 'RATE_LIMITED', message: 'Too many uploads', traceId: 't-1' },
            }),
            {
              status: 429,
              headers: { 'content-type': 'application/json', 'retry-after': '7' },
            },
          ),
      ),
    );
    signInAs();
    const error = await apiRequest(endpoints.media.upload, {
      form: uploadForm(),
      onUploadProgress: () => undefined,
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 7 });
  });

  it('renews an expired session once and sends the same upload again', async () => {
    let attempts = 0;
    server.use(
      http.post(
        `${API}/admin/media/upload`,
        guarded(
          () => {
            attempts += 1;
            return ok({ uploaded: [] }, 201);
          },
          { csrf: true },
        ),
      ),
    );
    signInAs();
    expireAccessToken();
    await apiRequest(endpoints.media.upload, {
      form: uploadForm(),
      onUploadProgress: () => undefined,
    });
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(1);
    expect(attempts).toBe(1);
    expect(callsTo('/api/v1/admin/media/upload', 'POST')).toHaveLength(2);
  });

  it('rejects with AbortError when the caller cancels', async () => {
    server.use(
      http.post(`${API}/admin/media/upload`, async () => {
        await delay('infinite');
        return ok({});
      }),
    );
    signInAs();
    const controller = new AbortController();
    const pending = apiRequest(endpoints.media.upload, {
      form: uploadForm(),
      signal: controller.signal,
      onUploadProgress: () => undefined,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
