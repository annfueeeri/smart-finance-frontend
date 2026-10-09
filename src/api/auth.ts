export type AuthUser = { username: string }
export type LoginCredentials = { username: string; password: string }

type CsrfToken = { token: string; headerName: string }

function request(path: string, options: RequestInit = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(15_000)
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  return fetch(path, {
    ...options,
    headers,
    cache: 'no-store',
    credentials: 'same-origin',
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
}

async function authenticatedUser(response: Response): Promise<AuthUser> {
  const body = await responseBody(response)
  if (!body || typeof body !== 'object' || !('username' in body)
      || typeof body.username !== 'string' || !body.username) {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
  return { username: body.username }
}

export class AuthApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return
  const body: unknown = await response.json().catch(() => null)
  const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
    ? body.code : 'REQUEST_FAILED'
  throw new AuthApiError(response.status, code)
}

async function csrfToken(signal?: AbortSignal): Promise<CsrfToken> {
  const response = await request('/api/auth/csrf', { signal })
  await checkResponse(response)
  const body = await responseBody(response)
  if (!body || typeof body !== 'object' || !('token' in body) || !('headerName' in body)
      || typeof body.token !== 'string' || !body.token
      || typeof body.headerName !== 'string' || !body.headerName) {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
  return { token: body.token, headerName: body.headerName }
}

export async function login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthUser> {
  const csrf = await csrfToken(signal)
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(credentials),
    signal,
  })
  await checkResponse(response)
  return authenticatedUser(response)
}

export async function currentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  const response = await request('/api/auth/me', { signal })
  if (response.status === 401) return null
  await checkResponse(response)
  return authenticatedUser(response)
}

export async function logout(): Promise<void> {
  // Login rotates both the Session ID and CSRF token. Fetch the current token for every mutation.
  const csrf = await csrfToken()
  const response = await request('/api/auth/logout', {
    method: 'POST',
    headers: { [csrf.headerName]: csrf.token },
  })
  if (response.status === 401) return // The session has already expired.
  await checkResponse(response)
  if (response.status !== 204) throw new AuthApiError(502, 'INVALID_RESPONSE')
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return '接続がタイムアウトしました。もう一度お試しください。'
  }
  if (error instanceof AuthApiError) {
    if (error.code === 'INVALID_RESPONSE') return 'サーバーから正しい応答を受信できませんでした。'
    if (error.code === 'INVALID_CREDENTIALS') return 'ユーザー名またはパスワードが正しくありません。'
    if (error.status === 400) return '入力内容を確認してください。'
    if (error.status === 403) return 'セキュリティ確認の期限が切れました。もう一度お試しください。'
    if (error.status === 429) return '試行回数が多すぎます。しばらく待ってからお試しください。'
  }
  return 'サーバーに接続できませんでした。時間をおいて、もう一度お試しください。'
}
