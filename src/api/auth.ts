import { API_ENDPOINTS } from './endpoints'
import type { ApiEndpoint } from './endpoints'

export type UserRole = 'ADMIN' | 'USER'
export type AuthUser = { username: string; role: UserRole }
export type ManagedUser = AuthUser & {
  id: number
  enabled: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  isDeleted: boolean
}
export type LoginCredentials = { username: string; password: string }
export type RegisterCredentials = LoginCredentials & { confirmPassword: string }

type CsrfToken = { token: string; headerName: string }

function request(endpoint: ApiEndpoint, options: RequestInit = {}): Promise<Response> {
  const timeout = AbortSignal.timeout(15_000)
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  return fetch(endpoint.path, {
    ...options,
    method: endpoint.method,
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
      || typeof body.username !== 'string' || !body.username || !('role' in body)
      || (body.role !== 'ADMIN' && body.role !== 'USER')) {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
  return { username: body.username, role: body.role }
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
  const response = await request(API_ENDPOINTS.csrf, { signal })
  await checkResponse(response)
  const body = await responseBody(response)
  if (!body || typeof body !== 'object' || !('token' in body) || !('headerName' in body)
      || typeof body.token !== 'string' || !body.token
      || typeof body.headerName !== 'string' || !body.headerName) {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
  return { token: body.token, headerName: body.headerName }
}

export async function register(credentials: RegisterCredentials, signal?: AbortSignal): Promise<AuthUser> {
  const csrf = await csrfToken(signal)
  const response = await request(API_ENDPOINTS.register, {
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(credentials),
    signal,
  })
  await checkResponse(response)
  if (response.status !== 201) throw new AuthApiError(502, 'INVALID_RESPONSE')
  return authenticatedUser(response)
}

export async function login(credentials: LoginCredentials, signal?: AbortSignal): Promise<AuthUser> {
  const csrf = await csrfToken(signal)
  const response = await request(API_ENDPOINTS.login, {
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify(credentials),
    signal,
  })
  await checkResponse(response)
  return authenticatedUser(response)
}

export async function currentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  const response = await request(API_ENDPOINTS.currentUser, { signal })
  if (response.status === 401) return null
  await checkResponse(response)
  return authenticatedUser(response)
}

export async function logout(): Promise<void> {
  // Login rotates both the Session ID and CSRF token. Fetch the current token for every mutation.
  const csrf = await csrfToken()
  const response = await request(API_ENDPOINTS.logout, {
    headers: { [csrf.headerName]: csrf.token },
  })
  if (response.status === 401) return // The session has already expired.
  await checkResponse(response)
  if (response.status !== 204) throw new AuthApiError(502, 'INVALID_RESPONSE')
}

/** 校验用户一览和身份修改响应，确保字段完整对应，仅提取基本信息和审计字段。 */
function managedUser(body: unknown): ManagedUser {
  if (!body || typeof body !== 'object' || !('id' in body) || !('username' in body)
    || !('role' in body) || !('enabled' in body) || typeof body.id !== 'number'
    || !Number.isSafeInteger(body.id) || body.id <= 0 || typeof body.username !== 'string' || !body.username
    || (body.role !== 'ADMIN' && body.role !== 'USER') || typeof body.enabled !== 'boolean'
    || !('createdAt' in body) || typeof body.createdAt !== 'string' || !body.createdAt
    || !('createdBy' in body) || typeof body.createdBy !== 'string' || !body.createdBy
    || !('updatedAt' in body) || typeof body.updatedAt !== 'string' || !body.updatedAt
    || !('updatedBy' in body) || typeof body.updatedBy !== 'string' || !body.updatedBy
    || !('isDeleted' in body) || typeof body.isDeleted !== 'boolean') {
    throw new AuthApiError(502, 'INVALID_RESPONSE')
  }
  return {
    id: body.id, username: body.username, role: body.role, enabled: body.enabled,
    createdAt: body.createdAt, createdBy: body.createdBy, updatedAt: body.updatedAt,
    updatedBy: body.updatedBy, isDeleted: body.isDeleted,
  }
}

/** 请求 GET /api/users，查询范围由后端按当前会话身份决定，普通用户只收到自己。 */
export async function listUsers(signal?: AbortSignal): Promise<ManagedUser[]> {
  const response = await request(API_ENDPOINTS.listUsers, { signal })
  await checkResponse(response)
  const body = await responseBody(response)
  if (!Array.isArray(body)) throw new AuthApiError(502, 'INVALID_RESPONSE')
  return body.map(managedUser)
}

/** 携带当前会话的 CSRF 令牌修改目标账号身份，操作者和修改时间由后端记录。 */
export async function updateUserRole(id: number, role: UserRole, signal?: AbortSignal): Promise<ManagedUser> {
  const endpoint = API_ENDPOINTS.updateUserRole(id)
  const csrf = await csrfToken(signal)
  const response = await request(endpoint, {
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: JSON.stringify({ role }), signal,
  })
  await checkResponse(response)
  return managedUser(await responseBody(response))
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return '接続がタイムアウトしました。もう一度お試しください。'
  }
  if (error instanceof AuthApiError) {
    if (error.code === 'INVALID_RESPONSE') return 'サーバーから正しい応答を受信できませんでした。'
    if (error.code === 'INVALID_CREDENTIALS') return 'ユーザー名またはパスワードが正しくありません。'
    if (error.code === 'USERNAME_TAKEN') return 'このユーザー名はすでに登録されています。別のユーザー名をお試しください。'
    if (error.code === 'LAST_ADMIN') return '最後の有効な管理者は一般ユーザーに変更できません。先に別の管理者を指定してください。'
    if (error.code === 'USER_NOT_FOUND') return 'このユーザーは見つかりません。ユーザー一覧を更新してください。'
    if (error.status === 401) return 'セッションが切れました。もう一度ログインしてください。'
    if (error.status === 400) return '入力内容を確認してください。'
    if (error.status === 403) return 'セキュリティ確認の期限が切れました。もう一度お試しください。'
    if (error.status === 429) return '試行回数が多すぎます。しばらく待ってからお試しください。'
  }
  return 'サーバーに接続できませんでした。時間をおいて、もう一度お試しください。'
}
